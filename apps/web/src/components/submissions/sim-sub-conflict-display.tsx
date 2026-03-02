"use client";

import { AlertTriangle, Eye, FileText, Globe, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface SimSubConflict {
  publicationName: string;
  submittedAt: string;
  periodName?: string;
}

interface SiblingVersionConflict {
  versionId: string;
  versionNumber: number;
  submissionId: string;
  publicationName: string;
  status: string;
  submittedAt: string | null;
}

interface WriterDisclosedConflict {
  externalSubmissionId: string;
  journalName: string;
  status: string;
  sentAt: string | null;
}

interface SimSubRemoteResult {
  domain: string;
  status: "checked" | "timeout" | "error" | "unreachable";
  found?: boolean;
  conflicts?: SimSubConflict[];
  durationMs?: number;
}

interface PolicyRequirement {
  type: "notify" | "withdraw";
  windowHours?: number;
  acknowledgedAt?: string;
  dueAt?: string;
}

interface SimSubConflictDisplayProps {
  policyRequirement?: PolicyRequirement | null;
  localConflicts?: SimSubConflict[];
  remoteResults?: SimSubRemoteResult[];
  siblingVersionConflicts?: SiblingVersionConflict[];
  writerDisclosedConflicts?: WriterDisclosedConflict[];
  onAcknowledge?: () => void;
}

export function SimSubConflictDisplay({
  policyRequirement,
  localConflicts = [],
  remoteResults = [],
  siblingVersionConflicts = [],
  writerDisclosedConflicts = [],
  onAcknowledge,
}: SimSubConflictDisplayProps) {
  const remoteConflicts = remoteResults.filter((r) => r.found && r.conflicts);
  const hasAnyConflicts =
    writerDisclosedConflicts.length > 0 ||
    siblingVersionConflicts.length > 0 ||
    localConflicts.length > 0 ||
    remoteConflicts.length > 0;

  if (!hasAnyConflicts && !policyRequirement) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Policy requirement banner */}
      {policyRequirement && !policyRequirement.acknowledgedAt && (
        <Alert
          variant="default"
          className="border-amber-500 bg-amber-50 dark:bg-amber-950/20"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            {policyRequirement.type === "withdraw"
              ? "Withdrawal Required"
              : "Notification Required"}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {policyRequirement.type === "withdraw" ? (
              <>
                This publication requires you to withdraw from other
                publications if your work is accepted elsewhere.
                {policyRequirement.windowHours && (
                  <>
                    {" "}
                    You have {policyRequirement.windowHours} hours to comply.
                  </>
                )}
              </>
            ) : (
              <>
                This publication requires you to notify them if your work is
                accepted elsewhere.
                {policyRequirement.windowHours && (
                  <>
                    {" "}
                    Please notify within {policyRequirement.windowHours} hours.
                  </>
                )}
              </>
            )}
            {policyRequirement.dueAt && (
              <span className="block mt-1 text-xs">
                Due by:{" "}
                {new Date(policyRequirement.dueAt).toLocaleDateString(
                  undefined,
                  { dateStyle: "medium" },
                )}
              </span>
            )}
            {onAcknowledge && (
              <button
                onClick={onAcknowledge}
                className="mt-2 text-sm font-medium underline"
              >
                I acknowledge this requirement
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Writer-disclosed conflicts (highest confidence) */}
      {writerDisclosedConflicts.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Self-Reported Submissions</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {writerDisclosedConflicts.map((c) => (
                <li
                  key={c.externalSubmissionId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Eye className="h-3 w-3 flex-shrink-0" />
                  You indicated this was also submitted to{" "}
                  <span className="font-medium">{c.journalName}</span>
                  <Badge variant="outline" className="text-xs">
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Sibling version conflicts */}
      {siblingVersionConflicts.length > 0 && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>Other Versions Active</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {siblingVersionConflicts.map((c) => (
                <li
                  key={c.submissionId}
                  className="flex items-center gap-2 text-sm"
                >
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  Version {c.versionNumber} is active at{" "}
                  <span className="font-medium">{c.publicationName}</span>
                  <Badge variant="outline" className="text-xs">
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Local fingerprint conflicts */}
      {localConflicts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Detected at Other Publications</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {localConflicts.map((c, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  This work was detected at{" "}
                  <span className="font-medium">{c.publicationName}</span>
                  {c.periodName && (
                    <span className="text-muted-foreground">
                      ({c.periodName})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Federation conflicts (lowest confidence) */}
      {remoteConflicts.length > 0 && (
        <Alert>
          <Globe className="h-4 w-4" />
          <AlertTitle>Federated Instance Reports</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {remoteConflicts.map((r) =>
                r.conflicts?.map((c, idx) => (
                  <li
                    key={`${r.domain}-${idx}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Globe className="h-3 w-3 flex-shrink-0" />A federated
                    instance ({r.domain}) reports a similar work under
                    consideration
                    {c.publicationName !== "Unknown" && (
                      <>
                        {" "}
                        at{" "}
                        <span className="font-medium">{c.publicationName}</span>
                      </>
                    )}
                  </li>
                )),
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
