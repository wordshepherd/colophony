"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormStepperStep {
  id: string;
  title: string;
}

export interface FormStepperProps {
  steps: FormStepperStep[];
  currentStepIndex: number;
  completedStepIndices: Set<number>;
  onStepClick?: (index: number) => void;
  disabled?: boolean;
}

export function FormStepper({
  steps,
  currentStepIndex,
  completedStepIndices,
  onStepClick,
  disabled,
}: FormStepperProps) {
  return (
    <nav role="navigation" aria-label="Form progress" className="w-full">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = completedStepIndices.has(index);
          const isCurrent = index === currentStepIndex;
          const isFuture = !isCompleted && !isCurrent;
          const isClickable =
            !disabled && (isCompleted || isCurrent) && onStepClick;

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center",
                index < steps.length - 1 && "flex-1",
              )}
            >
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={disabled || isFuture}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-disabled={isFuture || disabled}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    isCurrent &&
                      "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
                    isCompleted &&
                      !isCurrent &&
                      "bg-primary text-primary-foreground",
                    isFuture && "bg-muted text-muted-foreground",
                    isClickable && "cursor-pointer hover:opacity-80",
                    (isFuture || disabled) && "cursor-default",
                  )}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </button>
                <span
                  className={cn(
                    "mt-1.5 text-xs text-center max-w-[80px] truncate",
                    isCurrent && "font-medium text-foreground",
                    !isCurrent && "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Connecting line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 mb-5",
                    index < currentStepIndex || isCompleted
                      ? "bg-primary"
                      : "bg-muted",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
