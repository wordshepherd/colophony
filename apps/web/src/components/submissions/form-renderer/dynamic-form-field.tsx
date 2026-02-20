"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { FormFieldForRenderer } from "./build-form-schema";

interface DynamicFormFieldProps {
  field: FormFieldForRenderer;
  disabled: boolean;
}

export function DynamicFormField({ field, disabled }: DynamicFormFieldProps) {
  const form = useFormContext();
  const config = (field.config ?? {}) as Record<string, unknown>;
  const options =
    (config.options as Array<{ label: string; value: string }>) ?? [];

  switch (field.fieldType) {
    case "section_header":
      return (
        <div className="pt-4">
          <h3 className="text-lg font-semibold">{field.label}</h3>
          {field.description && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
          <Separator className="mt-2" />
        </div>
      );

    case "info_text":
      return (
        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {field.description ?? field.label}
        </div>
      );

    case "textarea":
    case "rich_text":
      return (
        <FormField
          control={form.control}
          name={`formData.${field.fieldKey}`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              {field.description && (
                <FormDescription>{field.description}</FormDescription>
              )}
              <FormControl>
                <Textarea
                  placeholder={field.placeholder ?? ""}
                  disabled={disabled}
                  rows={4}
                  {...formField}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "select":
      return (
        <FormField
          control={form.control}
          name={`formData.${field.fieldKey}`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              {field.description && (
                <FormDescription>{field.description}</FormDescription>
              )}
              <Select
                onValueChange={formField.onChange}
                value={formField.value}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={field.placeholder ?? "Select..."}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "radio":
      return (
        <FormField
          control={form.control}
          name={`formData.${field.fieldKey}`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              {field.description && (
                <FormDescription>{field.description}</FormDescription>
              )}
              <FormControl>
                <RadioGroup
                  onValueChange={formField.onChange}
                  value={formField.value}
                  disabled={disabled}
                  className="space-y-2"
                >
                  {options.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={opt.value}
                        id={`${field.fieldKey}-${opt.value}`}
                      />
                      <Label
                        htmlFor={`${field.fieldKey}-${opt.value}`}
                        className="font-normal"
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "checkbox":
      return (
        <FormField
          control={form.control}
          name={`formData.${field.fieldKey}`}
          render={({ field: formField }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={formField.value}
                  onCheckedChange={formField.onChange}
                  disabled={disabled}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal">
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </FormLabel>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "multi_select":
    case "checkbox_group":
      return (
        <FormField
          control={form.control}
          name={`formData.${field.fieldKey}`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              {field.description && (
                <FormDescription>{field.description}</FormDescription>
              )}
              <div className="space-y-2">
                {options.map((opt) => {
                  const values: string[] = formField.value ?? [];
                  return (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={values.includes(opt.value)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...values, opt.value]
                            : values.filter((v: string) => v !== opt.value);
                          formField.onChange(next);
                        }}
                        disabled={disabled}
                      />
                      <Label className="font-normal">{opt.label}</Label>
                    </div>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "file_upload":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          <p className="text-sm text-muted-foreground">
            File uploads are handled in the Files section below.
          </p>
        </div>
      );

    default: {
      const inputType =
        field.fieldType === "number"
          ? "number"
          : field.fieldType === "email"
            ? "email"
            : field.fieldType === "url"
              ? "url"
              : field.fieldType === "date"
                ? "date"
                : "text";

      return (
        <FormField
          control={form.control}
          name={`formData.${field.fieldKey}`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              {field.description && (
                <FormDescription>{field.description}</FormDescription>
              )}
              <FormControl>
                <Input
                  type={inputType}
                  placeholder={field.placeholder ?? ""}
                  disabled={disabled}
                  {...formField}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
  }
}
