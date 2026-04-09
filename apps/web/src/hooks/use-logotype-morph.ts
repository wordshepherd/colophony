"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface MorphStyle {
  position: "fixed";
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
  pointerEvents: "none" | "auto";
  willChange: "transform" | "auto";
}

interface MorphResult {
  style: MorphStyle | null;
  isLocked: boolean;
}

const HEADER_HEIGHT = 64;

/**
 * Scroll-driven logotype morph hook.
 * Interpolates a fixed-position element between a hero slot (large, centered)
 * and a header slot (small, left-aligned) based on scroll progress.
 */
export function useLogotypeMorph(
  heroSlotRef: RefObject<HTMLDivElement | null>,
  headerSlotRef: RefObject<HTMLDivElement | null>,
): MorphResult {
  const [style, setStyle] = useState<MorphStyle | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const rafId = useRef<number>(0);

  const update = useCallback(() => {
    const heroSlot = heroSlotRef.current;
    const headerSlot = headerSlotRef.current;
    if (!heroSlot || !headerSlot) return;

    const heroRect = heroSlot.getBoundingClientRect();
    const headerRect = headerSlot.getBoundingClientRect();

    // Progress: 0 when hero slot is fully visible, 1 when its bottom reaches header bottom
    const heroAbsTop = heroRect.top + window.scrollY;
    const heroAbsBottom = heroAbsTop + heroRect.height;
    const start = heroAbsTop - HEADER_HEIGHT;
    const end = heroAbsBottom - HEADER_HEIGHT;
    const range = end - start;

    const progress = range > 0 ? clamp(window.scrollY / range, 0, 1) : 0;
    const eased = easeOutCubic(progress);
    const locked = progress >= 0.99;

    const left = heroRect.left + (headerRect.left - heroRect.left) * eased;
    const top = heroRect.top + (headerRect.top - heroRect.top) * eased;
    const width = heroRect.width + (headerRect.width - heroRect.width) * eased;
    const height =
      heroRect.height + (headerRect.height - heroRect.height) * eased;

    setStyle({
      position: "fixed",
      left,
      top,
      width,
      height,
      zIndex: 51,
      pointerEvents: locked ? "auto" : "none",
      willChange: locked ? "auto" : "transform",
    });
    setIsLocked(locked);
  }, [heroSlotRef, headerSlotRef]);

  useEffect(() => {
    const heroSlot = heroSlotRef.current;
    const headerSlot = headerSlotRef.current;
    if (!heroSlot || !headerSlot) return;

    function onScroll() {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(update);
    }

    // Initial position
    update();

    window.addEventListener("scroll", onScroll, { passive: true });

    // Recalculate on resize
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(update);
    });
    observer.observe(heroSlot);
    observer.observe(headerSlot);

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId.current);
      observer.disconnect();
    };
  }, [heroSlotRef, headerSlotRef, update]);

  return { style, isLocked };
}
