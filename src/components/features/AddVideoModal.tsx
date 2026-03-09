import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Link as LinkIcon, Image, Clock, GraduationCap, Tag, User, Check } from 'lucide-react';
import { extractYoutubeId, type CustomVideoLesson } from '@/stores/videoLessonStore';
import { SKILL_LEVEL_LABELS, SKILL_LEVEL_COLORS, TOPIC_LABELS, TOPIC_ICONS } from '@/constants/videoLessons';
import type { SkillLevel, LessonTopic } from '@/constants/videoLessons';

const ALL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];
const ALL_TOPICS: LessonTopic[] = ['chords', 'strumming', 'fingerpicking', 'scales', 'theory', 'techniques', 'songs', 'rhythm'];

interface AddVideoModalProps {
  onSave: (data: Omit<CustomVideoLesson, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
  editingLesson?: CustomVideoLesson | null;
}

function parseDurationToSeconds(dur: string): number {
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return parts[0] || 0;
}

export default function AddVideoModal({ onSave, onClose, editingLesson }: AddVideoModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState(editingLesson?.youtubeUrl ?? '');
  const [title, setTitle] = useState(editingLesson?.title ?? '');
  const [description, setDescription] = useState(editingLesson?.description ?? '');
  const [duration, setDuration] = useState(editingLesson?.duration ?? '');
  const [level, setLevel] = useState<SkillLevel>(editingLesson?.level ?? 'beginner');
  const [topics, setTopics] = useState<LessonTopic[]>(editingLesson?.topics ?? []);
  const [instructor, setInstructor] = useState(editingLesson?.instructor ?? '');

  const youtubeId = useMemo(() => extractYoutubeId(youtubeUrl), [youtubeUrl]);
  const thumbnailUrl = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : null;

  const isValid = youtubeId && title.trim() && duration.trim();

  const toggleTopic = (t: LessonTopic) => {
    setTopics((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const handleSave = () => {
    if (!youtubeId || !title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      youtubeId,
      youtubeUrl: youtubeUrl.trim(),
      duration: duration.trim() || '0:00',
      durationSeconds: parseDurationToSeconds(duration.trim()),
      level,
      topics: topics.length > 0 ? topics : ['techniques'],
      instructor: instructor.trim() || 'Unknown',
    });
    onClose();
  };

  // Auto-focus URL field
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = document.getElementById('video-url-input');
      if (el) el.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-start sm:items-center justify-center px-4 pt-4 pb-4 overflow-y-auto"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-base))] shadow-2xl overflow-hidden my-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border-subtle))]">
          <h2 className="font-display text-lg font-bold text-[hsl(var(--text-default))]">
            {editingLesson ? 'Edit Video' : 'Add Video'}
          </h2>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* YouTube URL */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-display font-semibold text-[hsl(var(--text-subtle))] mb-1.5">
              <LinkIcon className="size-3.5" />
              YouTube URL
            </label>
            <input
              id="video-url-input"
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
            />
            {youtubeUrl && !youtubeId && (
              <p className="mt-1 text-xs font-body text-[hsl(var(--semantic-error))]">
                Could not detect a YouTube video ID from this URL
              </p>
            )}
          </div>

          {/* Thumbnail preview */}
          {thumbnailUrl && (
            <div className="rounded-lg overflow-hidden border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))]">
              <div className="relative aspect-video">
                <img
                  src={thumbnailUrl}
                  alt="Video thumbnail"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
                  <Image className="size-3 text-emerald-400" />
                  <span className="text-[10px] font-body text-emerald-300">Thumbnail detected</span>
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-sm font-display font-semibold text-[hsl(var(--text-subtle))] mb-1.5 block">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson title..."
              className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-display font-semibold text-[hsl(var(--text-subtle))] mb-1.5 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will the learner gain from this video?"
              rows={2}
              className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors resize-none"
            />
          </div>

          {/* Duration & Instructor row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-display font-semibold text-[hsl(var(--text-subtle))] mb-1.5">
                <Clock className="size-3.5" />
                Duration
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="12:34"
                className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-display font-semibold text-[hsl(var(--text-subtle))] mb-1.5">
                <User className="size-3.5" />
                Instructor
              </label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="Channel or name"
                className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
              />
            </div>
          </div>

          {/* Skill Level */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-display font-semibold text-[hsl(var(--text-subtle))] mb-2">
              <GraduationCap className="size-3.5" />
              Skill Level
            </label>
            <div className="flex gap-2">
              {ALL_LEVELS.map((lvl) => {
                const colors = SKILL_LEVEL_COLORS[lvl];
                const isActive = level === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-display font-semibold transition-all border ${
                      isActive
                        ? `${colors.bg} ${colors.text} border-current`
                        : 'border-[hsl(var(--border-subtle))] text-[hsl(var(--text-muted))] hover:border-[hsl(var(--border-default))] hover:text-[hsl(var(--text-subtle))]'
                    }`}
                  >
                    {SKILL_LEVEL_LABELS[lvl]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-display font-semibold text-[hsl(var(--text-subtle))] mb-2">
              <Tag className="size-3.5" />
              Topics
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TOPICS.map((topic) => {
                const isActive = topics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-body font-medium transition-all border ${
                      isActive
                        ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] border-[hsl(var(--color-primary)/0.3)]'
                        : 'border-[hsl(var(--border-subtle))] text-[hsl(var(--text-muted))] hover:border-[hsl(var(--border-default))] hover:text-[hsl(var(--text-subtle))]'
                    }`}
                  >
                    <span className="text-xs">{TOPIC_ICONS[topic]}</span>
                    {TOPIC_LABELS[topic]}
                    {isActive && <Check className="size-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.3)]">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-display font-semibold text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`rounded-lg px-5 py-2 text-sm font-display font-semibold transition-all ${
              isValid
                ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] hover:brightness-110 active:scale-95'
                : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted)/0.5)] cursor-not-allowed'
            }`}
          >
            {editingLesson ? 'Save Changes' : 'Add Video'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
