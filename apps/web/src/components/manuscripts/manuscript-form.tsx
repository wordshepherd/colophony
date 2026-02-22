"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ManuscriptFormProps {
  mode: "create" | "edit";
  manuscriptId?: string;
  onSuccess?: (manuscript: { id: string; title: string }) => void;
}

export function ManuscriptForm({
  mode,
  manuscriptId,
  onSuccess,
}: ManuscriptFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const isInline = !!onSuccess;

  // Fetch existing manuscript for edit mode
  const { data: existingManuscript } = trpc.manuscripts.getById.useQuery(
    { id: manuscriptId! },
    { enabled: mode === "edit" && !!manuscriptId },
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  // Populate form in edit mode
  useEffect(() => {
    if (existingManuscript && mode === "edit") {
      form.reset({
        title: existingManuscript.title,
        description: existingManuscript.description ?? "",
      });
    }
  }, [existingManuscript, mode, form]);

  const createMutation = trpc.manuscripts.create.useMutation({
    onSuccess: (data) => {
      toast.success("Manuscript created");
      utils.manuscripts.list.invalidate();
      if (onSuccess) {
        onSuccess({ id: data.id, title: data.title });
      } else {
        router.push(`/manuscripts/${data.id}`);
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const updateMutation = trpc.manuscripts.update.useMutation({
    onSuccess: () => {
      toast.success("Manuscript updated");
      utils.manuscripts.getById.invalidate({ id: manuscriptId! });
      utils.manuscripts.getDetail.invalidate({ id: manuscriptId! });
      utils.manuscripts.list.invalidate();
      if (onSuccess && existingManuscript) {
        onSuccess({
          id: existingManuscript.id,
          title: form.getValues("title"),
        });
      } else {
        router.push(`/manuscripts/${manuscriptId}`);
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const onSubmit = async (data: FormValues) => {
    setError(null);
    if (mode === "create") {
      await createMutation.mutateAsync({
        title: data.title,
        description: data.description || undefined,
      });
    } else if (manuscriptId) {
      await updateMutation.mutateAsync({
        id: manuscriptId,
        data: {
          title: data.title,
          description: data.description || null,
        },
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className={isInline ? "space-y-4" : "space-y-6"}>
      {!isInline && (
        <div>
          <h1 className="text-2xl font-bold">
            {mode === "create" ? "New Manuscript" : "Edit Manuscript"}
          </h1>
          <p className="text-muted-foreground">
            {mode === "create"
              ? "Create a new manuscript to manage your creative work"
              : "Update your manuscript details"}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {isInline ? (
            <>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Manuscript title" {...field} />
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
                        placeholder="Optional description"
                        className="min-h-[60px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {mode === "create" ? "Create" : "Save"}
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Manuscript Details</CardTitle>
                <CardDescription>
                  Provide the details for your manuscript
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter manuscript title"
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
                          placeholder="Optional description of your manuscript"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {!isInline && (
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Manuscript" : "Save Changes"}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
