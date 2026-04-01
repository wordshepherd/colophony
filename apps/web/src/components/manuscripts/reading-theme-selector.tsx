"use client";

import { cn } from "@/lib/utils";
import { useReadingTheme, type ReadingTheme } from "@/hooks/use-reading-theme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const themes: { value: ReadingTheme; label: string; swatch: string }[] = [
  { value: "light", label: "Light", swatch: "bg-[hsl(42_47%_89%)]" },
  { value: "sepia", label: "Sepia", swatch: "bg-[hsl(36_35%_85%)]" },
  { value: "dark", label: "Dark", swatch: "bg-[hsl(230_27%_13%)]" },
];

interface ReadingThemeSelectorProps {
  className?: string;
}

export function ReadingThemeSelector({ className }: ReadingThemeSelectorProps) {
  const { readingTheme, setReadingTheme } = useReadingTheme();

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center gap-1.5", className)}>
        {themes.map(({ value, label, swatch }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setReadingTheme(value)}
                className={cn(
                  "h-5 w-5 rounded-full border transition-shadow",
                  swatch,
                  readingTheme === value
                    ? "ring-2 ring-accent ring-offset-1"
                    : "ring-0 hover:ring-1 hover:ring-muted-foreground/30",
                )}
                aria-label={`${label} reading theme`}
                aria-pressed={readingTheme === value}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
