"use client";

import { useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

const formSchema = z.object({
  publicationId: z.string().uuid("Please select a publication"),
  title: z.string().trim().min(1, "Title is required").max(500),
  volume: z.string().optional(),
  issueNumber: z.string().optional(),
  description: z.string().max(5000).optional(),
  publicationDate: z.string().optional(),
  coverImageUrl: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface IssueFormProps {
  issueId?: string;
}

export function IssueForm({ issueId }: IssueFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const isEdit = !!issueId;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      publicationId: "",
      title: "",
      volume: "",
      issueNumber: "",
      description: "",
      publicationDate: "",
      coverImageUrl: "",
    },
  });

  const { data: publications } = trpc.publications.list.useQuery({
    limit: 100,
  });

  const {
    data: issue,
    isPending: isLoadingIssue,
    error: loadError,
  } = trpc.issues.getById.useQuery({ id: issueId! }, { enabled: isEdit });

  // Pre-populate form in edit mode
  useEffect(() => {
    if (issue) {
      form.reset({
        publicationId: issue.publicationId,
        title: issue.title,
        volume: issue.volume?.toString() ?? "",
        issueNumber: issue.issueNumber?.toString() ?? "",
        description: issue.description ?? "",
        publicationDate: issue.publicationDate
          ? new Date(issue.publicationDate).toISOString().split("T")[0]
          : "",
        coverImageUrl: issue.coverImageUrl ?? "",
      });
    }
  }, [issue, form]);

  const createMutation = trpc.issues.create.useMutation({
    onSuccess: (result) => {
      toast.success("Issue created");
      utils.issues.list.invalidate();
      router.push(`/slate/issues/${result.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.issues.update.useMutation({
    onSuccess: (result) => {
      toast.success("Issue updated");
      utils.issues.getById.invalidate({ id: issueId! });
      utils.issues.list.invalidate();
      router.push(`/slate/issues/${result.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onSubmit = (data: FormData) => {
    const vol = data.volume ? parseInt(data.volume, 10) : undefined;
    const issNum = data.issueNumber
      ? parseInt(data.issueNumber, 10)
      : undefined;
    const payload = {
      publicationId: data.publicationId,
      title: data.title,
      volume: vol && !isNaN(vol) ? vol : undefined,
      issueNumber: issNum && !isNaN(issNum) ? issNum : undefined,
      description: data.description || undefined,
      publicationDate: data.publicationDate
        ? new Date(data.publicationDate)
        : undefined,
      coverImageUrl: data.coverImageUrl || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({
        id: issueId!,
        title: payload.title,
        volume: payload.volume,
        issueNumber: payload.issueNumber,
        description: payload.description,
        publicationDate: payload.publicationDate,
        coverImageUrl: payload.coverImageUrl,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoadingIssue) {
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
        <p className="text-muted-foreground">Issue not found</p>
        <Link href="/slate/issues">
          <Button variant="link">Back to issues</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={isEdit ? `/slate/issues/${issueId}` : "/slate/issues"}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {isEdit ? "Back to issue" : "Back to issues"}
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {isEdit ? "Edit Issue" : "New Issue"}
        </h1>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{isEdit ? "Issue Details" : "Create Issue"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="publicationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publication</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a publication" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {publications?.items.map((pub) => (
                          <SelectItem key={pub.id} value={pub.id}>
                            {pub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Spring 2026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="volume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volume</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1"
                          min={1}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="issueNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Number</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1"
                          min={1}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A brief description of this issue..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publicationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publication Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="coverImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover Image URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
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
                      isEdit ? `/slate/issues/${issueId}` : "/slate/issues",
                    )
                  }
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEdit ? "Save Changes" : "Create Issue"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
