import type { EmbedThemeConfig } from "@colophony/types";

interface EmbedThemeProviderProps {
  theme: EmbedThemeConfig | null;
  children: React.ReactNode;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function EmbedThemeProvider({
  theme,
  children,
}: EmbedThemeProviderProps) {
  if (!theme) {
    return <>{children}</>;
  }

  const style: React.CSSProperties = {};

  if (theme.primaryColor) {
    (style as Record<string, string>)["--primary"] = hexToHsl(
      theme.primaryColor,
    );
  }
  if (theme.borderRadius) {
    (style as Record<string, string>)["--radius"] = theme.borderRadius;
  }
  if (theme.fontFamily) {
    style.fontFamily = theme.fontFamily;
  }

  return (
    <div
      style={style}
      className={
        theme.darkMode
          ? "dark bg-background text-foreground"
          : "bg-background text-foreground"
      }
    >
      {children}
    </div>
  );
}
