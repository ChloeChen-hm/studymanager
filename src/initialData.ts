import { Task } from './types';

export const INITIAL_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Organic Chemistry chapters 5-8 exam focus',
    subject: 'Chemistry',
    dueDate: '2026-05-30', // Saturday (Overload peaks)
    estimatedHours: 6.0,
    difficulty: 5,
    cognitiveType: 'memorization',
    completed: false,
    notes: 'Complex mechanisms, substitution/elimination reactions, flashcard practice.',
  },
  {
    id: 't2',
    title: 'Advanced Calculus problem set 4',
    subject: 'Math',
    dueDate: '2026-05-30', // Saturday (Overload peaks)
    estimatedHours: 4.0,
    difficulty: 4,
    cognitiveType: 'analytical',
    completed: false,
    notes: 'Partial derivatives and Lagrange multipliers.',
  },
  {
    id: 't3',
    title: 'World War II Historical Impact essay',
    subject: 'History',
    dueDate: '2026-05-31', // Sunday (Consequent stress day)
    estimatedHours: 5.0,
    difficulty: 4,
    cognitiveType: 'synthesis',
    completed: false,
    notes: '3-page argumentative draft on economic recovery factors post-1945.',
  },
  {
    id: 't4',
    title: 'Electromagnetism virtual lab report draft',
    subject: 'Physics',
    dueDate: '2026-06-02', // Monday/Tuesday
    estimatedHours: 3.0,
    difficulty: 3,
    cognitiveType: 'analytical',
    completed: false,
    notes: 'Enter simulation findings and plot magnetic flux vectors.',
  },
  {
    id: 't5',
    title: 'Interface mockup for mobile design task',
    subject: 'Design',
    dueDate: '2026-05-29', // Friday
    estimatedHours: 2.0,
    difficulty: 2,
    cognitiveType: 'creative',
    completed: true,
    notes: 'Draft high-fidelity color pairings in UI layout editor.',
  },
  {
    id: 't6',
    title: 'French vocabulary & irregular verbs review',
    subject: 'English/Languages',
    dueDate: '2026-05-31', // Sunday
    estimatedHours: 1.0,
    difficulty: 1,
    cognitiveType: 'repetitive',
    completed: false,
    notes: 'Spaced repetition deck with 50 verbs.',
  },
];

export const SUBJECT_OPTIONS = [
  'Math',
  'Chemistry',
  'Physics',
  'History',
  'English/Languages',
  'Design',
  'Computer Science',
  'Biology',
  'Philosophy',
];
