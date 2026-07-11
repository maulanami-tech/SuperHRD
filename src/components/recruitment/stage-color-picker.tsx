"use client";

import { cn } from "@/lib/utils";
import { stageDotClasses, stageColorOptions, type StageColor } from "@/components/pipeline-stage-badge";

interface StageColorPickerProps {
  value: string;
  onChange: (color: StageColor) => void;
}

export function StageColorPicker({ value, onChange }: StageColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {stageColorOptions.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={color}
          className={cn(
            "h-7 w-7 rounded-full ring-2 ring-offset-2 transition-all",
            stageDotClasses[color],
            value === color ? "ring-slate-900" : "ring-transparent"
          )}
        />
      ))}
    </div>
  );
}
