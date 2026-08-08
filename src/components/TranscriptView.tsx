import { CheckCircle, Clock, Edit3 } from "lucide-react";

interface TranscriptViewProps {
  transcripts: { text: string; timestamp: number }[];
  isRecording: boolean;
}

export default function TranscriptView({ transcripts, isRecording }: TranscriptViewProps) {
  if (transcripts.length === 0 && !isRecording) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-foreground/40">
        <Clock className="w-8 h-8" />
        <p className="text-sm">Press the mic button and speak your answer</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {transcripts.map((t, i) => (
        <div
          key={i}
          className="flex items-start gap-2 animate-fade-in p-2 rounded-lg bg-muted/50"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-foreground/80">{t.text}</p>
        </div>
      ))}
      {isRecording && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <Edit3 className="w-4 h-4 text-primary shrink-0 animate-pulse" />
          <p className="text-sm leading-relaxed text-foreground/70 animate-pulse">
            Listening...
          </p>
        </div>
      )}
    </div>
  );
}