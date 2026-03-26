"use client";

import { createContext, useContext } from "react";

export type DensityLevel = "comfortable" | "compact";

interface DensityContextValue {
  density: DensityLevel;
  isCompact: boolean;
  isComfortable: boolean;
}

const COMFORTABLE_DEFAULT: DensityContextValue = {
  density: "comfortable",
  isCompact: false,
  isComfortable: true,
};

const DensityContext = createContext<DensityContextValue>(COMFORTABLE_DEFAULT);

interface DensityProviderProps {
  density: DensityLevel;
  children: React.ReactNode;
}

/**
 * Sets density context for all descendant components.
 * Renders a wrapper div with `data-density` attribute that scopes CSS custom properties.
 * Nesting providers overrides the parent's density (e.g., deep-read mode inside compact shell).
 */
export function DensityProvider({ density, children }: DensityProviderProps) {
  const value: DensityContextValue = {
    density,
    isCompact: density === "compact",
    isComfortable: density === "comfortable",
  };

  return (
    <DensityContext.Provider value={value}>
      <div data-density={density} className="contents">
        {children}
      </div>
    </DensityContext.Provider>
  );
}

/**
 * Read the current density level from the nearest DensityProvider.
 * Returns comfortable defaults when used outside a provider — components
 * render normally without requiring every call site to be wrapped.
 */
export function useDensity(): DensityContextValue {
  return useContext(DensityContext);
}
