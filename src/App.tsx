import React, { useState, useEffect } from 'react';
import { Task } from './types';
import { INITIAL_TASKS } from './initialData';
import TaskForm from './components/TaskForm';
import CognitiveDashboard from './components/CognitiveDashboard';
import CalendarView from './components/CalendarView';
import StudyTimer from './components/StudyTimer';
import {
  Brain,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  ListTodo,
  Trash2,
  Info,
  Layers,
  CircleAlert,
  CalendarCheck,
  LogOut,
  User,
  ShieldCheck,
  Database,
  Loader2,
  RefreshCw
} from 'lucide-react';
import {
  auth,
  signInWithGoogle,
  logoutUser,
  db,
  handleFirestoreError,
  OperationType,
  testConnection
} from './firebase';
import {
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  // Local Accounts and Guest Access state
  const [authMethod, setAuthMethod] = useState<'local' | 'guest' | 'google'>('local');
  const [localUsername, setLocalUsername] = useState('');
  const [localPassword, setLocalPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authFeedback, setAuthFeedback] = useState('');

  // Default target date selected is set to Saturday (May 30, 2026) to instantly display the peak stress workload wave
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-30');
  const [currentTab, setCurrentTab] = useState<'planner' | 'focus'>('planner');

  // Monitor auth changes and configure Firestore connection check
  useEffect(() => {
    testConnection();

    // Recover local user session if exists
    const activeLocal = localStorage.getItem('cognitive_active_local_user');
    if (activeLocal) {
      try {
        setUser(JSON.parse(activeLocal));
        setAuthLoading(false);
        return;
      } catch (e) {
        console.error("Local session recovery error:", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Direct update only if no local accounts are saved
      if (!localStorage.getItem('cognitive_active_local_user')) {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync tasks state to Firestore or Local Storage in real time based on active user
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    if (user.isLocal || user.isGuest) {
      // Sync local tasks
      const localData = localStorage.getItem(`cognitive_tasks_${user.uid}`);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setTasks(parsed);
        } catch (e) {
          console.error("Failed to parse local tasks repo:", e);
          setTasks([]);
        }
      } else {
        // Pre-populate with typical demo stress wave tasks on first create
        const initialWithUser = INITIAL_TASKS.map((t, idx) => ({
          ...t,
          id: `local-task-${idx}-${Date.now()}`,
          ownerId: user.uid,
          createdAt: { seconds: Math.floor(Date.now() / 1000) - idx * 3600 }
        }));
        setTasks(initialWithUser);
        localStorage.setItem(`cognitive_tasks_${user.uid}`, JSON.stringify(initialWithUser));
      }
      return;
    }

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks: Task[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        fetchedTasks.push({
          id: docSnapshot.id,
          title: data.title,
          subject: data.subject,
          dueDate: data.dueDate,
          estimatedHours: Number(data.estimatedHours || 0),
          difficulty: Number(data.difficulty || 1),
          cognitiveType: data.cognitiveType,
          completed: Boolean(data.completed),
          notes: data.notes || '',
          suggestedDate: data.suggestedDate || '',
          ownerId: data.ownerId,
          createdAt: data.createdAt,
        } as Task);
      });

      // Sort client-side in JS by createdAt to prevent needing index generation
      const sorted = fetchedTasks.sort((a, b) => {
        const timeA = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : (a.createdAt ? new Date(a.createdAt as any).getTime() : Date.now());
        const timeB = b.createdAt?.seconds 
          ? b.createdAt.seconds * 1000 
          : (b.createdAt ? new Date(b.createdAt as any).getTime() : Date.now());
        return timeB - timeA;
      });

      setTasks(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, [user]);

  // Seeding helper to instantly populate standard sample assignments on first run for user onboarding
  const handleSeedDemoTasks = async () => {
    if (!user) return;
    setIsSeeding(true);

    if (user.isLocal || user.isGuest) {
      setTimeout(() => {
        const initialWithUser = INITIAL_TASKS.map((t, idx) => ({
          ...t,
          id: `local-task-${idx}-${Date.now()}`,
          ownerId: user.uid,
          createdAt: { seconds: Math.floor(Date.now() / 1000) - idx * 3600 }
        }));
        setTasks(initialWithUser);
        localStorage.setItem(`cognitive_tasks_${user.uid}`, JSON.stringify(initialWithUser));
        setIsSeeding(false);
      }, 500);
      return;
    }

    try {
      const batch = writeBatch(db);
      INITIAL_TASKS.forEach((initialTask) => {
        const newDocRef = doc(collection(db, 'tasks'));
        batch.set(newDocRef, {
          title: initialTask.title,
          subject: initialTask.subject,
          dueDate: initialTask.dueDate,
          estimatedHours: initialTask.estimatedHours,
          difficulty: initialTask.difficulty,
          cognitiveType: initialTask.cognitiveType,
          completed: initialTask.completed,
          notes: initialTask.notes || '',
          suggestedDate: initialTask.suggestedDate || '',
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error seeding tasks:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddTask = async (newTask: Omit<Task, 'id' | 'completed'>) => {
    if (!user) return;

    if (user.isLocal || user.isGuest) {
      const docId = `task-${Date.now()}`;
      const createdTask: Task = {
        ...newTask,
        id: docId,
        completed: false,
        ownerId: user.uid,
        createdAt: new Date().toISOString() as any,
      };
      const updated = [createdTask, ...tasks];
      setTasks(updated);
      localStorage.setItem(`cognitive_tasks_${user.uid}`, JSON.stringify(updated));
      return;
    }

    const docId = `task-${Date.now()}`;
    const docRef = doc(db, 'tasks', docId);
    try {
      await setDoc(docRef, {
        title: newTask.title,
        subject: newTask.subject,
        dueDate: newTask.dueDate,
        estimatedHours: newTask.estimatedHours,
        difficulty: newTask.difficulty,
        cognitiveType: newTask.cognitiveType,
        completed: false,
        notes: newTask.notes || '',
        suggestedDate: newTask.suggestedDate || '',
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tasks/${docId}`);
    }
  };

  const handleAddParsedTasks = async (parsed: Task[]) => {
    if (!user) return;

    if (user.isLocal || user.isGuest) {
      const tasksToAdd: Task[] = parsed.map((t, idx) => ({
        ...t,
        id: `task-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        completed: false,
        ownerId: user.uid,
        createdAt: new Date().toISOString() as any,
      }));
      const updated = [...tasksToAdd, ...tasks];
      setTasks(updated);
      localStorage.setItem(`cognitive_tasks_${user.uid}`, JSON.stringify(updated));
      if (tasksToAdd.length > 0) {
        setSelectedDate(tasksToAdd[0].dueDate);
      }
      return;
    }

    try {
      const batch = writeBatch(db);
      parsed.forEach((t) => {
        const docId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const docRef = doc(db, 'tasks', docId);
        batch.set(docRef, {
          title: t.title,
          subject: t.subject,
          dueDate: t.dueDate,
          estimatedHours: t.estimatedHours,
          difficulty: t.difficulty,
          cognitiveType: t.cognitiveType,
          completed: false,
          notes: t.notes || '',
          suggestedDate: t.suggestedDate || '',
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      // Focus calendar view on the first extracted task checkDate if exists
      if (parsed.length > 0) {
        setSelectedDate(parsed[0].dueDate);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks/batch-parse');
    }
  };

  const handleToggleCompleted = async (taskId: string) => {
    if (!user) return;

    if (user.isLocal || user.isGuest) {
      const updated = tasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, completed: !t.completed };
        }
        return t;
      });
      setTasks(updated);
      localStorage.setItem(`cognitive_tasks_${user.uid}`, JSON.stringify(updated));
      return;
    }

    const taskToToggle = tasks.find((t) => t.id === taskId);
    if (!taskToToggle) return;
    
    const path = `tasks/${taskId}`;
    try {
      const docRef = doc(db, 'tasks', taskId);
      await setDoc(docRef, {
        completed: !taskToToggle.completed
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;

    if (user.isLocal || user.isGuest) {
      const updated = tasks.filter((t) => t.id !== taskId);
      setTasks(updated);
      localStorage.setItem(`cognitive_tasks_${user.uid}`, JSON.stringify(updated));
      return;
    }

    const path = `tasks/${taskId}`;
    try {
      const docRef = doc(db, 'tasks', taskId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleApplyOptimization = async (reschedules: { taskId: string; suggestedDate: string }[]) => {
    if (!user) return;

    if (user.isLocal || user.isGuest) {
      let updated: Task[] = [];
      if (reschedules.length === 0) {
        updated = tasks.map((t) => ({ ...t, suggestedDate: '' }));
      } else {
        const rescheduleMap = new Map(reschedules.map((r) => [r.taskId, r.suggestedDate]));
        updated = tasks.map((t) => {
          if (rescheduleMap.has(t.id)) {
            return { ...t, suggestedDate: rescheduleMap.get(t.id)! };
          }
          return t;
        });
      }
      setTasks(updated);
      localStorage.setItem(`cognitive_tasks_${user.uid}`, JSON.stringify(updated));
      return;
    }

    try {
      const batch = writeBatch(db);
      
      if (reschedules.length === 0) {
        // Clear all suggested dates
        tasks.forEach((t) => {
          if (t.suggestedDate && t.suggestedDate !== '') {
            const docRef = doc(db, 'tasks', t.id);
            batch.set(docRef, { suggestedDate: "" }, { merge: true });
          }
        });
      } else {
        reschedules.forEach((r) => {
          const docRef = doc(db, 'tasks', r.taskId);
          batch.set(docRef, { suggestedDate: r.suggestedDate }, { merge: true });
        });
      }
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks/optimization');
    }
  };

  // Local Accounts sign in handler
  const handleLocalAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback('');

    const trimmedUser = localUsername.trim();
    if (!trimmedUser || !localPassword) {
      setAuthFeedback('Please enter both username and password.');
      return;
    }

    if (trimmedUser.length < 3) {
      setAuthFeedback('Username must be at least 3 characters.');
      return;
    }

    const accounts = JSON.parse(localStorage.getItem('cognitive_local_accounts') || '[]');
    const userLower = trimmedUser.toLowerCase();

    if (isRegistering) {
      // Create Account (Sign up)
      const exists = accounts.some((a: any) => a.username.toLowerCase() === userLower);
      if (exists) {
        setAuthFeedback('Username already exists. Please choose another username.');
        return;
      }

      const newAccount = { username: trimmedUser, password: localPassword };
      accounts.push(newAccount);
      localStorage.setItem('cognitive_local_accounts', JSON.stringify(accounts));
      
      const loggedUser = {
        uid: `local_${userLower}`,
        displayName: trimmedUser,
        email: `${trimmedUser}@local`,
        isLocal: true,
      };
      localStorage.setItem('cognitive_active_local_user', JSON.stringify(loggedUser));
      setUser(loggedUser);
    } else {
      // Sign In
      const found = accounts.find((a: any) => a.username.toLowerCase() === userLower);
      if (!found) {
        setAuthFeedback("Username not found. Toggle 'Create Account' below to sign up!");
        return;
      }

      if (found.password !== localPassword) {
        setAuthFeedback('Incorrect password. Please try again.');
        return;
      }

      const loggedUser = {
        uid: `local_${userLower}`,
        displayName: found.username,
        email: `${found.username}@local`,
        isLocal: true,
      };
      localStorage.setItem('cognitive_active_local_user', JSON.stringify(loggedUser));
      setUser(loggedUser);
    }
  };

  // Local Guest handler
  const handleGuestAuth = () => {
    const loggedUser = {
      uid: 'guest',
      displayName: 'Guest Student',
      email: 'guest@localhost',
      isGuest: true,
    };
    localStorage.setItem('cognitive_active_local_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
  };

  // Logout local or google
  const handleLogout = () => {
    localStorage.removeItem('cognitive_active_local_user');
    if (user?.isLocal || user?.isGuest) {
      setUser(null);
    } else {
      logoutUser();
    }
  };

  // Completed tasks counts
  const totalActiveTasks = tasks.filter((t) => !t.completed).length;
  const totalCompletedTasks = tasks.filter((t) => t.completed).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Initializing Neural Core...</p>
        </div>
      </div>
    );
  }

  // Elegant Login Landing Card for the person needing to sign in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#0b152d] to-[#010c1e] flex flex-col justify-between p-6 text-slate-100 antialiased relative overflow-hidden">
        {/* Decorative glass glow backdrops */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full py-4 flex items-center justify-between text-[11px] text-blue-400/60 font-mono tracking-widest uppercase">
          <span className="flex items-center gap-1.5 font-semibold">
            <Brain className="w-4 h-4 text-blue-400 animate-pulse" />
            Adaptive Academic Core
          </span>
          <span>Secured Sandbox Environment</span>
        </div>

        {/* Center Card */}
        <div className="max-w-md w-full mx-auto my-12 backdrop-blur-xl bg-blue-950/40 border border-blue-500/20 rounded-3xl p-8 shadow-2xl shadow-blue-950/50 flex flex-col gap-6 relative overflow-hidden">
          {/* Internal gradient ball */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon + Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-blue-500/10 border border-blue-400/20 rounded-2xl mb-2">
              <Brain className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight bg-gradient-to-r from-blue-200 via-white to-blue-200 bg-clip-text text-transparent">
              Adaptive Cognitive Study Manager
            </h1>
            <p className="text-xs text-blue-300/80">Intelligent Workload Balancing & Attention-Lock Dashboard</p>
          </div>

          {/* Auth selection Tabs */}
          <div className="grid grid-cols-3 bg-blue-950/80 border border-blue-500/15 rounded-xl p-1 text-center select-none">
            <button
              onClick={() => { setAuthMethod('local'); setAuthFeedback(''); }}
              className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg cursor-pointer transition-all ${
                authMethod === 'local' ? 'bg-blue-600/90 text-white shadow' : 'text-slate-400 hover:text-slate-205'
              }`}
            >
              Local Password
            </button>
            <button
              onClick={() => { setAuthMethod('guest'); setAuthFeedback(''); }}
              className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg cursor-pointer transition-all ${
                authMethod === 'guest' ? 'bg-blue-600/90 text-white shadow' : 'text-slate-400 hover:text-slate-205'
              }`}
            >
              Guest (No Auth)
            </button>
            <button
              onClick={() => { setAuthMethod('google'); setAuthFeedback(''); }}
              className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg cursor-pointer transition-all ${
                authMethod === 'google' ? 'bg-blue-600/90 text-white shadow' : 'text-slate-400 hover:text-slate-205'
              }`}
            >
              Google Cloud
            </button>
          </div>

          <hr className="border-blue-500/10" />

          {/* Render forms dynamically */}
          {authMethod === 'local' && (
            <form onSubmit={handleLocalAuth} className="space-y-4">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Access with Local Accounts</span>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-blue-300 block">Username</label>
                <input
                  type="text"
                  required
                  value={localUsername}
                  onChange={(e) => setLocalUsername(e.target.value)}
                  placeholder="e.g. student1"
                  className="w-full bg-blue-950/60 border border-blue-500/20 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-blue-300 block">Password</label>
                <input
                  type="password"
                  required
                  value={localPassword}
                  onChange={(e) => setLocalPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-blue-950/60 border border-blue-500/20 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              {authFeedback && (
                <p className="text-[11px] text-rose-300 text-center font-medium bg-rose-950/30 border border-rose-500/20 py-2 rounded-xl px-3 animate-pulse">
                  {authFeedback}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/30 text-white font-bold text-xs tracking-wider uppercase py-3.5 rounded-xl shadow-lg cursor-pointer transition-all"
              >
                {isRegistering ? 'Create Local Account & Log In' : 'Sign In with Local Password'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setAuthFeedback('');
                  }}
                  className="text-[10px] text-blue-300 hover:text-blue-105 underline cursor-pointer"
                >
                  {isRegistering ? 'Already have a secure login? Sign In' : 'Need unique task separation? Click to Create Local Account'}
                </button>
              </div>
            </form>
          )}

          {authMethod === 'guest' && (
            <div className="space-y-4 py-2">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Bypass Authentication</span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Log in as guest. Your study notes, focus interventions, scheduling timelines, and tasks will be stored securely inside your browser's persistent Local Database.
              </p>
              <button
                onClick={handleGuestAuth}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-500 hover:to-teal-600 border border-emerald-400/30 text-white font-bold text-xs tracking-wider uppercase py-3.5 rounded-xl shadow-lg cursor-pointer transition-all"
              >
                Access Guest Workspace (1-Click)
              </button>
            </div>
          )}

          {authMethod === 'google' && (
            <div className="space-y-4 pt-1">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Google Accounts Access</span>
              <button
                onClick={() => signInWithGoogle()}
                className="cursor-pointer w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs tracking-wider uppercase py-3.5 border border-blue-500/30 rounded-xl shadow-lg transition-all"
              >
                Sign In with Google Cloud
              </button>
              <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                Requires iframe-popup authorization support. If google sign-in fails or stays stuck inside AI Studio, choose Guest or Local Password above!
              </p>
            </div>
          )}

          <hr className="border-blue-500/10" />

          {/* Secure details */}
          <div className="space-y-3.5">
            <h2 className="text-[10px] text-blue-400 font-bold tracking-widest uppercase mb-1">Architectural Pillars</h2>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1 bg-blue-950/60 border border-blue-800/40 rounded shrink-0">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-blue-200">Workload Wave Modeler</h3>
                <p className="text-[10px] text-slate-300 leading-relaxed">Models mental load and details custom scheduling offset recommendations to keep stress levels balanced.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1 bg-blue-950/60 border border-blue-800/40 rounded shrink-0">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-blue-200">Focus & Interactivity Drifts</h3>
                <p className="text-[10px] text-slate-300 leading-relaxed">Runs real-time attention-drifting loops and interactive breathing coaches to recover academic flow.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-7xl mx-auto w-full text-center text-[10px] text-slate-500 font-sans border-t border-blue-950/40 pt-4">
          Licensed under Academic Mind Balancing Technologies. Sandbox Cloud Container.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#09132a] to-[#010817] text-slate-100 flex flex-col antialiased relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[5%] left-[10%] w-[350px] h-[350px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[5%] w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Banner Header with User Profile integration */}
      <header className="backdrop-blur-xl bg-blue-950/40 border-b border-blue-500/15 py-4.5 px-6 shadow-md relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-blue-300 bg-blue-950/60 border border-blue-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-widest inline-flex items-center gap-1">
              <Brain className="w-3 h-3 text-blue-400 animate-pulse" />
              Cognitive Self-Management System
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Adaptive Cognitive Study Manager
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl font-sans leading-relaxed">
              An intelligent academic companion that models student mental workloads, predicts "stress waves", suggests homework spacing strategies, and intercepts real-time screen drifting.
            </p>
          </div>

          {/* Quick Metrics & User Session Details */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="backdrop-blur-md bg-blue-900/15 px-3.5 py-2 rounded-2xl border border-blue-500/20 text-center min-w-24">
              <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block">Upcoming Active</span>
              <span className="font-mono text-base font-extrabold text-[#f1f5f9]">{totalActiveTasks} Tasks</span>
            </div>
            <div className="backdrop-blur-md bg-blue-900/15 px-3.5 py-2 rounded-2xl border border-blue-500/20 text-center min-w-24">
              <span className="text-[9px] text-blue-400/80 font-bold uppercase tracking-wider block">Archived Finalized</span>
              <span className="font-mono text-base font-extrabold text-blue-300">{totalCompletedTasks} Done</span>
            </div>

            {/* User Account Capsule Badge */}
            <div className="flex items-center gap-3 pl-2 sm:border-l border-blue-500/20">
              <div className="text-right hidden sm:block">
                <span className="text-xs font-bold text-slate-100 block line-clamp-1">{user.displayName || "Academic User"}</span>
                <span className="text-[9px] text-slate-400 font-mono block line-clamp-1">{user.email}</span>
              </div>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full border border-blue-500/30 shadow`3xs`"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-300 font-bold flex items-center justify-center text-xs">
                  {user.displayName ? user.displayName.charAt(0) : "U"}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-rose-450 hover:bg-blue-950/50 border border-transparent hover:border-blue-500/20 transition-all"
                title="Log Out Account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Primary Navigation tab selections */}
      <nav className="backdrop-blur-xl bg-blue-950/30 border-b border-blue-500/15 sticky top-0 z-30 px-6">
        <div className="max-w-7xl mx-auto flex gap-4">
          <button
            onClick={() => setCurrentTab('planner')}
            className={`cursor-pointer py-3.5 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 ${
              currentTab === 'planner'
                ? 'border-blue-400 text-blue-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            Calendar & Load Balancer
          </button>
          <button
            onClick={() => setCurrentTab('focus')}
            className={`cursor-pointer py-3.5 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 ${
              currentTab === 'focus'
                ? 'border-blue-400 text-blue-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Focus Study Room
          </button>
        </div>
      </nav>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 relative z-10">
        {currentTab === 'planner' ? (
          <>
            {/* Bento Level 1: Dials (Dashboard) + Spacing (Calendar) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
              <div className="xl:col-span-4 flex flex-col">
                <CognitiveDashboard tasks={tasks} selectedDate={selectedDate} />
              </div>
              <div className="xl:col-span-8 flex flex-col">
                <CalendarView
                  tasks={tasks}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onApplyOptimization={handleApplyOptimization}
                />
              </div>
            </div>

            {/* Bento Level 2: Task Sockets and list overview */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Form Societ */}
              <div className="xl:col-span-8">
                <TaskForm onAddTask={handleAddTask} onAddParsedTasks={handleAddParsedTasks} />
              </div>

              {/* Task list Column */}
              <div id="full-task-list" className="xl:col-span-4 backdrop-blur-md bg-blue-950/40 border border-blue-500/20 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4 text-blue-400" />
                    Student Agenda Registry
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Count: {tasks.length}</span>
                </div>

                {tasks.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-blue-500/30 rounded-2xl text-slate-400 text-xs px-4 space-y-3 bg-blue-950/20">
                    <p className="leading-relaxed text-slate-300">No academic items listed on your secured account database.</p>
                    <button
                      onClick={handleSeedDemoTasks}
                      disabled={isSeeding}
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-blue-300 bg-blue-900/20 border border-blue-500/30 rounded-full hover:bg-blue-900/40 transition-colors"
                    >
                      {isSeeding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                      )}
                      Seed Demo Assignments
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {tasks.map((task) => {
                      const isShifted = !!task.suggestedDate && task.suggestedDate !== '';
                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-xl border transition-all relative flex flex-col justify-between gap-2 ${
                            task.completed
                              ? 'bg-blue-950/10 border-blue-950/30 opacity-50'
                              : 'backdrop-blur-sm bg-blue-900/20 border-blue-500/15 hover:border-blue-500/40 hover:bg-blue-900/30 shadow-inner'
                          }`}
                        >
                          {/* Top Segment: Title, Checkbox */}
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => handleToggleCompleted(task.id)}
                              className="mt-1 w-4 h-4 text-blue-500 border-blue-500/30 rounded-md focus:ring-blue-500 cursor-pointer"
                              title="Mark assignment complete"
                            />
                            <div className="space-y-0.5">
                              <span
                                className={`text-xs font-semibold text-slate-100 line-clamp-2 leading-relaxed ${
                                  task.completed ? 'line-through text-slate-500' : ''
                                }`}
                              >
                                {task.title}
                              </span>
                              <span className="text-[10px] bg-blue-950/60 text-blue-300 border border-blue-800/50 font-semibold px-2 py-0.5 rounded">
                                {task.subject}
                              </span>
                            </div>
                          </div>

                          {/* Middle notes segment */}
                          {task.notes && (
                            <p className="text-[10px] text-slate-400 line-clamp-1 italic font-sans px-1">
                              "{task.notes}"
                            </p>
                          )}

                          {/* Bottom metadata tags */}
                          <div className="flex items-center justify-between border-t border-blue-500/10 pt-2 text-[10px] text-slate-400 font-mono">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">Due:</span>
                                <span className={isShifted ? 'line-through text-slate-500' : 'text-slate-200 font-semibold'}>
                                  {task.dueDate}
                                </span>
                              </div>
                              {isShifted && (
                                <div className="text-cyan-400 font-extrabold flex items-center gap-0.5 animate-pulse">
                                  <span>AI Target:</span>
                                  <span>{task.suggestedDate}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/30 text-blue-200">
                                {task.estimatedHours} hrs
                              </span>
                              <span className="bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/30 font-bold text-blue-400">
                                Diff: {task.difficulty}/5
                              </span>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Tab: Immersive study timers with attention loops */
          <div className="max-w-4xl mx-auto space-y-6">
            <StudyTimer tasks={tasks} onCompleteTask={handleToggleCompleted} />
          </div>
        )}
      </main>

      {/* Humble professional Footer */}
      <footer className="bg-white border-t border-slate-100 py-4 px-6 text-center text-slate-400 text-xs font-sans mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <span>© 2026 Adaptive Cognitive Academic Engine. Crafted for productive mind balancing.</span>
          <div className="flex items-center gap-3">
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">Model: Gemini 3.5 Flash</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">Database: Firestore Cloud Sandbox</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">Client Environment: Sandboxed iframe</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
