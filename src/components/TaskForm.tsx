import React, { useState } from 'react';
import { Task, COGNITIVE_TYPES } from '../types';
import { SUBJECT_OPTIONS } from '../initialData';
import { Sparkles, Plus, Play, Brain, Binary, ListChecks, BookOpen, Clock, Loader2, Info } from 'lucide-react';

interface TaskFormProps {
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
  onAddParsedTasks: (tasks: Task[]) => void;
}

export default function TaskForm({ onAddTask, onAddParsedTasks }: TaskFormProps) {
  // Manual Input State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [dueDate, setDueDate] = useState('2026-05-30');
  const [estimatedHours, setEstimatedHours] = useState(2);
  const [difficulty, setDifficulty] = useState(3);
  const [cognitiveType, setCognitiveType] = useState<Task['cognitiveType']>('analytical');
  const [notes, setNotes] = useState('');

  // AI Parser State
  const [aiText, setAiText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parserError, setParserError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask({
      title: title.trim(),
      subject,
      dueDate,
      estimatedHours,
      difficulty,
      cognitiveType,
      notes: notes.trim(),
    });

    setTitle('');
    setNotes('');
    setEstimatedHours(2);
    setDifficulty(3);
  };

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setIsParsing(true);
    setParserError(null);

    try {
      const response = await fetch('/api/tasks/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiText,
          currentDate: '2026-05-28', // Use standard reference date
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to communicate with AI Assistant');
      }

      const tasks: Omit<Task, 'id' | 'completed'>[] = await response.json();
      
      if (tasks && Array.isArray(tasks)) {
        const processed: Task[] = tasks.map((t, idx) => ({
          ...t,
          id: `parsed-${Date.now()}-${idx}`,
          completed: false,
        }));
        onAddParsedTasks(processed);
        setAiText('');
      } else {
        throw new Error("Invalid format returned by the AI parser.");
      }
    } catch (err: any) {
      setParserError(err.message || 'An error occurred while parsing. Please check your credentials or try again.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Manual Task Add */}
      <div id="manual-task-form" className="backdrop-blur-md bg-blue-950/40 border border-blue-500/20 p-5 rounded-2xl shadow-xl text-white">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-400" />
          Add Single Academic Task
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">
              Task / Assignment Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Chemistry Homework Chapter 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-blue-500/20 bg-blue-950/60 rounded-lg text-sm text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-blue-500/20 bg-blue-950/60 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400"
              >
                {SUBJECT_OPTIONS.map((sub) => (
                  <option key={sub} value={sub} className="bg-blue-950 text-white">
                    {sub}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">
                Due Date
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-blue-500/20 bg-blue-950/60 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Est. hours</span>
                <span className="font-mono text-white font-semibold">{estimatedHours} hrs</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(parseFloat(e.target.value))}
                className="w-full h-1 bg-blue-950/60 border border-blue-500/10 rounded-lg appearance-none cursor-pointer accent-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Cognitive difficulty</span>
                <span className="font-mono text-cyan-400 font-bold">{difficulty} / 5</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value))}
                className="w-full h-1 bg-blue-950/60 border border-blue-500/10 rounded-lg appearance-none cursor-pointer accent-blue-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">
              Cognitive Workload Profile
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {(Object.keys(COGNITIVE_TYPES) as Task['cognitiveType'][]).map((type) => {
                const info = COGNITIVE_TYPES[type];
                const isSelected = cognitiveType === type;
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setCognitiveType(type)}
                    className={`py-2 px-1 text-center rounded-lg border text-xs cursor-pointer flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'border-blue-400 bg-blue-900/60 text-white font-medium scale-[1.02] shadow-[0_0_15px_rgba(59,130,246,0.25)]'
                        : 'border-blue-500/15 text-slate-300 hover:bg-blue-900/25 hover:text-white'
                    }`}
                  >
                    <span>
                      {type === 'analytical' && <Binary className="w-4 h-4" />}
                      {type === 'creative' && <Brain className="w-4 h-4 text-pink-400" />}
                      {type === 'memorization' && <Brain className="w-4 h-4 text-amber-400" />}
                      {type === 'repetitive' && <ListChecks className="w-4 h-4 text-emerald-400" />}
                      {type === 'synthesis' && <BookOpen className="w-4 h-4 text-violet-400" />}
                    </span>
                    <span className="truncate w-full text-[10px]">{info.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">
              Notes & Concept Guidelines (Optional)
            </label>
            <textarea
              placeholder="List specific files, reading page numbers, or exam formulas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 border border-blue-500/20 bg-blue-950/60 rounded-lg text-sm text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400 min-h-[60px]"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/30 text-white font-bold py-2.5 rounded-lg text-sm shadow-md hover:scale-[1.01] cursor-pointer focus:outline-none transition-all"
          >
            Create Task
          </button>
        </form>
      </div>

      {/* AI Smart-Parser Drawer */}
      <div id="ai-parser-card" className="backdrop-blur-md bg-blue-950/40 border border-blue-500/20 p-5 rounded-2xl shadow-xl flex flex-col justify-between text-white">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-blue-400 fill-blue-500/10 animate-pulse" />
              AI Syllabus & Agenda Smart-Parser
            </h2>
            <span className="text-[10px] bg-blue-950/60 text-blue-300 border border-blue-500/25 font-semibold px-2.5 py-0.5 rounded-full">
              Gemini Direct API
            </span>
          </div>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            Copy-paste any speech transcript, messy study logs, student syllabus bullet-points, or a daily checklist. The AI will extract precise topics, auto-assess hours, detect subjects, and predict cognitive weights.
          </p>

          <div className="space-y-3">
            <textarea
              placeholder="e.g., 'So I have this massive Organic Chem exam next Tuesday (May 30) that I need to study for, taking at least 6 hours probably. I also have an essay on World War II due on Sunday, and a small Spanish vocabulary sheet that should take me an hour or so also due Sunday.'"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              disabled={isParsing}
              className="w-full px-3 py-2 border border-blue-500/20 bg-blue-950/60 rounded-xl text-sm text-white placeholder-blue-400/50 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 min-h-[140px] leading-relaxed resize-none"
            />
            {parserError && (
              <div className="bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-lg text-xs text-rose-300 flex gap-1.5 items-start">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{parserError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4">
          <button
            type="button"
            disabled={isParsing || !aiText.trim()}
            onClick={handleAiParse}
            className={`w-full text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
              isParsing || !aiText.trim()
                ? 'bg-blue-950/20 border border-blue-900/40 text-slate-400 pointer-events-none'
                : 'bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/30'
            }`}
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                Modeling cognitive weights...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-white text-white" />
                Analyze Agenda with Gemini
              </>
            )}
          </button>
          
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-blue-450 text-blue-300/80 justify-center">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Resolves dates relative to current date: May 28, 2026.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
