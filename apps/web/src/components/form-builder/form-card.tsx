"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormStatusBadge } from "./form-status-badge";
import {
  MoreHorizontal,
  Copy,
  Archive,
  Trash2,
  Send,
  Pencil,
} from "lucide-react";
import type { FormStatus } from "@colophony/types";

interface FormCardProps {
  form: {
    id: string;
    name: string;
    description: string | null;
    status: FormStatus;
    version: number;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  fieldCount?: number;
  onPublish?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function FormCard({
  form,
  fieldCount,
  onPublish,
  onArchive,
  onDuplicate,
  onDelete,
}: FormCardProps) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/editor/forms/${form.id}`} className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2 hover:underline cursor-pointer">
              {form.name}
            </CardTitle>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <FormStatusBadge status={form.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/editor/forms/${form.id}`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                {form.status === "DRAFT" && onPublish && (
                  <DropdownMenuItem onClick={() => onPublish(form.id)}>
                    <Send className="mr-2 h-4 w-4" />
                    Publish
                  </DropdownMenuItem>
                )}
                {form.status === "PUBLISHED" && onArchive && (
                  <DropdownMenuItem onClick={() => onArchive(form.id)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(form.id)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {form.status === "DRAFT" && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(form.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {form.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {form.description}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {fieldCount !== undefined && (
            <span>
              {fieldCount} {fieldCount === 1 ? "field" : "fields"}
            </span>
          )}
          <span>v{form.version}</span>
          <span>
            Updated{" "}
            {formatDistanceToNow(new Date(form.updatedAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
