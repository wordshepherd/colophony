import {
  Type,
  AlignLeft,
  FileText,
  Hash,
  Mail,
  Link,
  Calendar,
  ChevronDown,
  List,
  Circle,
  CheckSquare,
  ListChecks,
  Upload,
  Heading,
  Info,
} from "lucide-react";
import type { FormFieldType } from "@colophony/types";
import type { LucideIcon } from "lucide-react";

export interface FieldTypeMeta {
  icon: LucideIcon;
  label: string;
  category: FieldCategory;
}

export type FieldCategory = "text" | "choice" | "media" | "layout";

export const FIELD_CATEGORIES: Array<{
  key: FieldCategory;
  label: string;
}> = [
  { key: "text", label: "Text & Numbers" },
  { key: "choice", label: "Choice" },
  { key: "media", label: "Media" },
  { key: "layout", label: "Layout" },
];

export const FIELD_TYPE_META: Record<FormFieldType, FieldTypeMeta> = {
  text: { icon: Type, label: "Short Text", category: "text" },
  textarea: { icon: AlignLeft, label: "Long Text", category: "text" },
  rich_text: { icon: FileText, label: "Rich Text", category: "text" },
  number: { icon: Hash, label: "Number", category: "text" },
  email: { icon: Mail, label: "Email", category: "text" },
  url: { icon: Link, label: "URL", category: "text" },
  date: { icon: Calendar, label: "Date", category: "text" },
  select: { icon: ChevronDown, label: "Dropdown", category: "choice" },
  multi_select: { icon: List, label: "Multi Select", category: "choice" },
  radio: { icon: Circle, label: "Radio", category: "choice" },
  checkbox: { icon: CheckSquare, label: "Checkbox", category: "choice" },
  checkbox_group: {
    icon: ListChecks,
    label: "Checkbox Group",
    category: "choice",
  },
  file_upload: { icon: Upload, label: "File Upload", category: "media" },
  section_header: {
    icon: Heading,
    label: "Section Header",
    category: "layout",
  },
  info_text: { icon: Info, label: "Info Text", category: "layout" },
};
