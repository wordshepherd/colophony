"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const EVENT_GROUPS = [
  {
    label: "Submissions",
    events: [
      {
        value: "hopper/submission.submitted",
        label: "Submission Submitted",
      },
      {
        value: "hopper/submission.accepted",
        label: "Submission Accepted",
      },
      {
        value: "hopper/submission.rejected",
        label: "Submission Rejected",
      },
      {
        value: "hopper/submission.withdrawn",
        label: "Submission Withdrawn",
      },
    ],
  },
  {
    label: "Pipeline",
    events: [
      {
        value: "slate/pipeline.copyeditor-assigned",
        label: "Copyeditor Assigned",
      },
      {
        value: "slate/pipeline.copyedit-completed",
        label: "Copyedit Completed",
      },
      {
        value: "slate/pipeline.author-review-completed",
        label: "Author Review Completed",
      },
      {
        value: "slate/pipeline.proofread-completed",
        label: "Proofread Completed",
      },
    ],
  },
  {
    label: "Contracts",
    events: [
      {
        value: "slate/contract.generated",
        label: "Contract Generated",
      },
    ],
  },
  {
    label: "Issues",
    events: [
      {
        value: "slate/issue.published",
        label: "Issue Published",
      },
    ],
  },
] as const;

interface EventTypeSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function EventTypeSelector({ value, onChange }: EventTypeSelectorProps) {
  const toggle = (eventType: string) => {
    if (value.includes(eventType)) {
      onChange(value.filter((v) => v !== eventType));
    } else {
      onChange([...value, eventType]);
    }
  };

  return (
    <div className="space-y-4">
      {EVENT_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            {group.label}
          </p>
          <div className="space-y-2 ml-1">
            {group.events.map((event) => (
              <div key={event.value} className="flex items-center space-x-2">
                <Checkbox
                  id={event.value}
                  checked={value.includes(event.value)}
                  onCheckedChange={() => toggle(event.value)}
                />
                <Label htmlFor={event.value} className="text-sm font-normal">
                  {event.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
