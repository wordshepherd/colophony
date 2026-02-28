"use client";

import { useState, useCallback, useMemo } from "react";

export function useRowSelection<T extends { id: string }>() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((items: T[]) => {
    setSelectedIds((prev) => {
      const allSelected = items.every((item) => prev.has(item.id));
      if (allSelected) {
        return new Set();
      }
      return new Set(items.map((item) => item.id));
    });
  }, []);

  const isAllSelected = useCallback(
    (items: T[]) =>
      items.length > 0 && items.every((i) => selectedIds.has(i.id)),
    [selectedIds],
  );

  const isIndeterminate = useCallback(
    (items: T[]) => {
      const someSelected = items.some((i) => selectedIds.has(i.id));
      const allSelected = items.every((i) => selectedIds.has(i.id));
      return someSelected && !allSelected;
    },
    [selectedIds],
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const count = useMemo(() => selectedIds.size, [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    isAllSelected,
    isIndeterminate,
    clear,
    count,
  };
}
