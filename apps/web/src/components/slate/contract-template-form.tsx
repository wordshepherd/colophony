"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { MergeFieldDefinition } from "@colophony/types";
import { mergeFieldDefinitionSchema } from "@colophony/types";
import { trpc } from "@/lib/trpc";
import { ContractEditor } from "./contract-editor";
import { MergeFieldManager } from "./merge-field-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
  body: z.string().min(1, "Contract body is required"),
  mergeFields: z.array(mergeFieldDefinitionSchema),
  isDefault: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface ContractTemplateFormProps {
  templateId?: string;
}

export function ContractTemplateForm({
  templateId,
}: ContractTemplateFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const isEdit = !!templateId;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      body: "",
      mergeFields: [],
      isDefault: false,
    },
  });

  const {
    data: template,
    isPending: isLoadingTemplate,
    error: loadError,
  } = trpc.contractTemplates.getById.useQuery(
    { id: templateId! },
    { enabled: isEdit },
  );

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description ?? "",
        body: template.body,
        mergeFields: (template.mergeFields ?? []) as MergeFieldDefinition[],
        isDefault: template.isDefault,
      });
    }
  }, [template, form]);

  const mergeFields = useWatch({ control: form.control, name: "mergeFields" });

  const createMutation = trpc.contractTemplates.create.useMutation({
    onSuccess: (result) => {
      toast.success("Template created");
      utils.contractTemplates.list.invalidate();
      router.push(`/slate/contracts/templates/${result.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.contractTemplates.update.useMutation({
    onSuccess: (result) => {
      toast.success("Template updated");
      utils.contractTemplates.getById.invalidate({ id: templateId! });
      utils.contractTemplates.list.invalidate();
      router.push(`/slate/contracts/templates/${result.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      updateMutation.mutate({
        id: templateId!,
        name: data.name,
        description: data.description || null,
        body: data.body,
        mergeFields: data.mergeFields.length > 0 ? data.mergeFields : null,
        isDefault: data.isDefault,
      });
    } else {
      createMutation.mutate({
        name: data.name,
        description: data.description || undefined,
        body: data.body,
        mergeFields: data.mergeFields.length > 0 ? data.mergeFields : undefined,
        isDefault: data.isDefault,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoadingTemplate) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isEdit && loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Template not found</p>
        <Link href="/slate/contracts/templates">
          <Button variant="link">Back to templates</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={
            isEdit
              ? `/slate/contracts/templates/${templateId}`
              : "/slate/contracts/templates"
          }
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {isEdit ? "Back to template" : "Back to templates"}
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {isEdit ? "Edit Template" : "New Contract Template"}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Standard Contributor Agreement"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A brief description of this template..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Default Template</FormLabel>
                      <FormDescription>
                        Use this template by default when generating contracts
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contract Body</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ContractEditor
                        content={field.value}
                        mergeFields={mergeFields}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Merge Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="mergeFields"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MergeFieldManager
                        fields={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  isEdit
                    ? `/slate/contracts/templates/${templateId}`
                    : "/slate/contracts/templates",
                )
              }
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
