import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, X, Filter, Bookmark, GraduationCap, TrendingUp,
  ChevronRight, RotateCcw, PlayCircle, Plus, Settings, EyeOff, Eye,
} from 'lucide-react';
import { useVideoLessonStore, customToVideoLesson } from '@/stores/videoLessonStore';
import type { CustomVideoLesson } from '@/stores/videoLessonStore';
import {
  VIDEO_LESSONS, LEARNING_PATHS,
  SKILL_LEVEL_LABELS, SKILL_LEVEL_COLORS,
  TOPIC_LABELS, TOPIC_ICONS,
  getTotalDuration, formatTotalDuration,
} from '@/constants/videoLessons';
import type { SkillLevel, LessonTopic, VideoLesson } from '@/constants/videoLessons';
import LessonCard from '@/components/features/LessonCard';
import AddVideoModal from '@/components/features/AddVideoModal';

const ALL_LEVELS: (SkillLevel | 'all')[] = ['all', 'beginner', 'intermediate', 'advanced'];
const ALL_TOPICS: LessonTopic[] = ['chords', 'strumming', 'fingerpicking', 'scales', 'theory', 'techniques', 'songs', 'rhythm'];

export default function VideoLessons() {
  const store = useVideoLessonStore();
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CustomVideoLesson | null>(null);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);

  // Build complete lesson list: visible defaults + custom lessons
  const allLessons = useMemo(() => {
    const hiddenSet = new Set(store.hiddenDefaultIds);
    const visibleDefaults = VIDEO_LESSONS.filter((l) => !hiddenSet.has(l.id));
    const converted = store.customLessons.map(customToVideoLesson);
    return [...visibleDefaults, ...converted];
  }, [store.hiddenDefaultIds, store.customLessons]);

  const customIdSet = useMemo(() => new Set(store.customLessons.map((c) => c.id)), [store.customLessons]);

  // Compute learning path progress
  const pathProgress = useMemo(() => {
    const map: Record<string, { watched: number; total: number; pct: number }> = {};
    for (const path of LEARNING_PATHS) {
      const total = path.lessonIds.length;
      const watched = path.lessonIds.filter((id) => store.watchedIds.includes(id)).length;
      map[path.id] = { watched, total, pct: total > 0 ? Math.round((watched / total) * 100) : 0 };
    }
    return map;
  }, [store.watchedIds]);

  // Filter lessons
  const filteredLessons = useMemo(() => {
    let lessons = [...allLessons];

    // Learning path filter
    if (store.activeLearningPathId) {
      const path = LEARNING_PATHS.find((p) => p.id === store.activeLearningPathId);
      if (path) {
        const pathSet = new Set(path.lessonIds);
        lessons = lessons.filter((l) => pathSet.has(l.id));
      }
    }

    if (store.filterLevel !== 'all') {
      lessons = lessons.filter((l) => l.level === store.filterLevel);
    }

    if (store.filterTopics.length > 0) {
      lessons = lessons.filter((l) => l.topics.some((t) => store.filterTopics.includes(t)));
    }

    if (store.showBookmarksOnly) {
      lessons = lessons.filter((l) => store.bookmarkedIds.includes(l.id));
    }

    if (store.searchQuery.trim()) {
      const q = store.searchQuery.toLowerCase();
      lessons = lessons.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.instructor.toLowerCase().includes(q) ||
          l.topics.some((t) => TOPIC_LABELS[t].toLowerCase().includes(q))
      );
    }

    lessons.sort((a, b) => {
      const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
      if (levelOrder[a.level] !== levelOrder[b.level]) return levelOrder[a.level] - levelOrder[b.level];
      return a.order - b.order;
    });

    return lessons;
  }, [allLessons, store.filterLevel, store.filterTopics, store.searchQuery, store.activeLearningPathId, store.showBookmarksOnly, store.bookmarkedIds]);

  const hasActiveFilters = store.filterLevel !== 'all' || store.filterTopics.length > 0 || store.showBookmarksOnly || store.activeLearningPathId !== null || store.searchQuery.trim() !== '';

  const totalWatched = store.watchedIds.length;
  const totalLessons = allLessons.length;

  const handleToggleBookmark = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    store.toggleBookmark(id);
  }, [store]);

  const handleToggleWatched = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    store.toggleWatched(id);
  }, [store]);

  const handleEditCustom = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const lesson = store.customLessons.find((l) => l.id === id);
    if (lesson) setEditingLesson(lesson);
  }, [store.customLessons]);

  const handleDeleteCustom = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this custom video?')) {
      store.deleteCustomLesson(id);
    }
  }, [store]);

  const handleHideDefault = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    store.hideDefaultLesson(id);
  }, [store]);

  const handleSaveVideo = useCallback((data: Omit<CustomVideoLesson, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => {
    if (editingLesson) {
      store.updateCustomLesson(editingLesson.id, data);
      setEditingLesson(null);
    } else {
      store.addCustomLesson(data);
    }
  }, [editingLesson, store]);

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)] pb-20 sm:pb-8">
      <div className="px-4 sm:px-6 py-5 sm:py-8 max-w-7xl mx-auto">

        {/* ─── Hero / Stats ─── */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[hsl(var(--text-default))] flex items-center gap-2.5">
                <PlayCircle className="size-7 sm:size-8 text-[hsl(var(--color-primary))]" />
                Video Lessons
              </h1>
              <p className="mt-1 font-body text-sm text-[hsl(var(--text-muted))]">
                {totalLessons} curated tutorials · {totalWatched} completed
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Manage toggle */}
              <button
                onClick={() => store.setManageMode(!store.isManageMode)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-display font-semibold transition-all ${
                  store.isManageMode
                    ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] ring-1 ring-[hsl(var(--color-primary)/0.3)]'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
                }`}
              >
                <Settings className="size-3.5" />
                <span className="hidden sm:inline">Manage</span>
              </button>

              {/* Overall progress ring */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative size-14 sm:size-16">
                  <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5" className="stroke-[hsl(var(--bg-surface))]" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5"
                      strokeDasharray={`${totalLessons > 0 ? (totalWatched / totalLessons) * 97.4 : 0} 97.4`}
                      strokeLinecap="round"
                      className="stroke-[hsl(var(--color-primary))] transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-display text-xs font-bold text-[hsl(var(--text-default))]">
                    {totalLessons > 0 ? Math.round((totalWatched / totalLessons) * 100) : 0}%
                  </span>
                </div>
                <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">Progress</span>
              </div>
            </div>
          </div>

          {/* ─── Manage Mode: Add Video + Hidden Videos ─── */}
          <AnimatePresence>
            {store.isManageMode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => { setEditingLesson(null); setShowAddModal(true); }}
                    className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.06)] px-4 py-2.5 text-sm font-display font-semibold text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.12)] hover:border-[hsl(var(--color-primary)/0.6)] transition-all active:scale-95"
                  >
                    <Plus className="size-4" />
                    Add YouTube Video
                  </button>

                  {store.hiddenDefaultIds.length > 0 && (
                    <button
                      onClick={() => setShowHiddenPanel(!showHiddenPanel)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-display font-semibold transition-all ${
                        showHiddenPanel
                          ? 'bg-[hsl(var(--bg-overlay))] text-[hsl(var(--text-default))]'
                          : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                      }`}
                    >
                      <EyeOff className="size-3.5" />
                      {store.hiddenDefaultIds.length} Hidden
                    </button>
                  )}

                  <span className="text-[11px] font-body text-[hsl(var(--text-muted)/0.6)] ml-auto">
                    {store.customLessons.length} custom video{store.customLessons.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Hidden videos panel */}
                <AnimatePresence>
                  {showHiddenPanel && store.hiddenDefaultIds.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-4"
                    >
                      <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.4)] p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-display font-semibold text-[hsl(var(--text-subtle))]">Hidden Default Videos</span>
                          <button
                            onClick={() => { store.hiddenDefaultIds.forEach((id) => store.unhideDefaultLesson(id)); }}
                            className="text-[10px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] transition-colors underline underline-offset-2"
                          >
                            Restore all
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {store.hiddenDefaultIds.map((id) => {
                            const lesson = VIDEO_LESSONS.find((l) => l.id === id);
                            if (!lesson) return null;
                            return (
                              <button
                                key={id}
                                onClick={() => store.unhideDefaultLesson(id)}
                                className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))] px-2.5 py-1.5 text-[11px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:border-[hsl(var(--border-default))] transition-colors group/hidden"
                              >
                                <Eye className="size-3 opacity-0 group-hover/hidden:opacity-100 transition-opacity text-emerald-400" />
                                <span className="truncate max-w-[180px]">{lesson.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Learning Paths ─── */}
          {LEARNING_PATHS.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LEARNING_PATHS.map((path) => {
              const colors = SKILL_LEVEL_COLORS[path.level];
              const prog = pathProgress[path.id];
              const isActive = store.activeLearningPathId === path.id;

              return (
                <button
                  key={path.id}
                  onClick={() => store.setActiveLearningPath(isActive ? null : path.id)}
                  className={`group text-left rounded-xl border p-4 transition-all duration-200 active:scale-[0.98] ${
                    isActive
                      ? `${colors.bg} border-current ${colors.text} shadow-lg`
                      : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.4)] hover:bg-[hsl(var(--bg-elevated)/0.7)] hover:border-[hsl(var(--border-default))]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-xl leading-none">{path.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-display text-sm font-bold truncate ${isActive ? colors.text : 'text-[hsl(var(--text-default))]'}`}>
                        {path.name}
                      </h3>
                      <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">
                        {path.lessonIds.length} lessons · {formatTotalDuration(getTotalDuration(path.lessonIds))}
                      </span>
                    </div>
                    <ChevronRight className={`size-4 shrink-0 transition-transform ${isActive ? 'rotate-90 ' + colors.text : 'text-[hsl(var(--text-muted)/0.4)] group-hover:text-[hsl(var(--text-muted))]'}`} />
                  </div>
                  <p className="text-[11px] font-body text-[hsl(var(--text-muted))] line-clamp-1 mb-2.5">
                    {path.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--bg-surface))] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colors.progress}`}
                        style={{ width: `${prog.pct}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-display font-bold tabular-nums ${isActive ? colors.text : 'text-[hsl(var(--text-muted))]'}`}>
                      {prog.watched}/{prog.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          )}
        </div>

        {/* ─── Filter Bar ─── */}
        <div className="sticky top-[58px] z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[hsl(var(--bg-base)/0.88)] backdrop-blur-lg border-b border-[hsl(var(--border-subtle))] mb-4">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted)/0.5)]" />
              <input
                type="text"
                value={store.searchQuery}
                onChange={(e) => store.setSearchQuery(e.target.value)}
                placeholder="Search lessons..."
                className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] pl-9 pr-8 py-2 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
              />
              {store.searchQuery && (
                <button
                  onClick={() => store.setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Level pills - desktop */}
            <div className="hidden sm:flex items-center gap-1">
              {ALL_LEVELS.map((level) => {
                const isActive = store.filterLevel === level;
                const style = level !== 'all' ? SKILL_LEVEL_COLORS[level] : null;
                return (
                  <button
                    key={level}
                    onClick={() => store.setFilterLevel(level)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-display font-semibold transition-all ${
                      isActive
                        ? style
                          ? `${style.bg} ${style.text} ring-1 ${style.ring}`
                          : 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] ring-1 ring-[hsl(var(--color-primary)/0.3)]'
                        : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
                    }`}
                  >
                    {level === 'all' ? 'All Levels' : SKILL_LEVEL_LABELS[level]}
                  </button>
                );
              })}
            </div>

            {/* Bookmarks toggle */}
            <button
              onClick={() => store.setShowBookmarksOnly(!store.showBookmarksOnly)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-display font-semibold transition-all ${
                store.showBookmarksOnly
                  ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] ring-1 ring-[hsl(var(--color-primary)/0.3)]'
                  : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
              }`}
            >
              <Bookmark className={`size-3.5 ${store.showBookmarksOnly ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">Saved</span>
              {store.bookmarkedIds.length > 0 && (
                <span className={`text-[10px] tabular-nums px-1 py-0.5 rounded-full ${
                  store.showBookmarksOnly
                    ? 'bg-[hsl(var(--color-primary)/0.2)]'
                    : 'bg-[hsl(var(--bg-surface))]'
                }`}>
                  {store.bookmarkedIds.length}
                </span>
              )}
            </button>

            {/* Filter toggle - mobile */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`sm:hidden flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-display font-semibold transition-all ${
                showFilters || store.filterTopics.length > 0
                  ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]'
                  : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))]'
              }`}
            >
              <Filter className="size-3.5" />
              Filter
            </button>

            {/* Clear all */}
            {hasActiveFilters && (
              <button
                onClick={store.clearAllFilters}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] transition-colors"
              >
                <RotateCcw className="size-3" />
                Clear
              </button>
            )}
          </div>

          {/* Mobile level pills + topic filters (collapsible) */}
          <AnimatePresence>
            {(showFilters || store.filterTopics.length > 0) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1 mt-2.5 sm:hidden overflow-x-auto pb-1 scrollbar-hide">
                  {ALL_LEVELS.map((level) => {
                    const isActive = store.filterLevel === level;
                    const style = level !== 'all' ? SKILL_LEVEL_COLORS[level] : null;
                    return (
                      <button
                        key={level}
                        onClick={() => store.setFilterLevel(level)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-display font-semibold transition-all ${
                          isActive
                            ? style
                              ? `${style.bg} ${style.text}`
                              : 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]'
                            : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))]'
                        }`}
                      >
                        {level === 'all' ? 'All' : SKILL_LEVEL_LABELS[level]}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                  {ALL_TOPICS.map((topic) => {
                    const isActive = store.filterTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        onClick={() => store.toggleFilterTopic(topic)}
                        className={`shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-body font-medium transition-all ${
                          isActive
                            ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] ring-1 ring-[hsl(var(--color-primary)/0.25)]'
                            : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                        }`}
                      >
                        <span className="text-xs">{TOPIC_ICONS[topic]}</span>
                        {TOPIC_LABELS[topic]}
                      </button>
                    );
                  })}
                  {store.filterTopics.length > 0 && (
                    <button
                      onClick={store.clearFilterTopics}
                      className="shrink-0 text-[10px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] px-1.5 transition-colors"
                    >
                      Clear topics
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Always show topics on desktop */}
          <div className="hidden sm:flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {ALL_TOPICS.map((topic) => {
              const isActive = store.filterTopics.includes(topic);
              return (
                <button
                  key={topic}
                  onClick={() => store.toggleFilterTopic(topic)}
                  className={`shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-body font-medium transition-all ${
                    isActive
                      ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] ring-1 ring-[hsl(var(--color-primary)/0.25)]'
                      : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                  }`}
                >
                  <span className="text-xs">{TOPIC_ICONS[topic]}</span>
                  {TOPIC_LABELS[topic]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Active path indicator ─── */}
        {store.activeLearningPathId && LEARNING_PATHS.length > 0 && (() => {
          const path = LEARNING_PATHS.find((p) => p.id === store.activeLearningPathId);
          if (!path) return null;
          const colors = SKILL_LEVEL_COLORS[path.level];
          return (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-4 ${colors.bg} border ${colors.text} border-current/20`}>
              <GraduationCap className="size-4 shrink-0" />
              <span className="text-sm font-display font-semibold flex-1">
                {path.icon} {path.name}
              </span>
              <button
                onClick={() => store.setActiveLearningPath(null)}
                className="text-xs font-body underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
              >
                Show all
              </button>
            </div>
          );
        })()}

        {/* ─── Results count ─── */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-body text-[hsl(var(--text-muted))]">
            {filteredLessons.length} lesson{filteredLessons.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' found' : ''}
          </span>
          {store.showBookmarksOnly && store.bookmarkedIds.length === 0 && (
            <span className="text-xs font-body text-[hsl(var(--text-muted)/0.6)]">
              Bookmark lessons to see them here
            </span>
          )}
        </div>

        {/* ─── Video Grid ─── */}
        {filteredLessons.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredLessons.map((lesson, index) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                isBookmarked={store.bookmarkedIds.includes(lesson.id)}
                isWatched={store.watchedIds.includes(lesson.id)}
                progress={store.watchProgress[lesson.id] ?? 0}
                isCustom={customIdSet.has(lesson.id)}
                isManageMode={store.isManageMode}
                onPlay={() => window.open(`https://www.youtube.com/watch?v=${lesson.youtubeId}`, '_blank', 'noopener,noreferrer')}
                onToggleBookmark={(e) => handleToggleBookmark(e, lesson.id)}
                onToggleWatched={(e) => handleToggleWatched(e, lesson.id)}
                onEdit={customIdSet.has(lesson.id) ? (e) => handleEditCustom(e, lesson.id) : undefined}
                onDelete={customIdSet.has(lesson.id) ? (e) => handleDeleteCustom(e, lesson.id) : undefined}
                onHide={!customIdSet.has(lesson.id) ? (e) => handleHideDefault(e, lesson.id) : undefined}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <TrendingUp className="size-10 text-[hsl(var(--text-muted)/0.3)]" />
            <p className="font-display text-base font-semibold text-[hsl(var(--text-subtle))]">
              {hasActiveFilters ? 'No lessons match your filters' : 'No video lessons yet'}
            </p>
            <p className="text-xs font-body text-[hsl(var(--text-muted)/0.6)]">
              {hasActiveFilters ? 'Try adjusting your search or filter criteria' : 'Click Manage then Add YouTube Video to start building your lesson library'}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={store.clearAllFilters}
                className="mt-2 rounded-lg border border-[hsl(var(--border-default))] px-4 py-2 text-sm font-body font-medium text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
              >
                Reset filters
              </button>
            ) : (
              <button
                onClick={() => { store.setManageMode(true); setShowAddModal(true); setEditingLesson(null); }}
                className="mt-2 flex items-center gap-2 rounded-xl border-2 border-dashed border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.06)] px-5 py-2.5 text-sm font-display font-semibold text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.12)] hover:border-[hsl(var(--color-primary)/0.6)] transition-all active:scale-95"
              >
                <Plus className="size-4" />
                Add Your First Video
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Add / Edit Video Modal ─── */}
      <AnimatePresence>
        {(showAddModal || editingLesson) && (
          <AddVideoModal
            onSave={handleSaveVideo}
            onClose={() => { setShowAddModal(false); setEditingLesson(null); }}
            editingLesson={editingLesson}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
