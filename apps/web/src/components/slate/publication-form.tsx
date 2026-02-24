"use client";

import { useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens",
    ),
  description: z.string().max(2000).optional(),
});

type FormData = z.infer<typeof formSchema>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface PublicationFormProps {
  publicationId?: string;
}

export function PublicationForm({ publicationId }: PublicationFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const isEdit = !!publicationId;
  const slugManuallyEdited = useRef(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", slug: "", description: "" },
  });

  const {
    data: publication,
    isPending: isLoadingPublication,
    error: loadError,
  } = trpc.publications.getById.useQuery(
    { id: publicationId! },
    { enabled: isEdit },
  );

  // Pre-populate form in edit mode
  useEffect(() => {
    if (publication) {
      form.reset({
        name: publication.name,
        slug: publication.slug,
        description: publication.description ?? "",
      });
      slugManuallyEdited.current = true;
    }
  }, [publication, form]);

  const createMutation = trpc.publications.create.useMutation({
    onSuccess: (result) => {
      toast.success("Publication created");
      router.push(`/slate/publications/${result.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.publications.update.useMutation({
    onSuccess: (result) => {
      toast.success("Publication updated");
      utils.publications.getById.invalidate({ id: publicationId! });
      utils.publications.list.invalidate();
      router.push(`/slate/publications/${result.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      updateMutation.mutate({
        id: publicationId!,
        ...data,
        description: data.description || undefined,
      });
    } else {
      createMutation.mutate({
        ...data,
        description: data.description || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoadingPublication) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full max-w-lg" />
      </div>
    );
  }

  if (isEdit && loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Publication not found</p>
        <Link href="/slate/publications">
          <Button variant="link">Back to publications</Button>
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
              ? `/slate/publications/${publicationId}`
              : "/slate/publications"
          }
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {isEdit ? "Back to publication" : "Back to publications"}
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {isEdit ? "Edit Publication" : "New Publication"}
        </h1>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            {isEdit ? "Publication Details" : "Create Publication"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="My Publication"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!slugManuallyEdited.current) {
                            form.setValue("slug", slugify(e.target.value), {
                              shouldValidate: true,
                            });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="my-publication"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          slugManuallyEdited.current = true;
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Lowercase letters, numbers, and hyphens.
                    </p>
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
                        placeholder="A brief description of this publication..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    router.push(
                      isEdit
                        ? `/slate/publications/${publicationId}`
                        : "/slate/publications",
                    )
                  }
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEdit ? "Save Changes" : "Create Publication"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
