import { useState, useCallback } from 'react';
import { Copy, Download, Check, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Import raw markdown content
import tunerPromptRaw from '../../TUNER_RECONSTRUCTION_PROMPT.md?raw';
import chordDetectionPromptRaw from '../../CHORD_DETECTION_RECONSTRUCTION_PROMPT.md?raw';
import practicePagePromptRaw from '../../PRACTICE_PAGE_RECONSTRUCTION_PROMPT.md?raw';
import chordPlaybackPromptRaw from '../../CHORD_PLAYBACK_RECONSTRUCTION_PROMPT.md?raw';
import chordLibraryPromptRaw from '../../CHORD_LIBRARY_RECONSTRUCTION_PROMPT.md?raw';
import progressionPracticePromptRaw from '../../PROGRESSION_PRACTICE_RECONSTRUCTION_PROMPT.md?raw';

interface ExportCardProps {
  title: string;
  description: string;
  content: string;
  filename: string;
}

function ExportCard({ title, description, content, filename }: ExportCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  }, [content, filename]);

  const lineCount = content.split('\n').length;
  const charCount = content.length;

  return (
    <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(var(--border-subtle)/0.5)]">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-[hsl(var(--color-primary)/0.1)] shrink-0 mt-0.5">
            <FileText className="size-5 text-[hsl(var(--color-primary))]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-[hsl(var(--text-default))]">{title}</h3>
            <p className="text-sm font-body text-[hsl(var(--text-muted))] mt-0.5 leading-relaxed">{description}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px] font-body text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-surface))] rounded-full px-2 py-0.5">
                {lineCount.toLocaleString()} lines
              </span>
              <span className="text-[11px] font-body text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-surface))] rounded-full px-2 py-0.5">
                {(charCount / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="px-5 py-3 bg-[hsl(var(--bg-surface)/0.3)]">
        <pre className="text-[11px] font-mono text-[hsl(var(--text-muted))] leading-relaxed max-h-[120px] overflow-hidden relative">
          {content.slice(0, 600)}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[hsl(var(--bg-surface)/0.9)] to-transparent" />
        </pre>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 flex gap-2">
        <button
          onClick={handleCopy}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 min-h-[48px] font-display font-bold text-sm transition-all active:scale-[0.97] ${
            copied
              ? 'bg-[hsl(var(--semantic-success)/0.15)] text-[hsl(var(--semantic-success))] border border-[hsl(var(--semantic-success)/0.3)]'
              : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--bg-overlay))]'
          }`}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied!' : 'Copy All'}
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg py-3 min-h-[48px] bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-sm hover:bg-[hsl(var(--color-brand))] active:scale-[0.97] transition-all"
        >
          <Download className="size-4" />
          Download .md
        </button>
      </div>
    </div>
  );
}

export default function ExportPrompts() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-56px)] stage-gradient">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-display font-semibold text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] transition-colors mb-6 min-h-[44px]"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        {/* Page header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-4">
            <Download className="size-3.5 text-[hsl(var(--color-primary))]" />
            <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">Export Center</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight">
            <span className="text-[hsl(var(--text-default))]">Reconstruction </span>
            <span className="text-gradient">Prompts</span>
          </h1>
          <p className="mt-2 text-sm font-body text-[hsl(var(--text-muted))] max-w-md mx-auto">
            Copy or download the full reconstruction prompts to rebuild features in another project.
          </p>
        </div>

        {/* Export cards */}
        <div className="space-y-4">
          <ExportCard
            title="Tuner Reconstruction Prompt"
            description="Complete specification for rebuilding the chromatic guitar tuner with NSDF pitch detection, reference tones, calibration wizard, and React Native migration guide."
            content={tunerPromptRaw}
            filename="TUNER_RECONSTRUCTION_PROMPT.md"
          />
          <ExportCard
            title="Chord Detection Reconstruction Prompt"
            description="Complete specification for the chord detection system: 6-layer voice rejection pipeline, barre chord adaptation, chroma extraction, confusion matrix tracking, session statistics, calibration integration, and Practice page wiring."
            content={chordDetectionPromptRaw}
            filename="CHORD_DETECTION_RECONSTRUCTION_PROMPT.md"
          />
          <ExportCard
            title="Practice Page Reconstruction Prompt"
            description="Complete specification for the Practice page UI: chord diagrams, metronome beat-sync with 5 sound types, strumming patterns (13 styles + custom editor), session summary, calibration wizard, fixed bottom toolbar, and all supporting hooks and stores."
            content={practicePagePromptRaw}
            filename="PRACTICE_PAGE_RECONSTRUCTION_PROMPT.md"
          />
          <ExportCard
            title="Chord Playback System Reconstruction Prompt"
            description="Complete specification for the guitar chord playback system: Web Audio API oscillator synthesis, 3-oscillator pluck model with low-pass filter sweep, reference tone generator with per-string detuning, audio state store with localStorage persistence, volume control UI, and full chord data model."
            content={chordPlaybackPromptRaw}
            filename="CHORD_PLAYBACK_RECONSTRUCTION_PROMPT.md"
          />
          <ExportCard
            title="Chord Library Reconstruction Prompt"
            description="Complete specification for the Chord Library page: 100+ chord browsing grid, multi-axis filtering (category, type, root string, search), preset system with drag-and-drop reordering, chord selection with floating save bar, detail modal with swipe navigation, SVG chord diagrams, tablature display, custom chord integration, and all Zustand stores."
            content={chordLibraryPromptRaw}
            filename="CHORD_LIBRARY_RECONSTRUCTION_PROMPT.md"
          />
          <ExportCard
            title="Progression Practice Reconstruction Prompt"
            description="Complete specification for the Progression Practice page: key selection with circle-of-fifths dropdown, 6 scales, 13 common + 40+ style progressions across 13 genres, favorites system, custom builder, saved progressions, progression timeline, chord diagram row with auto-scroll, microphone detection, metronome beat-sync, strumming patterns, session stats, and confusion matrix."
            content={progressionPracticePromptRaw}
            filename="PROGRESSION_PRACTICE_RECONSTRUCTION_PROMPT.md"
          />
        </div>
      </div>
    </div>
  );
}
