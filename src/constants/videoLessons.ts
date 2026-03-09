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

export const VIDEO_LESSONS: VideoLesson[] = [
  // ── Beginner ──────────────────────────────────────────
  {
    id: 'les-001',
    title: 'Your First Guitar Chords: A, D, E',
    description: 'Learn the three easiest open chords that let you play hundreds of songs. Perfect starting point for absolute beginners.',
    youtubeId: 'nA4Qy3TOyaU',
    duration: '12:34',
    durationSeconds: 754,
    level: 'beginner',
    topics: ['chords'],
    instructor: 'Guitar Fundamentals',
    order: 1,
  },
  {
    id: 'les-002',
    title: 'Basic Strumming Patterns for Beginners',
    description: 'Master the four essential down-up strumming patterns that form the foundation of rhythm guitar playing.',
    youtubeId: 'DrlF4Tc8qC8',
    duration: '10:15',
    durationSeconds: 615,
    level: 'beginner',
    topics: ['strumming', 'rhythm'],
    instructor: 'Guitar Fundamentals',
    order: 2,
  },
  {
    id: 'les-003',
    title: 'G, C, and Em — Expanding Your Chord Vocabulary',
    description: 'Add three more essential open chords to your repertoire. Includes smooth chord transition exercises.',
    youtubeId: 'BBz-Jyr23M4',
    duration: '14:20',
    durationSeconds: 860,
    level: 'beginner',
    topics: ['chords'],
    instructor: 'Guitar Fundamentals',
    order: 3,
  },
  {
    id: 'les-004',
    title: 'How to Read Chord Diagrams',
    description: 'Understand chord chart notation including finger numbers, open strings, muted strings, and barre indicators.',
    youtubeId: 'rgk3BE5VanQ',
    duration: '8:45',
    durationSeconds: 525,
    level: 'beginner',
    topics: ['chords', 'theory'],
    instructor: 'Guitar Fundamentals',
    order: 4,
  },
  {
    id: 'les-005',
    title: 'Your First Song: Easy 3-Chord Songs',
    description: 'Put your chords to work learning five classic songs that only use three chords. Play along with backing tracks.',
    youtubeId: 'I_QxEhPvqGo',
    duration: '18:30',
    durationSeconds: 1110,
    level: 'beginner',
    topics: ['songs', 'chords', 'strumming'],
    instructor: 'Guitar Fundamentals',
    order: 5,
  },
  {
    id: 'les-006',
    title: 'Finger Exercises for Guitar Beginners',
    description: 'Build finger strength, dexterity, and independence with these essential warm-up exercises.',
    youtubeId: 'TSrfBOLFkAY',
    duration: '11:00',
    durationSeconds: 660,
    level: 'beginner',
    topics: ['techniques'],
    instructor: 'Guitar Fundamentals',
    order: 6,
  },
  {
    id: 'les-007',
    title: 'Introduction to Fingerpicking',
    description: 'Learn the Travis picking pattern and basic fingerpicking technique. Gentle introduction to fingerstyle guitar.',
    youtubeId: '4sSMuPfxDjg',
    duration: '15:10',
    durationSeconds: 910,
    level: 'beginner',
    topics: ['fingerpicking'],
    instructor: 'Guitar Fundamentals',
    order: 7,
  },
  {
    id: 'les-008',
    title: 'Understanding Basic Music Rhythm',
    description: 'Learn about time signatures, whole/half/quarter notes, and how to count beats while playing guitar.',
    youtubeId: 'cSFaFKFcFPo',
    duration: '13:25',
    durationSeconds: 805,
    level: 'beginner',
    topics: ['rhythm', 'theory'],
    instructor: 'Guitar Fundamentals',
    order: 8,
  },

  // ── Intermediate ──────────────────────────────────────
  {
    id: 'les-009',
    title: 'Mastering Barre Chords: F and Bm',
    description: 'Conquer the most common barre chord shapes with proper technique, thumb placement, and practice strategies.',
    youtubeId: '0LMm6-KNk5o',
    duration: '16:40',
    durationSeconds: 1000,
    level: 'intermediate',
    topics: ['chords', 'techniques'],
    instructor: 'Fretboard Academy',
    order: 1,
  },
  {
    id: 'les-010',
    title: 'The Minor Pentatonic Scale',
    description: 'Learn all five positions of the minor pentatonic scale and how to use it for soloing and improvisation.',
    youtubeId: 'V2LbKnTMy84',
    duration: '20:15',
    durationSeconds: 1215,
    level: 'intermediate',
    topics: ['scales', 'techniques'],
    instructor: 'Fretboard Academy',
    order: 2,
  },
  {
    id: 'les-011',
    title: 'Intermediate Fingerpicking Patterns',
    description: 'Expand your fingerstyle vocabulary with arpeggio patterns, alternating bass, and classical-inspired techniques.',
    youtubeId: 'yMBhJDkHIjU',
    duration: '17:50',
    durationSeconds: 1070,
    level: 'intermediate',
    topics: ['fingerpicking'],
    instructor: 'Fretboard Academy',
    order: 3,
  },
  {
    id: 'les-012',
    title: 'Hammer-Ons, Pull-Offs, and Slides',
    description: 'Master essential lead guitar techniques for smoother, more expressive playing. Includes practice licks.',
    youtubeId: 'Pzv3MdgPOzA',
    duration: '14:30',
    durationSeconds: 870,
    level: 'intermediate',
    topics: ['techniques'],
    instructor: 'Fretboard Academy',
    order: 4,
  },
  {
    id: 'les-013',
    title: 'Seventh Chords: Maj7, Min7, Dom7',
    description: 'Understand and play seventh chord voicings. Add color and sophistication to your chord progressions.',
    youtubeId: 'OFsJMuPWJkk',
    duration: '19:00',
    durationSeconds: 1140,
    level: 'intermediate',
    topics: ['chords', 'theory'],
    instructor: 'Fretboard Academy',
    order: 5,
  },
  {
    id: 'les-014',
    title: 'Syncopated Strumming and Muting',
    description: 'Add groove and funk to your playing with syncopation, palm muting, and percussive strumming techniques.',
    youtubeId: 'XKRNBp2guoc',
    duration: '13:15',
    durationSeconds: 795,
    level: 'intermediate',
    topics: ['strumming', 'rhythm', 'techniques'],
    instructor: 'Fretboard Academy',
    order: 6,
  },
  {
    id: 'les-015',
    title: 'The Major Scale and Key Signatures',
    description: 'Learn the major scale formula, how keys work, and why certain chords go together in a key.',
    youtubeId: 'QJSgNrvviJc',
    duration: '22:00',
    durationSeconds: 1320,
    level: 'intermediate',
    topics: ['scales', 'theory'],
    instructor: 'Fretboard Academy',
    order: 7,
  },
  {
    id: 'les-016',
    title: 'CAGED System for Guitar',
    description: 'Unlock the fretboard with the CAGED system. Connect chord shapes and scale patterns across all positions.',
    youtubeId: 'UW2uGHRO9R4',
    duration: '25:30',
    durationSeconds: 1530,
    level: 'intermediate',
    topics: ['theory', 'chords', 'scales'],
    instructor: 'Fretboard Academy',
    order: 8,
  },

  // ── Advanced ──────────────────────────────────────────
  {
    id: 'les-017',
    title: 'Jazz Chord Voicings and Extensions',
    description: 'Explore jazz guitar harmony with 9th, 11th, and 13th chord voicings. Drop 2 and Drop 3 voicing systems.',
    youtubeId: 'PwbW6lWfFPo',
    duration: '28:00',
    durationSeconds: 1680,
    level: 'advanced',
    topics: ['chords', 'theory'],
    instructor: 'Advanced Guitar Lab',
    order: 1,
  },
  {
    id: 'les-018',
    title: 'Modes of the Major Scale',
    description: 'Deep dive into Dorian, Mixolydian, Lydian, and other modes. Learn when and how to use each mode effectively.',
    youtubeId: 'bwaeBUYcO5o',
    duration: '24:45',
    durationSeconds: 1485,
    level: 'advanced',
    topics: ['scales', 'theory'],
    instructor: 'Advanced Guitar Lab',
    order: 2,
  },
  {
    id: 'les-019',
    title: 'Advanced Fingerstyle Techniques',
    description: 'Percussive fingerstyle, harmonics, tapping, and hybrid picking for solo guitar arrangements.',
    youtubeId: 'kQKkb_KjSrA',
    duration: '21:30',
    durationSeconds: 1290,
    level: 'advanced',
    topics: ['fingerpicking', 'techniques'],
    instructor: 'Advanced Guitar Lab',
    order: 3,
  },
  {
    id: 'les-020',
    title: 'Improvisation Over Chord Changes',
    description: 'Learn to solo over jazz and blues progressions using chord tones, approach notes, and chromaticism.',
    youtubeId: 'QxxhOVsei7o',
    duration: '26:15',
    durationSeconds: 1575,
    level: 'advanced',
    topics: ['techniques', 'theory', 'scales'],
    instructor: 'Advanced Guitar Lab',
    order: 4,
  },
  {
    id: 'les-021',
    title: 'Complex Rhythm Guitar Patterns',
    description: 'Master odd time signatures, polyrhythms, and advanced syncopation patterns used in progressive and world music.',
    youtubeId: 'RpncLge4JjA',
    duration: '18:20',
    durationSeconds: 1100,
    level: 'advanced',
    topics: ['rhythm', 'techniques'],
    instructor: 'Advanced Guitar Lab',
    order: 5,
  },
  {
    id: 'les-022',
    title: 'Chord Melody Arrangements',
    description: 'Arrange songs as solo guitar pieces combining melody, harmony, and bass lines simultaneously.',
    youtubeId: 'sGkAx2wZcXo',
    duration: '30:00',
    durationSeconds: 1800,
    level: 'advanced',
    topics: ['chords', 'fingerpicking', 'theory'],
    instructor: 'Advanced Guitar Lab',
    order: 6,
  },
  {
    id: 'les-023',
    title: 'Sweep Picking and Arpeggios',
    description: 'Develop sweep picking technique for fluid arpeggio runs. Includes major, minor, and diminished patterns.',
    youtubeId: 'uPzKsHSJDbM',
    duration: '19:45',
    durationSeconds: 1185,
    level: 'advanced',
    topics: ['techniques', 'scales'],
    instructor: 'Advanced Guitar Lab',
    order: 7,
  },
  {
    id: 'les-024',
    title: 'Music Theory for Songwriting',
    description: 'Apply theory to create compelling chord progressions, melodies, and song structures. Secondary dominants and modulation.',
    youtubeId: 'R5nmBe8N9BU',
    duration: '27:00',
    durationSeconds: 1620,
    level: 'advanced',
    topics: ['theory', 'chords'],
    instructor: 'Advanced Guitar Lab',
    order: 8,
  },
];

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'path-beginner',
    name: 'Beginner Fundamentals',
    description: 'Build a solid foundation with open chords, basic strumming, and essential music concepts',
    level: 'beginner',
    lessonIds: ['les-001', 'les-002', 'les-003', 'les-004', 'les-005', 'les-006', 'les-007', 'les-008'],
    icon: '🌱',
  },
  {
    id: 'path-intermediate',
    name: 'Intermediate Techniques',
    description: 'Level up with barre chords, scales, advanced strumming, and fretboard knowledge',
    level: 'intermediate',
    lessonIds: ['les-009', 'les-010', 'les-011', 'les-012', 'les-013', 'les-014', 'les-015', 'les-016'],
    icon: '🔥',
  },
  {
    id: 'path-advanced',
    name: 'Advanced Mastery',
    description: 'Master jazz voicings, modes, improvisation, and professional-level techniques',
    level: 'advanced',
    lessonIds: ['les-017', 'les-018', 'les-019', 'les-020', 'les-021', 'les-022', 'les-023', 'les-024'],
    icon: '⚡',
  },
];

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
