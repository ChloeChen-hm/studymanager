export interface Task {
  id: string;
  title: string;
  subject: string;
  dueDate: string; // YYYY-MM-DD
  estimatedHours: number;
  difficulty: number; // 1 to 5
  cognitiveType: 'analytical' | 'creative' | 'memorization' | 'repetitive' | 'synthesis';
  completed: boolean;
  notes?: string;
  suggestedDate?: string; // Set by Cognitive Balancing Engine if rescheduled
  ownerId?: string;
  createdAt?: any;
}

export type CognitiveTypeInfo = {
  label: string;
  color: string;
  icon: string;
  bgColor: string;
};

export const COGNITIVE_TYPES: Record<Task['cognitiveType'], CognitiveTypeInfo> = {
  analytical: {
    label: 'Analytical',
    color: 'text-indigo-600 border-indigo-200',
    icon: 'Binary',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100',
  },
  creative: {
    label: 'Creative',
    color: 'text-pink-600 border-pink-200',
    icon: 'Sparkles',
    bgColor: 'bg-pink-50 hover:bg-pink-100',
  },
  memorization: {
    label: 'Memorization',
    color: 'text-amber-600 border-amber-200',
    icon: 'Brain',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
  },
  repetitive: {
    label: 'Repetitive / Practice',
    color: 'text-emerald-600 border-emerald-200',
    icon: 'ListChecks',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
  },
  synthesis: {
    label: 'Synthesis / Essays',
    color: 'text-violet-600 border-violet-200',
    icon: 'BookOpen',
    bgColor: 'bg-violet-50 hover:bg-violet-100',
  },
};

export interface FocusSession {
  id: string;
  taskId: string;
  startTime: string;
  durationMinutes: number;
  elapsedSeconds: number;
  focusScore: number; // 0 - 100
  interventionsTriggered: number;
  isActive: boolean;
}

export interface Intervention {
  id: string;
  type: 'microtask' | 'reset' | 'recovery';
  title: string;
  content: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface DailyLoad {
  date: string;
  tasks: Task[];
  totalScore: number; // Sum of (difficulty * estimatedHours)
  stressLevel: 'low' | 'medium' | 'high';
}

export interface OptimizationResult {
  suggestionDescription: string;
  suggestedRescheduling: { taskId: string; originalDate: string; suggestedDate: string; reason: string }[];
  generalAdvice: string;
}
