import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SkillLevel, LessonTopic, VideoLesson } from '@/constants/videoLessons';

export interface CustomVideoLesson {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  youtubeUrl: string;
  duration: string;
  durationSeconds: number;
  level: SkillLevel;
  topics: LessonTopic[];
  instructor: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

interface VideoLessonState {
  // User tracking
  bookmarkedIds: string[];
  watchedIds: string[];
  watchProgress: Record<string, number>;

  // Filters
  filterLevel: SkillLevel | 'all';
  filterTopics: LessonTopic[];
  searchQuery: string;
  activeLearningPathId: string | null;
  showBookmarksOnly: boolean;

  // Custom video management
  customLessons: CustomVideoLesson[];
  hiddenDefaultIds: string[];
  isManageMode: boolean;

  // Tracking actions
  toggleBookmark: (id: string) => void;
  markWatched: (id: string) => void;
  markUnwatched: (id: string) => void;
  toggleWatched: (id: string) => void;
  setWatchProgress: (id: string, progress: number) => void;

  // Filter actions
  setFilterLevel: (level: SkillLevel | 'all') => void;
  toggleFilterTopic: (topic: LessonTopic) => void;
  clearFilterTopics: () => void;
  setSearchQuery: (q: string) => void;
  setActiveLearningPath: (id: string | null) => void;
  setShowBookmarksOnly: (show: boolean) => void;
  clearAllFilters: () => void;

  // Management actions
  addCustomLesson: (lesson: Omit<CustomVideoLesson, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => void;
  updateCustomLesson: (id: string, updates: Partial<CustomVideoLesson>) => void;
  deleteCustomLesson: (id: string) => void;
  hideDefaultLesson: (id: string) => void;
  unhideDefaultLesson: (id: string) => void;
  setManageMode: (on: boolean) => void;
  reorderCustomLesson: (fromIndex: number, toIndex: number) => void;
}

export const useVideoLessonStore = create<VideoLessonState>()(
  persist(
    (set, get) => ({
      bookmarkedIds: [],
      watchedIds: [],
      watchProgress: {},
      filterLevel: 'all',
      filterTopics: [],
      searchQuery: '',
      activeLearningPathId: null,
      showBookmarksOnly: false,
      customLessons: [],
      hiddenDefaultIds: [],
      isManageMode: false,

      toggleBookmark: (id) =>
        set((s) => ({
          bookmarkedIds: s.bookmarkedIds.includes(id)
            ? s.bookmarkedIds.filter((b) => b !== id)
            : [...s.bookmarkedIds, id],
        })),

      markWatched: (id) =>
        set((s) => ({
          watchedIds: s.watchedIds.includes(id) ? s.watchedIds : [...s.watchedIds, id],
          watchProgress: { ...s.watchProgress, [id]: 100 },
        })),

      markUnwatched: (id) =>
        set((s) => ({
          watchedIds: s.watchedIds.filter((w) => w !== id),
          watchProgress: { ...s.watchProgress, [id]: 0 },
        })),

      toggleWatched: (id) =>
        set((s) => {
          const isWatched = s.watchedIds.includes(id);
          return isWatched
            ? { watchedIds: s.watchedIds.filter((w) => w !== id), watchProgress: { ...s.watchProgress, [id]: 0 } }
            : { watchedIds: [...s.watchedIds, id], watchProgress: { ...s.watchProgress, [id]: 100 } };
        }),

      setWatchProgress: (id, progress) =>
        set((s) => ({
          watchProgress: { ...s.watchProgress, [id]: Math.min(100, Math.max(0, progress)) },
          watchedIds:
            progress >= 100 && !s.watchedIds.includes(id)
              ? [...s.watchedIds, id]
              : s.watchedIds,
        })),

      setFilterLevel: (level) => set({ filterLevel: level }),

      toggleFilterTopic: (topic) =>
        set((s) => ({
          filterTopics: s.filterTopics.includes(topic)
            ? s.filterTopics.filter((t) => t !== topic)
            : [...s.filterTopics, topic],
        })),

      clearFilterTopics: () => set({ filterTopics: [] }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setActiveLearningPath: (id) => set({ activeLearningPathId: id }),
      setShowBookmarksOnly: (show) => set({ showBookmarksOnly: show }),

      clearAllFilters: () =>
        set({
          filterLevel: 'all',
          filterTopics: [],
          searchQuery: '',
          activeLearningPathId: null,
          showBookmarksOnly: false,
        }),

      addCustomLesson: (lesson) => {
        const id = `custom-vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const existing = get().customLessons;
        const order = existing.length > 0 ? Math.max(...existing.map((l) => l.order)) + 1 : 1;
        const newLesson: CustomVideoLesson = {
          ...lesson,
          id,
          order,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ customLessons: [...existing, newLesson] });
        console.log('[FretMaster] Added custom video:', newLesson.title);
      },

      updateCustomLesson: (id, updates) =>
        set((s) => ({
          customLessons: s.customLessons.map((l) =>
            l.id === id ? { ...l, ...updates, updatedAt: Date.now() } : l
          ),
        })),

      deleteCustomLesson: (id) =>
        set((s) => ({
          customLessons: s.customLessons.filter((l) => l.id !== id),
          bookmarkedIds: s.bookmarkedIds.filter((b) => b !== id),
          watchedIds: s.watchedIds.filter((w) => w !== id),
        })),

      hideDefaultLesson: (id) =>
        set((s) => ({
          hiddenDefaultIds: s.hiddenDefaultIds.includes(id)
            ? s.hiddenDefaultIds
            : [...s.hiddenDefaultIds, id],
        })),

      unhideDefaultLesson: (id) =>
        set((s) => ({
          hiddenDefaultIds: s.hiddenDefaultIds.filter((h) => h !== id),
        })),

      setManageMode: (on) => set({ isManageMode: on }),

      reorderCustomLesson: (fromIndex, toIndex) =>
        set((s) => {
          const arr = [...s.customLessons];
          const [moved] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, moved);
          return { customLessons: arr.map((l, i) => ({ ...l, order: i + 1 })) };
        }),
    }),
    {
      name: 'fretmaster-video-lessons',
      partialize: (state) => ({
        bookmarkedIds: state.bookmarkedIds,
        watchedIds: state.watchedIds,
        watchProgress: state.watchProgress,
        customLessons: state.customLessons,
        hiddenDefaultIds: state.hiddenDefaultIds,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...(persisted
          ? {
              bookmarkedIds: persisted.bookmarkedIds ?? [],
              watchedIds: persisted.watchedIds ?? [],
              watchProgress: persisted.watchProgress ?? {},
              customLessons: persisted.customLessons ?? [],
              hiddenDefaultIds: persisted.hiddenDefaultIds ?? [],
            }
          : {}),
      }),
    }
  )
);

/** Extract YouTube video ID from various URL formats */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  // Already a bare ID (11 chars, alphanumeric + dash + underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    const embedMatch = u.pathname.match(/\/(embed|v|shorts)\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[2];
  } catch {
    // Not a valid URL
  }
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/** Convert a CustomVideoLesson to the VideoLesson shape used by components */
export function customToVideoLesson(custom: CustomVideoLesson): VideoLesson {
  return {
    id: custom.id,
    title: custom.title,
    description: custom.description,
    youtubeId: custom.youtubeId,
    duration: custom.duration,
    durationSeconds: custom.durationSeconds,
    level: custom.level,
    topics: custom.topics,
    instructor: custom.instructor,
    order: custom.order,
  };
}
