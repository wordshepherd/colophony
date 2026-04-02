"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Intersection Observer hook for scroll-triggered animations.
 * Returns a ref to attach to the target element and a boolean indicating visibility.
 * Once triggered, stays true (no repeat animations).
 */
export function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(element);
        }
      },
      { threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}
