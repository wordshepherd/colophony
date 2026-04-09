"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { useLogotypeMorph } from "@/hooks/use-logotype-morph";

interface LogotypeMorphProps {
  heroSlotRef: RefObject<HTMLDivElement | null>;
  headerSlotRef: RefObject<HTMLDivElement | null>;
}

export function LogotypeMorph({
  heroSlotRef,
  headerSlotRef,
}: LogotypeMorphProps) {
  const { style, isLocked } = useLogotypeMorph(heroSlotRef, headerSlotRef);

  if (!style) return null;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-position animated element; Next Image doesn't support dynamic inline sizing
    <img
      src="/logos/logotype-dark.svg"
      alt="Colophony"
      style={{
        position: style.position,
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
        willChange: style.willChange,
      }}
    />
  );

  if (isLocked) {
    return (
      <Link
        href="/"
        aria-label="Colophony home"
        style={{
          position: "fixed",
          left: style.left,
          top: style.top,
          width: style.width,
          height: style.height,
          zIndex: style.zIndex,
          display: "block",
        }}
      >
        {img}
      </Link>
    );
  }

  return img;
}
