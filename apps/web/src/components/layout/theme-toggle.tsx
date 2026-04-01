"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const themeConfig = {
  light: { icon: Sun, next: "dark" as const, label: "Light mode" },
  dark: { icon: Moon, next: "system" as const, label: "Dark mode" },
  system: { icon: Monitor, next: "light" as const, label: "System theme" },
} as const;

// SSR-safe mount detection via useSyncExternalStore (avoids setState-in-effect lint)
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Avoid hydration mismatch: render placeholder until mounted
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        data-testid="theme-toggle"
        disabled
      >
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  const config = themeConfig[(theme as keyof typeof themeConfig) ?? "light"];
  const Icon = config.icon;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(config.next)}
            className="h-8 w-8"
            data-testid="theme-toggle"
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">{config.label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{config.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
