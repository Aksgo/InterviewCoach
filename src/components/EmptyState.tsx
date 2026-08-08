import React from "react";
import { FileText, Upload, Mic, BarChart3 } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  step?: number;
  totalSteps?: number;
}

const stepIcons = [FileText, Upload, Mic, BarChart3];

export default function EmptyState({ title, description, step }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      {step !== undefined && (
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          {React.createElement(stepIcons[step] || FileText, { className: "w-8 h-8 text-primary" })}
        </div>
      )}
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-foreground/60 max-w-sm">{description}</p>
    </div>
  );
}

