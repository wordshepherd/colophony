"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export function useSlugCheck(slug: string, enabled: boolean) {
  const [debouncedSlug, setDebouncedSlug] = useState(slug);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(slug), 300);
    return () => clearTimeout(timer);
  }, [slug]);

  // Client-side format validation
  const isValidFormat =
    debouncedSlug.length >= 3 &&
    debouncedSlug.length <= 63 &&
    SLUG_REGEX.test(debouncedSlug);

  const { data, isFetching } = trpc.organizations.checkSlug.useQuery(
    { slug: debouncedSlug },
    { enabled: enabled && isValidFormat },
  );

  return {
    isChecking: isFetching,
    isAvailable: isValidFormat ? (data?.available ?? null) : null,
    debouncedSlug,
  };
}
