import { memo } from 'react';
import { Bookmark, CheckCircle2, Clock, Play } from 'lucide-react';
import type { VideoLesson } from '@/constants/videoLessons';
import { SKILL_LEVEL_LABELS, SKILL_LEVEL_COLORS, TOPIC_LABELS } from '@/constants/videoLessons';

interface LessonCardProps {
  lesson: VideoLesson;
  isBookmarked: boolean;
  isWatched: boolean;
  progress: number;
  onPlay: () => void;
  onToggleBookmark: (e: React.MouseEvent) => void;
  onToggleWatched: (e: React.MouseEvent) => void;
  index?: number;
}

function LessonCardInner({
  lesson,
  isBookmarked,
  isWatched,
  progress,
  onPlay,
  onToggleBookmark,
  onToggleWatched,
}: LessonCardProps) {
  const levelStyle = SKILL_LEVEL_COLORS[lesson.level];
  const thumbnailUrl = `https://img.youtube.com/vi/${lesson.youtubeId}/mqdefault.jpg`;

  return (
    <button
      onClick={onPlay}
      className="group w-full text-left rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.5)] hover:bg-[hsl(var(--bg-elevated)/0.8)] hover:border-[hsl(var(--border-default))] transition-all duration-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.4)] focus:ring-offset-2 focus:ring-offset-[hsl(var(--bg-base))]"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[hsl(var(--bg-surface))] overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={lesson.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="size-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 scale-90 group-hover:scale-100">
            <Play className="size-5 text-white ml-0.5 fill-white" />
          </div>
        </div>

        {/* Duration badge */}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/75 backdrop-blur-sm px-1.5 py-0.5 text-[11px] font-body font-medium text-white/90 tabular-nums">
          {lesson.duration}
        </span>

        {/* Watched badge */}
        {isWatched && (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-emerald-600/90 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-display font-semibold text-white uppercase tracking-wider">
            <CheckCircle2 className="size-3" />
            Watched
          </span>
        )}

        {/* Progress bar */}
        {progress > 0 && progress < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div className="h-full bg-[hsl(var(--color-primary))] transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Skill level badge */}
        <span className={`absolute top-2 right-2 rounded-md border px-1.5 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wider ${levelStyle.badge}`}>
          {SKILL_LEVEL_LABELS[lesson.level]}
        </span>
      </div>

      {/* Content */}
      <div className="p-3.5 space-y-2">
        <h3 className={`font-display text-sm font-bold leading-snug line-clamp-2 ${
          isWatched
            ? 'text-[hsl(var(--text-subtle))]'
            : 'text-[hsl(var(--text-default))] group-hover:text-[hsl(var(--color-primary))]'
        } transition-colors`}>
          {lesson.title}
        </h3>

        <p className="text-xs font-body text-[hsl(var(--text-muted))] line-clamp-2 leading-relaxed">
          {lesson.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {lesson.topics.slice(0, 2).map((topic) => (
              <span
                key={topic}
                className="rounded bg-[hsl(var(--bg-surface))] px-1.5 py-0.5 text-[10px] font-body text-[hsl(var(--text-muted))]"
              >
                {TOPIC_LABELS[topic]}
              </span>
            ))}
            {lesson.topics.length > 2 && (
              <span className="text-[10px] font-body text-[hsl(var(--text-muted)/0.6)]">
                +{lesson.topics.length - 2}
              </span>
            )}
          </div>

          {/* Quick action icons */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span
              role="button"
              tabIndex={0}
              onClick={onToggleBookmark}
              onKeyDown={(e) => { if (e.key === 'Enter') onToggleBookmark(e as any); }}
              className={`size-7 flex items-center justify-center rounded-md transition-colors ${
                isBookmarked
                  ? 'text-[hsl(var(--color-primary))]'
                  : 'text-[hsl(var(--text-muted)/0.4)] hover:text-[hsl(var(--color-primary))]'
              }`}
              aria-label="Bookmark"
            >
              <Bookmark className={`size-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={onToggleWatched}
              onKeyDown={(e) => { if (e.key === 'Enter') onToggleWatched(e as any); }}
              className={`size-7 flex items-center justify-center rounded-md transition-colors ${
                isWatched
                  ? 'text-emerald-400'
                  : 'text-[hsl(var(--text-muted)/0.4)] hover:text-emerald-400'
              }`}
              aria-label="Watched"
            >
              <CheckCircle2 className={`size-3.5 ${isWatched ? 'fill-emerald-500/20' : ''}`} />
            </span>
          </div>
        </div>

        {/* Instructor */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <Clock className="size-3 text-[hsl(var(--text-muted)/0.5)]" />
          <span className="text-[10px] font-body text-[hsl(var(--text-muted)/0.7)]">{lesson.instructor}</span>
        </div>
      </div>
    </button>
  );
}

const LessonCard = memo(LessonCardInner);
export default LessonCard;
