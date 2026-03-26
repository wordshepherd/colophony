"use client";

import { useState, useCallback } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { TriageList } from "./triage-list";
import { DetailPane } from "./detail-pane";
import { QueueRail } from "./queue-rail";
import { useShortcuts } from "@/hooks/use-shortcuts";

interface EditorialSplitPaneProps {
  initialId?: string | null;
}

/**
 * Main split pane orchestrator for the editorial reading queue.
 *
 * Two modes:
 * - Triage: 30% list + 70% detail, keyboard j/k navigation
 * - Deep-read: rail + manuscript at comfortable density
 */
export function EditorialSplitPane({ initialId }: EditorialSplitPaneProps) {
  const [mode, setMode] = useState<"triage" | "deep-read">("triage");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialId ?? null,
  );
  const [itemIds, setItemIds] = useState<string[]>([]);

  const handleItemsChange = useCallback((ids: string[]) => {
    setItemIds(ids);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    // Update URL without triggering Next.js re-render
    window.history.replaceState(null, "", `/editor/queue?id=${id}`);
  }, []);

  const selectNext = useCallback(() => {
    if (itemIds.length === 0) return;
    const currentIdx = selectedId ? itemIds.indexOf(selectedId) : -1;
    const nextIdx = Math.min(currentIdx + 1, itemIds.length - 1);
    handleSelect(itemIds[nextIdx]);
  }, [selectedId, handleSelect, itemIds]);

  const selectPrev = useCallback(() => {
    if (itemIds.length === 0) return;
    const currentIdx = selectedId
      ? itemIds.indexOf(selectedId)
      : itemIds.length;
    const prevIdx = Math.max(currentIdx - 1, 0);
    handleSelect(itemIds[prevIdx]);
  }, [selectedId, handleSelect, itemIds]);

  const currentIndex = selectedId ? itemIds.indexOf(selectedId) : -1;
  const totalCount = itemIds.length;

  useShortcuts([
    {
      key: "r",
      handler: () => {
        if (mode === "triage" && selectedId) {
          setMode("deep-read");
        }
      },
      description: "Enter deep-read mode",
      enabled: mode === "triage" && selectedId !== null,
    },
    {
      key: "Escape",
      handler: () => setMode("triage"),
      description: "Return to triage mode",
      enabled: mode === "deep-read",
    },
    {
      key: "j",
      handler: selectNext,
      description: "Select next submission",
    },
    {
      key: "k",
      handler: selectPrev,
      description: "Select previous submission",
    },
  ]);

  if (mode === "deep-read") {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={5} minSize={3} maxSize={12}>
            <QueueRail
              currentIndex={currentIndex >= 0 ? currentIndex : 0}
              totalCount={totalCount}
              onExpand={() => setMode("triage")}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={95}>
            <DetailPane submissionId={selectedId} mode="deep-read" />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
          <TriageList
            selectedId={selectedId}
            onSelect={handleSelect}
            onItemsChange={handleItemsChange}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70}>
          <DetailPane submissionId={selectedId} mode="triage" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
