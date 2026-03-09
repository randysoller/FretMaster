import { motion } from 'framer-motion';
import { X, Bookmark, CheckCircle2, Clock, User, Tag } from 'lucide-react';
import type { VideoLesson } from '@/constants/videoLessons';
import { SKILL_LEVEL_LABELS, SKILL_LEVEL_COLORS, TOPIC_LABELS } from '@/constants/videoLessons';

interface VideoPlayerModalProps {
  lesson: VideoLesson;
  isBookmarked: boolean;
  isWatched: boolean;
  onToggleBookmark: () => void;
  onToggleWatched: () => void;
  onClose: () => void;
}

export default function VideoPlayerModal({
  lesson,
  isBookmarked,
  isWatched,
  onToggleBookmark,
  onToggleWatched,
  onClose,
}: VideoPlayerModalProps) {
  const levelStyle = SKILL_LEVEL_COLORS[lesson.level];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[90] flex items-start sm:items-center justify-center px-0 sm:px-4 pt-0 sm:pt-4 pb-0 sm:pb-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-4xl rounded-none sm:rounded-2xl border-0 sm:border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-base))] shadow-2xl overflow-hidden"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 size-9 flex items-center justify-center rounded-full bg-black/60 text-white/90 hover:bg-black/80 hover:text-white transition-colors backdrop-blur-sm"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {/* YouTube Embed */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={`https://www.youtube.com/embed/${lesson.youtubeId}?rel=0&modestbranding=1&autoplay=1`}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Lesson Info */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Title & Actions Row */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[hsl(var(--text-default))] leading-snug">
                {lesson.title}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-wider ${levelStyle.badge}`}>
                  {SKILL_LEVEL_LABELS[lesson.level]}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-body text-[hsl(var(--text-muted))]">
                  <Clock className="size-3" />
                  {lesson.duration}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-body text-[hsl(var(--text-muted))]">
                  <User className="size-3" />
                  {lesson.instructor}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onToggleBookmark}
                className={`size-10 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${
                  isBookmarked
                    ? 'bg-[hsl(var(--color-primary)/0.15)] border-[hsl(var(--color-primary)/0.4)] text-[hsl(var(--color-primary))]'
                    : 'border-[hsl(var(--border-default))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:border-[hsl(var(--color-primary)/0.3)]'
                }`}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              >
                <Bookmark className={`size-4.5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={onToggleWatched}
                className={`size-10 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${
                  isWatched
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'border-[hsl(var(--border-default))] text-[hsl(var(--text-muted))] hover:text-emerald-400 hover:border-emerald-500/30'
                }`}
                aria-label={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
              >
                <CheckCircle2 className={`size-4.5 ${isWatched ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm font-body text-[hsl(var(--text-subtle))] leading-relaxed">
            {lesson.description}
          </p>

          {/* Topics */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="size-3.5 text-[hsl(var(--text-muted))]" />
            {lesson.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-md bg-[hsl(var(--bg-surface))] px-2 py-0.5 text-[11px] font-body font-medium text-[hsl(var(--text-muted))]"
              >
                {TOPIC_LABELS[topic]}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
