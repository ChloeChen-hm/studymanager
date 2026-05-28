import React, { useState } from 'react';
import { Task, OptimizationResult } from '../types';
import { Calendar, Sliders, AlertTriangle, Sparkles, Loader2, RefreshCw, Check, ArrowRight, ShieldCheck } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onApplyOptimization: (reschedules: { taskId: string; suggestedDate: string }[]) => void;
}

export default function CalendarView({
  tasks,
  selectedDate,
  onSelectDate,
  onApplyOptimization,
}: CalendarViewProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [optError, setOptError] = useState<string | null>(null);

  // Generate calendar grid dates from May 24, 2026 to June 6, 2026 (2 dynamic weeks)
  const calendarDates = [
    { date: '2026-05-24', label: 'Sun', dayNum: '24' },
    { date: '2026-05-25', label: 'Mon', dayNum: '25' },
    { date: '2026-05-26', label: 'Tue', dayNum: '26' },
    { date: '2026-05-27', label: 'Wed', dayNum: '27' },
    { date: '2026-05-28', label: 'Thu', dayNum: '28', isToday: true },
    { date: '2026-05-29', label: 'Fri', dayNum: '29' },
    { date: '2026-05-30', label: 'Sat', dayNum: '30' },
    { date: '2026-05-31', label: 'Sun', dayNum: '31' },
    { date: '2026-06-01', label: 'Mon', dayNum: '01' },
    { date: '2026-06-02', label: 'Tue', dayNum: '02' },
    { date: '2026-06-03', label: 'Wed', dayNum: '03' },
    { date: '2026-06-04', label: 'Thu', dayNum: '04' },
    { date: '2026-06-05', label: 'Fri', dayNum: '05' },
    { date: '2026-06-06', label: 'Sat', dayNum: '06' },
  ];

  // Helper to calculate workload units for a specific date
  const getDayWorkload = (dateStr: string) => {
    const dayTasks = tasks.filter((t) => {
      // Prioritize the AI recommended/suggested date if it exists, otherwise fall back to original
      const activeDate = t.suggestedDate || t.dueDate;
      return activeDate === dateStr && !t.completed;
    });

    const activeTasksCount = dayTasks.length;
    const loadScore = dayTasks.reduce((sum, t) => sum + (t.estimatedHours * t.difficulty), 0);

    let level: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (loadScore > 28) level = 'high';
    else if (loadScore > 12) level = 'medium';
    else if (loadScore > 0) level = 'low';

    return { activeTasksCount, loadScore, level, dayTasks };
  };

  const handleRunOptimizer = async () => {
    setIsOptimizing(true);
    setOptError(null);
    try {
      const response = await fetch('/api/schedule/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: tasks.filter(t => !t.completed),
          currentDate: '2026-05-28',
        }),
      });

      if (!response.ok) {
        throw new Error('Could not compute cognitive schedule optimization');
      }

      const result: OptimizationResult = await response.json();
      setOptimization(result);
    } catch (err: any) {
      setOptError(err.message || 'Error formulating alternative roadmap. Verify secrets/network.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const applyOptimizedSchedule = () => {
    if (!optimization) return;
    const reschedules = optimization.suggestedRescheduling.map((r) => ({
      taskId: r.taskId,
      suggestedDate: r.suggestedDate,
    }));
    onApplyOptimization(reschedules);
    // Clear display optimization panel or leave for review
  };

  const clearOptimization = () => {
    onApplyOptimization([]); // Resets all tasks' suggestedDate to undefined
    setOptimization(null);
  };

  return (
    <div className="space-y-6 text-white">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Calendar Horizon & Stress Waves
          </h2>
          <p className="text-xs text-blue-200/80 font-sans mt-0.5">
            Visualize hidden assignment clusters, pressure stacks, and balance limits. Click any date to view details.
          </p>
        </div>

        {tasks.filter((t) => t.suggestedDate).length > 0 && (
          <button
            onClick={clearOptimization}
            className="self-start text-[11px] bg-blue-950/60 border border-blue-500/20 hover:bg-blue-900/60 font-semibold px-3 py-1.5 rounded-lg text-blue-300 cursor-pointer flex items-center gap-1 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset to Original Due Dates
          </button>
        )}
      </div>

      {/* Grid of 2 dynamic weeks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {calendarDates.map(({ date, label, dayNum, isToday }) => {
          const { activeTasksCount, loadScore, level, dayTasks } = getDayWorkload(date);
          const isSelected = selectedDate === date;

          let cellStyles = 'backdrop-blur-sm bg-blue-950/20 border-blue-500/10 hover:border-blue-500/30 hover:bg-blue-900/10 text-slate-100';
          let borderGlow = 'border-blue-500/10';
          let textColor = 'text-white';
          let infoBadge = '';

          if (level === 'low') {
            cellStyles = 'backdrop-blur-sm bg-blue-900/10 hover:bg-blue-900/20 text-blue-200';
            borderGlow = 'border-blue-500/20';
            infoBadge = 'bg-blue-600 text-white';
          } else if (level === 'medium') {
            cellStyles = 'backdrop-blur-sm bg-amber-950/20 hover:bg-amber-950/30 text-amber-300';
            borderGlow = 'border-amber-500/20';
            infoBadge = 'bg-amber-600 text-white animate-pulse';
          } else if (level === 'high') {
            cellStyles = 'backdrop-blur-sm bg-rose-950/25 hover:bg-rose-950/35 border-rose-500/30';
            borderGlow = 'border-rose-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]';
            textColor = 'text-rose-200 font-semibold';
            infoBadge = 'bg-rose-600 text-white font-bold';
          }

          if (isSelected) {
            borderGlow = 'border-blue-400 ring-2 ring-blue-500/50 scale-[1.02] bg-blue-900/10';
          }

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between h-34 min-h-[140px] relative font-sans ${cellStyles} ${borderGlow}`}
            >
              <div className="w-full">
                <div className="flex items-center justify-between pb-2 border-b border-dashed border-blue-500/10">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-400 font-mono text-[10px] uppercase">
                      {label}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" title="Current Study Date"></span>
                    )}
                  </div>
                  <span className={`text-base font-bold font-mono tracking-tight ${textColor}`}>
                    {dayNum}
                  </span>
                </div>

                <div className="mt-2.5 space-y-1 overflow-hidden w-full">
                  {dayTasks.slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      className={`text-[9px] px-1.5 py-0.5 rounded-sm truncate ${
                        t.cognitiveType === 'analytical' ? 'bg-indigo-950/60 border border-indigo-800/30 text-indigo-300' :
                        t.cognitiveType === 'creative' ? 'bg-pink-950/60 border border-pink-800/30 text-pink-300' :
                        t.cognitiveType === 'memorization' ? 'bg-amber-950/60 border border-amber-800/30 text-amber-300' :
                        t.cognitiveType === 'repetitive' ? 'bg-emerald-950/60 border border-emerald-800/30 text-emerald-300' : 'bg-violet-950/60 border border-violet-800/30 text-violet-300'
                      }`}
                    >
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-[8px] text-slate-400 font-mono text-center font-semibold pt-0.5">
                      + {dayTasks.length - 2} more tasks
                    </div>
                  )}
                </div>
              </div>

              {/* Day Score Footer */}
              <div className="flex items-center justify-between pt-1 w-full">
                {loadScore > 0 ? (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono ${infoBadge}`}>
                    Load: {loadScore}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-500 font-mono">Rest day</span>
                )}
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Cognitive Balancing Engine AI Action Panel */}
      <div id="cognitive-engine" className="backdrop-blur-md bg-blue-950/40 border border-blue-500/20 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Cognitive Balancing Engine
            </h3>
            <p className="text-xs text-blue-200/80 leading-relaxed max-w-2xl font-sans mt-0.5">
              Overwhelmed by multiple tasks falling on the exact same date? Let Gemini redistribute high-difficulty items earlier or suggest a balanced pacing guide to smooth stress peaks.
            </p>
          </div>

          <button
            onClick={handleRunOptimizer}
            disabled={isOptimizing || tasks.filter((t) => !t.completed).length === 0}
            className={`cursor-pointer font-bold text-xs px-4 py-2.5 rounded-xl text-white flex items-center gap-1.5 transition-all shadow-md ${
              isOptimizing || tasks.filter((t) => !t.completed).length === 0
                ? 'bg-blue-950/20 border border-blue-900/40 text-slate-400 pointer-events-none'
                : 'bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/30'
            }`}
          >
            {isOptimizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                Smoothing workload waves...
              </>
            ) : (
              <>
                <Sliders className="w-3.5 h-3.5 text-blue-300" />
                Rebalance Tasks
              </>
            )}
          </button>
        </div>

        {optError && (
          <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-lg text-xs text-rose-300">
            {optError}
          </div>
        )}

        {optimization ? (
          <div className="border border-blue-500/20 bg-blue-950/60 backdrop-blur-md rounded-xl p-4 space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">AI Workload Assessment</h4>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">{optimization.suggestionDescription}</p>
            </div>

            {/* Suggested shifting calendar list */}
            {optimization.suggestedRescheduling.length > 0 ? (
              <div className="space-y-2 pb-1 border-b border-dashed border-blue-500/10">
                <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">Proposed Spacing Adjustments</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {optimization.suggestedRescheduling.map((item, idx) => {
                    const taskName = tasks.find(t => t.id === item.taskId)?.title || "Academic Task";
                    return (
                      <div key={idx} className="bg-blue-900/20 border border-blue-500/15 p-3 rounded-xl flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="font-semibold text-xs text-white line-clamp-1">{taskName}</span>
                          <span className="text-[10px] text-slate-300 flex items-center gap-1 font-mono">
                            <span>{item.originalDate}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-cyan-400 font-extrabold">{item.suggestedDate}</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-sans mt-2 italic leading-relaxed border-t border-blue-500/10 pt-1.5">
                          {item.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/45 border border-emerald-500/20 p-3 rounded-lg text-xs text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Excellent spacing detected! Gemini finds zero resource stacking in your current timeline.</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-blue-300 leading-relaxed">
                <strong>General Pro Tip:</strong> {optimization.generalAdvice}
              </div>

              {optimization.suggestedRescheduling.length > 0 && (
                <button
                  onClick={applyOptimizedSchedule}
                  className="self-end bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/30 font-bold text-xs text-white px-3.5 py-2 rounded-xl cursor-pointer flex items-center gap-1 transition-all whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  Apply AI Spacing Plan
                </button>
              )}
            </div>
          </div>
        ) : (
          tasks.filter(t => !t.completed).length === 0 && (
            <div className="text-slate-400 text-xs text-center p-3">
              Add assignments or exams to let the balancing system predict stress curves.
            </div>
          )
        )}
      </div>
    </div>
  );
}
