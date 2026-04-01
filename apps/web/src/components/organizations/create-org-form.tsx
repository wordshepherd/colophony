"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc, setCurrentOrgId } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { useSlugCheck } from "@/hooks/use-slug-check";
import { slugSchema } from "@colophony/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  slug: slugSchema,
});

type FormData = z.infer<typeof formSchema>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateOrgForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { hasOrganizations } = useOrganization();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", slug: "" },
  });

  const slugValue = form.watch("slug");
  const { isChecking, isAvailable } = useSlugCheck(
    slugValue,
    slugValue.length >= 3,
  );

  const createMutation = trpc.organizations.create.useMutation({
    onSuccess: async (result) => {
      setCurrentOrgId(result.organization.id);
      await utils.users.me.invalidate();
      toast.success("Organization created");
      router.push("/organizations/settings");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create Organization</CardTitle>
        <CardDescription>
          Set up a new organization to manage submissions and publications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Literary Magazine"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!slugManuallyEdited) {
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
                  <FormLabel>URL Slug</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="my-literary-magazine"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setSlugManuallyEdited(true);
                        }}
                      />
                      {slugValue.length >= 3 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isChecking ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : isAvailable === true ? (
                            <Check className="h-4 w-4 text-status-success" />
                          ) : isAvailable === false ? (
                            <X className="h-4 w-4 text-destructive" />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters, numbers, and hyphens. 3-63 characters.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(hasOrganizations ? "/settings" : "/")
                }
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  isAvailable === false ||
                  isChecking
                }
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Organization
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
