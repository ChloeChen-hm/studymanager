import React from 'react';
import { Task, COGNITIVE_TYPES } from '../types';
import { Brain, Sparkles, TrendingUp, HelpCircle, Activity, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';

interface CognitiveDashboardProps {
  tasks: Task[];
  selectedDate: string;
}

export default function CognitiveDashboard({ tasks, selectedDate }: CognitiveDashboardProps) {
  // Filter tasks due or targeted for this date
  const selectedDayTasks = tasks.filter((t) => {
    // If the balancing engine suggests an alternative date, we evaluate that workload
    const activeDate = t.suggestedDate || t.dueDate;
    return activeDate === selectedDate && !t.completed;
  });

  const totalHrs = selectedDayTasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  
  // Calculate stress score: sum(hours * difficulty)
  const stressScore = selectedDayTasks.reduce((sum, t) => sum + (t.estimatedHours * t.difficulty), 0);

  // Classify stress level
  let stressCategory: 'none' | 'low' | 'medium' | 'high' = 'none';
  let stressLabel = 'Tranquil';
  let stressColor = 'bg-emerald-500';
  let stressTextColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20';
  let stressDesc = 'Zero homework scheduled. Great day for restorative micro-breaks!';

  if (stressScore > 0 && stressScore <= 12) {
    stressCategory = 'low';
    stressLabel = 'Light Workload';
    stressColor = 'bg-blue-500';
    stressTextColor = 'text-blue-300 bg-blue-900/40 border-blue-500/20';
    stressDesc = 'Balanced academic load. Easy task consolidation and healthy cognitive rest.';
  } else if (stressScore > 12 && stressScore <= 28) {
    stressCategory = 'medium';
    stressLabel = 'Elevated Load';
    stressColor = 'bg-amber-500';
    stressTextColor = 'text-amber-300 bg-amber-900/40 border-amber-500/20';
    stressDesc = 'Moderately high mental load. Spread complex analytical tasks and use Pomodoro clocks.';
  } else if (stressScore > 28) {
    stressCategory = 'high';
    stressLabel = 'Cognitive Stress Wave';
    stressColor = 'bg-rose-500';
    stressTextColor = 'text-rose-300 bg-rose-900/40 border-rose-500/20';
    stressDesc = 'High risk of burnout! Pressure peaks can lead to procrastination. Consider rescheduling or using AI optimization.';
  }

  // Calculate Cognitive Profile Split for selectedDayTasks
  const typeCounts: Record<Task['cognitiveType'], number> = {
    analytical: 0,
    creative: 0,
    memorization: 0,
    repetitive: 0,
    synthesis: 0,
  };

  selectedDayTasks.forEach((t) => {
    typeCounts[t.cognitiveType] += t.estimatedHours;
  });

  const grandTotalSecHours = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  // Subject-specific intelligent advice generator
  const getDailyStrategy = () => {
    if (selectedDayTasks.length === 0) {
      return ["Enjoy your downtime! Real rest replenishes active memory channels and improves long-term focus."];
    }

    const advice: string[] = [];
    const mainType = Object.entries(typeCounts).reduce((max, curr) => (curr[1] > max[1] ? curr : max), ['none', 0])[0];

    if (typeCounts.analytical > 0) {
      advice.push("Execute analytical Math/Physics/Code problems early in your cycle. Active working memory is deepest in the first 3 hours of study.");
    }
    if (typeCounts.synthesis > 0) {
      advice.push("Long essays or reading documents are mentally fatiguing. Draft raw outlines instead of aiming for perfect grammar on the first pass.");
    }
    if (typeCounts.memorization > 0) {
      advice.push("Use active retrieval (flashcards) in small 15-minute bursts. Memory consolidation works best when spaced throughout the afternoon.");
    }
    if (typeCounts.creative > 0) {
      advice.push("Creative projects thrive under relaxed constraints. Try brainstorming concepts on scrap margins or a secondary board before digital prototyping.");
    }

    // Advice based on combinations
    if (selectedDayTasks.length >= 3) {
      advice.push("You are switching between 3+ subjects. Group similar cognitive modes together (e.g., do all math first, then switch to essays) to minimize switching cost.");
    }

    return advice;
  };

  const strategies = getDailyStrategy();

  // Selected date visual string
  const formatDateString = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="backdrop-blur-md bg-blue-950/40 border border-blue-500/20 rounded-2xl p-5 shadow-xl space-y-6 text-white h-full">
      {/* Date Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-blue-500/10">
        <div>
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-0.5 animate-pulse">Focus Analysis Target</span>
          <h2 className="text-lg font-bold text-white">{formatDateString(selectedDate)}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-mono">Tasks: <span className="text-white font-semibold">{selectedDayTasks.length}</span></span>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40"></span>
          <span className="text-xs text-slate-300 font-mono">Total Study: <span className="text-white font-semibold">{totalHrs} hrs</span></span>
        </div>
      </div>

      {/* Main Stress Wave Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stress score Dial */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-400" />
              Composite Stress score
            </span>
            <span className="text-xs text-slate-400 font-mono">Formula: hrs × difficulty</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="relative shrink-0 flex items-center justify-center bg-blue-950/60 border border-blue-500/15 rounded-2xl p-4 w-28 h-28">
              <div className="text-center">
                <span className="text-3xl font-extrabold text-white font-mono tracking-tight">{stressScore}</span>
                <span className="block text-[9px] text-blue-300 uppercase font-semibold mt-0.5">Weight Units</span>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1.5 rounded-b-2xl ${stressColor}`}></div>
            </div>

            <div className="space-y-1.5 p-1">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stressTextColor}`}>
                {stressCategory === 'high' && <AlertTriangle className="w-3.5 h-3.5" />}
                {stressCategory === 'low' && <ShieldCheck className="w-3.5 h-3.5" />}
                {stressLabel}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">{stressDesc}</p>
            </div>
          </div>

          {/* Stress Meter Indicator Bar */}
          <div className="space-y-1">
            <div className="w-full bg-blue-950/60 h-2.5 rounded-full overflow-hidden flex gap-0.5">
              <div className={`h-full ${stressScore > 0 ? 'bg-blue-400' : 'bg-blue-950/20'}`} style={{ width: `${Math.min(100, (Math.min(12, stressScore) / 45) * 100)}%` }}></div>
              <div className={`h-full ${stressScore > 12 ? 'bg-amber-400' : 'bg-blue-950/20'}`} style={{ width: `${Math.min(100, (Math.max(0, Math.min(16, stressScore - 12)) / 45) * 100)}%` }}></div>
              <div className={`h-full ${stressScore > 28 ? 'bg-rose-500' : 'bg-blue-950/20'}`} style={{ width: `${Math.min(100, (Math.max(0, stressScore - 28) / 45) * 100)}%` }}></div>
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 font-mono uppercase font-semibold px-0.5">
              <span>0 (Tranquil)</span>
              <span>12 (Average)</span>
              <span>28 (High Peak)</span>
              <span>45+ (Burnout Zone)</span>
            </div>
          </div>
        </div>

        {/* Cognitive Load Splits */}
        <div>
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 block">
            Cognitive Profile Distribution
          </span>
          {grandTotalSecHours === 0 ? (
            <div className="bg-blue-950/25 rounded-xl p-6 text-center border border-dashed border-blue-500/15 text-xs text-slate-400 flex flex-col items-center justify-center gap-1 h-[140px]">
              <Brain className="w-6 h-6 text-blue-500/40" />
              <span>No scheduled active work for this target day.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {(Object.keys(COGNITIVE_TYPES) as Task['cognitiveType'][]).map((type) => {
                const info = COGNITIVE_TYPES[type];
                const hrs = typeCounts[type];
                const pct = grandTotalSecHours > 0 ? (hrs / grandTotalSecHours) * 100 : 0;
                if (hrs === 0) return null;

                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          type === 'analytical' ? 'bg-indigo-500' :
                          type === 'creative' ? 'bg-pink-500' :
                          type === 'memorization' ? 'bg-amber-500' :
                          type === 'repetitive' ? 'bg-emerald-500' : 'bg-violet-500'
                        }`}></span>
                        {info.label}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px] font-semibold">
                        {hrs} hrs ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="w-full bg-blue-950/60 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          type === 'analytical' ? 'bg-indigo-500' :
                          type === 'creative' ? 'bg-pink-500' :
                          type === 'memorization' ? 'bg-amber-500' :
                          type === 'repetitive' ? 'bg-emerald-500' : 'bg-violet-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recommended Strategy (AI Infused Rule Engine) */}
      <div className="bg-blue-900/10 rounded-xl p-4 border border-blue-500/10">
        <h3 className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-400" />
          Mental Energy Distribution Plan
        </h3>
        {strategies.length > 0 ? (
          <ul className="space-y-2">
            {strategies.map((strategy, idx) => (
              <li key={idx} className="flex gap-2 text-xs text-slate-200 leading-relaxed font-sans items-start">
                <ChevronRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>{strategy}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400 font-sans">
            Rest periods are crucial. Read through materials lightly or organize your station to prime your focus for upcoming chapters.
          </p>
        )}
      </div>
    </div>
  );
}
