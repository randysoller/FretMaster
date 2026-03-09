import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SkillLevel, LessonTopic } from '@/constants/videoLessons';

interface VideoLessonState {
  bookmarkedIds: string[];
  watchedIds: string[];
  watchProgress: Record<string, number>;
  filterLevel: SkillLevel | 'all';
  filterTopics: LessonTopic[];
  searchQuery: string;
  activeLearningPathId: string | null;
  showBookmarksOnly: boolean;

  toggleBookmark: (id: string) => void;
  markWatched: (id: string) => void;
  markUnwatched: (id: string) => void;
  toggleWatched: (id: string) => void;
  setWatchProgress: (id: string, progress: number) => void;
  setFilterLevel: (level: SkillLevel | 'all') => void;
  toggleFilterTopic: (topic: LessonTopic) => void;
  clearFilterTopics: () => void;
  setSearchQuery: (q: string) => void;
  setActiveLearningPath: (id: string | null) => void;
  setShowBookmarksOnly: (show: boolean) => void;
  clearAllFilters: () => void;
}

export const useVideoLessonStore = create<VideoLessonState>()(
  persist(
    (set) => ({
      bookmarkedIds: [],
      watchedIds: [],
      watchProgress: {},
      filterLevel: 'all',
      filterTopics: [],
      searchQuery: '',
      activeLearningPathId: null,
      showBookmarksOnly: false,

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
    }),
    {
      name: 'fretmaster-video-lessons',
      partialize: (state) => ({
        bookmarkedIds: state.bookmarkedIds,
        watchedIds: state.watchedIds,
        watchProgress: state.watchProgress,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...(persisted
          ? {
              bookmarkedIds: persisted.bookmarkedIds ?? [],
              watchedIds: persisted.watchedIds ?? [],
              watchProgress: persisted.watchProgress ?? {},
            }
          : {}),
      }),
    }
  )
);
