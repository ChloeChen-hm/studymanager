import React, { useState, useEffect, useRef } from 'react';
import { Task, FocusSession, Intervention } from '../types';
import { Play, Pause, Square, AlertTriangle, Sparkles, Loader2, RefreshCw, Volume2, CheckCircle2, ShieldClose, BrainCircuit, HeartHandshake } from 'lucide-react';

interface StudyTimerProps {
  tasks: Task[];
  onCompleteTask: (taskId: string) => void;
}

export default function StudyTimer({ tasks, onCompleteTask }: StudyTimerProps) {
  const activeTasks = tasks.filter((t) => !t.completed);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(activeTasks[0]?.id || '');

  // Session state
  const [session, setSession] = useState<FocusSession | null>(null);
  const [sessionTimer, setSessionTimer] = useState<number>(0); // Seconds elapsed

  // Distraction & Inactivity States
  const [isTabFocused, setIsTabFocused] = useState<boolean>(true);
  const [inactivityTimer, setInactivityTimer] = useState<number>(0); // Seconds since last action
  const [showInactivityWarning, setShowInactivityWarning] = useState<boolean>(false);
  const [warningCountdown, setWarningCountdown] = useState<number>(5);

  // Intervention UI States
  const [activeIntervention, setActiveIntervention] = useState<Intervention | null>(null);
  const [isLoadingIntervention, setIsLoadingIntervention] = useState<boolean>(false);
  const [triggerCount, setTriggerCount] = useState<number>(0);
  const [focusScore, setFocusScore] = useState<number>(100);

  // Somatic Breathing Guide
  const [isBreathingGuideActive, setIsBreathingGuideActive] = useState<boolean>(false);
  const [breathCycle, setBreathCycle] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [breathPulse, setBreathPulse] = useState<number>(1); // Scale size

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // References for intervals and timeout
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const breathIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset task choice when active list changes
  useEffect(() => {
    if (!selectedTaskId && activeTasks.length > 0) {
      setSelectedTaskId(activeTasks[0].id);
    }
  }, [activeTasks, selectedTaskId]);

  // Audio simulation alert
  const playPing = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Ignored if standard security policy blocks premature audio
    }
  };

  // 1. Session Timing Engine
  useEffect(() => {
    if (session?.isActive) {
      intervalRef.current = setInterval(() => {
        setSessionTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.isActive]);

  // 2. Tab Blur Listener
  useEffect(() => {
    const handleBlur = () => {
      if (!session?.isActive || activeIntervention) return;
      setIsTabFocused(false);
      triggerIntervention('tab_fled');
    };

    const handleFocus = () => {
      setIsTabFocused(true);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session?.isActive, activeIntervention, selectedTaskId]);

  // 3. Somatic Physical Inactivity Listener
  useEffect(() => {
    const resetActivity = () => {
      setInactivityTimer(0);
      if (showInactivityWarning) {
        setShowInactivityWarning(false);
        setWarningCountdown(5);
      }
    };

    if (session?.isActive && !activeIntervention && !isBreathingGuideActive) {
      window.addEventListener('mousemove', resetActivity);
      window.addEventListener('keydown', resetActivity);

      inactivityIntervalRef.current = setInterval(() => {
        setInactivityTimer((prev) => {
          const nextVal = prev + 1;
          // After 25s of complete silence, show a warning countdown
          if (nextVal >= 25) {
            setShowInactivityWarning(true);
            setWarningCountdown((c) => {
              if (c <= 1) {
                // Trigger inactivity intervention
                triggerIntervention('inactivity_drift');
                return 5;
              }
              return c - 1;
            });
          }
          return nextVal;
        });
      }, 1000);
    } else {
      if (inactivityIntervalRef.current) clearInterval(inactivityIntervalRef.current);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
    }

    return () => {
      if (inactivityIntervalRef.current) clearInterval(inactivityIntervalRef.current);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
    };
  }, [session?.isActive, activeIntervention, isBreathingGuideActive, showInactivityWarning]);

  // 4. Somatic Breathing guide logic
  useEffect(() => {
    if (isBreathingGuideActive) {
      let counter = 0;
      breathIntervalRef.current = setInterval(() => {
        counter += 1;
        if (counter <= 4) {
          setBreathCycle('Inhale');
          setBreathPulse(1 + (counter * 0.15)); // Expands
        } else if (counter <= 8) {
          setBreathCycle('Hold');
          setBreathPulse(1.6); // Stable pulse size
        } else if (counter <= 12) {
          setBreathCycle('Exhale');
          setBreathPulse(1.6 - ((counter - 8) * 0.15)); // Shrinks
        } else {
          counter = 0;
        }
      }, 1000);
    } else {
      if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
    }
    return () => {
      if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
    };
  }, [isBreathingGuideActive]);

  const handleStartSession = () => {
    if (!selectedTaskId) return;
    setSession({
      id: `session-${Date.now()}`,
      taskId: selectedTaskId,
      startTime: new Date().toLocaleTimeString(),
      durationMinutes: selectedTask?.estimatedHours ? selectedTask.estimatedHours * 60 : 60,
      elapsedSeconds: 0,
      focusScore: 100,
      interventionsTriggered: 0,
      isActive: true,
    });
    setSessionTimer(0);
    setTriggerCount(0);
    setFocusScore(100);
    setActiveIntervention(null);
  };

  const handlePauseSession = () => {
    if (!session) return;
    setSession({ ...session, isActive: !session.isActive });
  };

  const handleStopSession = (isCompletedTask: boolean = false) => {
    if (!session) return;
    if (isCompletedTask && selectedTaskId) {
      onCompleteTask(selectedTaskId);
    }
    setSession(null);
    setInactivityTimer(0);
    setShowInactivityWarning(false);
  };

  // Call API to fetch customized Gemini Intervention Card
  const triggerIntervention = async (disruptionType: 'tab_fled' | 'inactivity_drift' | 'manual_stuck') => {
    if (!session || !selectedTask) return;
    playPing();

    // Pause timer and prepare loading state
    setSession((p) => p ? { ...p, isActive: false } : null);
    setIsLoadingIntervention(true);

    // Calculate details
    setTriggerCount((c) => c + 1);
    setFocusScore((f) => Math.max(20, f - 15)); // Subtract attention points

    let reasonStr = '';
    if (disruptionType === 'tab_fled') reasonStr = 'Left the Study Application Environment / Tab Switching';
    else if (disruptionType === 'inactivity_drift') reasonStr = 'Deep Screen Inactivity (25s Idle time)';
    else reasonStr = "Student clicked 'Seek Recovery' (Mental Block/Frustration)";

    try {
      const response = await fetch('/api/focus/intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: selectedTask,
          disruptionType: reasonStr,
          elapsedMinutes: Math.floor(sessionTimer / 60),
        }),
      });

      if (!response.ok) {
        throw new Error('Could not formulate custom cognitive restoration');
      }

      const info = await response.json();
      setActiveIntervention({
        id: `interv-${Date.now()}`,
        type: info.type,
        title: info.title,
        content: info.content,
        timestamp: new Date().toLocaleTimeString(),
        acknowledged: false,
      });
    } catch (err) {
      // Fallback local interruption if connectivity is down
      setActiveIntervention({
        id: `interv-fallback`,
        type: 'reset',
        title: 'Cognitive Reset Interval',
        content: `Move your shoulders back, soft breath, look at any distant object for 20 seconds. Return with focus to "${selectedTask.title}".`,
        timestamp: new Date().toLocaleTimeString(),
        acknowledged: false,
      });
    } finally {
      setIsLoadingIntervention(false);
      setShowInactivityWarning(false);
      setWarningCountdown(5);
    }
  };

  const acknowledgeIntervention = () => {
    setActiveIntervention(null);
    setInactivityTimer(0);
    setSession((p) => p ? { ...p, isActive: true } : null);
  };

  // Clock formatter helper
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="backdrop-blur-md bg-blue-950/40 border border-blue-500/20 rounded-2xl p-5 shadow-xl space-y-6 text-white h-full">
      
      {/* Session Header Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-blue-400" />
            Real-Time Focus & Procrastination Interrupter
          </h2>
          <p className="text-xs text-blue-200/80 font-sans mt-0.5">
            Select a task, launch the countdown, and try to maintain focus. The system checks tab switches and physical idle time.
          </p>
        </div>

        {!session && activeTasks.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-300 font-semibold whitespace-nowrap">Focus Target:</label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="px-3 py-1.5 border border-blue-500/20 bg-blue-950/60 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {activeTasks.map((t) => (
                <option key={t.id} value={t.id} className="bg-blue-950 text-white">
                  [{t.subject}] {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTasks.length === 0 ? (
        <div className="bg-blue-950/25 border border-dashed border-blue-500/15 rounded-2xl p-8 text-center text-slate-300 text-xs flex flex-col items-center gap-1.5 justify-center py-12">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <span className="font-semibold text-white">All chores finalized!</span>
          <span>Add more tasks in the left screen to load study clocks.</span>
        </div>
      ) : (
        /* Work Clock Frame */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Section: Main Dial and Controls */}
          <div className="md:col-span-7 backdrop-blur-md bg-blue-950/50 border border-blue-500/20 rounded-3xl p-6 text-white flex flex-col justify-between relative overflow-hidden min-h-[300px] shadow-xl">
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            {/* Clock Metadata */}
            <div className="flex items-center justify-between z-10 w-full">
              <div className="space-y-0.5">
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest block">Active Focus Session</span>
                <p className="text-sm font-bold truncate max-w-[200px] sm:max-w-xs text-white">{selectedTask?.title}</p>
              </div>
              {session && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] text-blue-300 block uppercase font-bold">Focus score</span>
                    <span className={`text-sm font-bold font-mono ${focusScore > 80 ? 'text-emerald-400' : focusScore > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {focusScore}%
                    </span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></div>
                </div>
              )}
            </div>

            {/* Giant Monospace Timer */}
            <div className="text-center py-6 z-10">
              <span className="font-mono text-6xl sm:text-7xl font-extrabold tracking-tight text-white font-mono-numbers">
                {formatTime(sessionTimer)}
              </span>
              <p className="text-xs text-slate-300 font-sans tracking-wide mt-2">
                {session?.isActive ? "Flow-state active. Monitor your attention patterns." : session ? "Paused. Breathe deeply to reset." : "Ready to study. Clock starts from zero."}
              </p>
            </div>

            {/* Big Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-blue-500/10 z-10">
              <div className="flex items-center gap-2">
                {!session ? (
                  <button
                    onClick={handleStartSession}
                    className="bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/30 text-white text-xs font-bold px-4.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Play className="w-4 h-4 fill-white text-white" />
                    Launch Session
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handlePauseSession}
                      className="bg-blue-900/40 hover:bg-blue-900/60 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer border border-blue-500/20 flex items-center gap-1 transition-all"
                    >
                      {session.isActive ? (
                        <>
                          <Pause className="w-4 h-4 fill-white" />
                          Pause Timer
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          Resume
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleStopSession(false)}
                      className="bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-305 text-rose-300 text-xs font-semibold px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5 fill-rose-300" />
                      Abort
                    </button>
                  </>
                )}
              </div>

              {session && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerIntervention('manual_stuck')}
                    className="bg-blue-900/40 border border-blue-500/15 text-blue-300 hover:bg-blue-900/60 text-[11px] font-semibold px-3.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    I'm Stuck
                  </button>
                  <button
                    onClick={() => handleStopSession(true)}
                    className="bg-emerald-600 hover:bg-emerald-505 text-white text-[11px] font-bold px-3.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1 transition-all whitespace-nowrap"
                  >
                    Finish Task
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section: Live Diagnostic and Procrastination Interruption simulation */}
          <div className="md:col-span-5 backdrop-blur-md bg-blue-950/30 border border-blue-500/15 rounded-3xl p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                  <BrainCircuit className="w-4 h-4 text-blue-400" />
                  Live Focus Diagnostics
                </span>
                <span className="text-[10px] bg-blue-900/35 border border-blue-500/15 px-1.5 py-0.5 rounded font-mono text-blue-300">
                  Adaptive Monitor
                </span>
              </div>

              {/* Distraction simulation / Test Button */}
              {session?.isActive ? (
                <div className="bg-blue-950/40 rounded-2xl p-3 px-3.5 border border-blue-500/15 space-y-2 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Real-Time Simulation Deck</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    Student distraction can be hard to trigger on a fast browser demo. Force an attention interception to inspect Gemini's micro-break advice card:
                  </p>
                  <button
                    onClick={() => triggerIntervention('tab_fled')}
                    className="w-full bg-rose-950/40 border border-rose-500/30 text-rose-305 text-rose-300 hover:bg-rose-900/50 font-semibold py-1.5 rounded-lg text-[10px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Simulate Tab-Switching Alert
                  </button>
                </div>
              ) : (
                <div className="text-center p-6 bg-blue-950/10 border border-dashed border-blue-500/10 rounded-2xl text-[11px] text-slate-400">
                  Diagnostics load when a focus session starts.
                </div>
              )}

              {/* Critical countdown popup if physical inactivity triggers */}
              {showInactivityWarning && (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 text-center space-y-1.5 animate-bounce text-amber-300">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide block">Cognitive Drift Warnings</span>
                  <p className="text-xs text-slate-300 leading-snug">
                    Are you reading pages or scrolling phone? Inactivity detected! Tap mouse to clear.
                  </p>
                  <span className="font-mono text-lg font-black text-amber-400 block">
                    {warningCountdown}s
                  </span>
                </div>
              )}

              {/* Status parameters */}
              {session && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-blue-950/20 border border-blue-500/10 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase">Disruptions Caught</span>
                    <span className="font-mono text-white font-bold block">{triggerCount}</span>
                  </div>
                  <div className="bg-blue-950/20 border border-blue-500/10 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase">Sub-goals Spaced</span>
                    <span className="font-mono text-white font-bold block">
                      {triggerCount > 0 ? `${triggerCount} Cards` : 'None'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Somatic Reset breathing widget */}
            <div className="pt-4 border-t border-blue-500/10 flex flex-col items-center">
              {!isBreathingGuideActive ? (
                <button
                  onClick={() => setIsBreathingGuideActive(true)}
                  className="text-[11px] text-slate-300 hover:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <HeartHandshake className="w-4 h-4 text-blue-400" />
                  Somatic Reset: Pulse Breathe
                </button>
              ) : (
                <div className="p-3 w-full bg-blue-950/40 border border-blue-500/20 rounded-2xl text-center space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Somatic Coach</span>
                    <button
                      onClick={() => setIsBreathingGuideActive(false)}
                      className="text-[10px] text-blue-105 bg-blue-950 border border-blue-500/20 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Close Guide
                    </button>
                  </div>

                  {/* Somatic wheel animated manually by react size state */}
                  <div className="flex items-center justify-center h-20">
                    <div
                      className="rounded-full bg-gradient-to-tr from-blue-600 to-indigo-650 shadow-lg text-white flex items-center justify-center font-bold text-xs"
                      style={{
                        width: `${Math.round(48 * breathPulse)}px`,
                        height: `${Math.round(48 * breathPulse)}px`,
                        transition: 'all 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {breathCycle}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-300 px-2 line-clamp-1 leading-normal">
                    {breathCycle === 'Inhale' && 'Slowly expand the lungs and lift the neck.'}
                    {breathCycle === 'Hold' && 'Release shoulder tension, settle working memory.'}
                    {breathCycle === 'Exhale' && 'Slowly push breath out, reset your focus channel.'}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 5. Custom Gemini Intervention overlay card */}
      {(isLoadingIntervention || activeIntervention) && (
        <div className="fixed inset-0 bg-blue-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-blue-950 border border-blue-500/30 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4 animate-scale-up text-white">
            
            {isLoadingIntervention ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-10 h-10 animate-spin text-blue-450 text-blue-300 mx-auto" />
                <div>
                  <h3 className="font-bold text-white text-sm">Assessing mental fatigue...</h3>
                  <p className="text-xs text-slate-300 mt-1">Gemini is synthesizing a custom cognitive micro-goal.</p>
                </div>
              </div>
            ) : (
              activeIntervention && (
                <div className="space-y-4">
                  {/* Card Header based on Type */}
                  <div className="flex items-center justify-between pb-3 border-b border-blue-500/10">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      activeIntervention.type === 'microtask' ? 'bg-blue-900/40 text-blue-300 border border-blue-500/20' :
                      activeIntervention.type === 'reset' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/20' : 'bg-violet-900/40 text-violet-300 border border-violet-500/20'
                    }`}>
                      {activeIntervention.type === 'microtask' && 'Inertia Breaker (Microtask)'}
                      {activeIntervention.type === 'reset' && 'Somatic Reset Interval'}
                      {activeIntervention.type === 'recovery' && 'Anxiety Recovery Anchor'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{activeIntervention.timestamp}</span>
                  </div>

                  {/* Intercept Icon & Title */}
                  <div className="flex gap-3.5 items-start">
                    <div className="p-2.5 rounded-2xl bg-blue-950/80 border border-blue-500/15 text-blue-400 shrink-0">
                      <Sparkles className="w-5 h-5 fill-blue-500/10" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-white font-sans tracking-tight leading-snug">{activeIntervention.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">{activeIntervention.content}</p>
                    </div>
                  </div>

                  {/* Diagnostic details */}
                  <div className="bg-blue-900/20 border border-blue-500/10 text-slate-300 p-3 rounded-2xl text-[11px] leading-relaxed leading-normal">
                    <strong>Study Management Engine:</strong> Focus breach captured. Focus level reduced. Spacing a 2-minute restorative microtask blocks procrastination loops before they take hold of your study cycle. Out-of-app tab drifts lead to cognitive fatigue.
                  </div>

                  {/* Intercept Actions */}
                  <button
                    onClick={acknowledgeIntervention}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/30 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    I am Back & Focused
                  </button>
                </div>
              )
            )}
            
          </div>
        </div>
      )}

    </div>
  );
}
