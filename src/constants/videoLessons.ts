export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type LessonTopic =
  | 'chords'
  | 'strumming'
  | 'fingerpicking'
  | 'scales'
  | 'theory'
  | 'techniques'
  | 'songs'
  | 'rhythm';

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const SKILL_LEVEL_COLORS: Record<SkillLevel, { bg: string; text: string; badge: string; ring: string; progress: string }> = {
  beginner: {
    bg: 'bg-emerald-500/12',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    ring: 'ring-emerald-500/30',
    progress: 'bg-emerald-500',
  },
  intermediate: {
    bg: 'bg-amber-500/12',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    ring: 'ring-amber-500/30',
    progress: 'bg-amber-500',
  },
  advanced: {
    bg: 'bg-rose-500/12',
    text: 'text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    ring: 'ring-rose-500/30',
    progress: 'bg-rose-500',
  },
};

export const TOPIC_LABELS: Record<LessonTopic, string> = {
  chords: 'Chords',
  strumming: 'Strumming',
  fingerpicking: 'Fingerpicking',
  scales: 'Scales',
  theory: 'Music Theory',
  techniques: 'Techniques',
  songs: 'Songs',
  rhythm: 'Rhythm',
};

export const TOPIC_ICONS: Record<LessonTopic, string> = {
  chords: '🎸',
  strumming: '🤚',
  fingerpicking: '🤏',
  scales: '🎵',
  theory: '📖',
  techniques: '⚙️',
  songs: '🎶',
  rhythm: '🥁',
};

export interface VideoLesson {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
  durationSeconds: number;
  level: SkillLevel;
  topics: LessonTopic[];
  instructor: string;
  order: number;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  level: SkillLevel;
  lessonIds: string[];
  icon: string;
}

export const VIDEO_LESSONS: VideoLesson[] = [];

export const LEARNING_PATHS: LearningPath[] = [];

export function getLessonById(id: string): VideoLesson | undefined {
  return VIDEO_LESSONS.find((l) => l.id === id);
}

export function getLessonsByPath(pathId: string): VideoLesson[] {
  const path = LEARNING_PATHS.find((p) => p.id === pathId);
  if (!path) return [];
  return path.lessonIds.map(getLessonById).filter(Boolean) as VideoLesson[];
}

export function formatDurationShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getTotalDuration(lessonIds: string[]): number {
  return lessonIds.reduce((sum, id) => {
    const lesson = getLessonById(id);
    return sum + (lesson?.durationSeconds ?? 0);
  }, 0);
}

export function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}
