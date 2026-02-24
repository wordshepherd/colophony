"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import {
  cmsAdapterConfig,
  getAdapterConfigFields,
  type ConfigField,
} from "@/lib/cms-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { cmsAdapterTypeValues, type CmsAdapterType } from "@colophony/types";

const baseFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  adapterType: z.enum(cmsAdapterTypeValues),
  publicationId: z.string().uuid().optional().or(z.literal("")),
  isActive: z.boolean(),
  config: z.record(z.string(), z.unknown()),
});

type FormData = z.infer<typeof baseFormSchema>;

interface CmsConnectionFormProps {
  connectionId?: string;
}

export function CmsConnectionForm({ connectionId }: CmsConnectionFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const isEdit = !!connectionId;
  const [visiblePasswords, setVisiblePasswords] = useState<
    Record<string, boolean>
  >({});

  const formSchema = baseFormSchema.superRefine((data, ctx) => {
    const fields = getAdapterConfigFields(data.adapterType);
    for (const field of fields) {
      if (field.required) {
        const val = data.config[field.key];
        if (!val || String(val).trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field.label} is required`,
            path: ["config", field.key],
          });
        }
      }
    }
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      adapterType: "WORDPRESS",
      publicationId: "",
      isActive: true,
      config: {},
    },
  });

  const adapterType = useWatch({ control: form.control, name: "adapterType" });
  const configValues = useWatch({ control: form.control, name: "config" });
  const configFields = getAdapterConfigFields(adapterType as CmsAdapterType);

  const {
    data: connection,
    isPending: isLoadingConnection,
    error: loadError,
  } = trpc.cmsConnections.getById.useQuery(
    { id: connectionId! },
    { enabled: isEdit },
  );

  const { data: publications } = trpc.publications.list.useQuery({
    limit: 100,
  });

  useEffect(() => {
    if (connection) {
      form.reset({
        name: connection.name,
        adapterType: connection.adapterType,
        publicationId: connection.publicationId ?? "",
        isActive: connection.isActive,
        config: connection.config,
      });
    }
  }, [connection, form]);

  const createMutation = trpc.cmsConnections.create.useMutation({
    onSuccess: (result) => {
      toast.success("Connection created");
      utils.cmsConnections.list.invalidate();
      router.push(`/slate/cms/${result.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.cmsConnections.update.useMutation({
    onSuccess: (result) => {
      toast.success("Connection updated");
      utils.cmsConnections.getById.invalidate({ id: connectionId! });
      utils.cmsConnections.list.invalidate();
      router.push(`/slate/cms/${result.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      updateMutation.mutate({
        id: connectionId!,
        name: data.name,
        config: data.config,
        isActive: data.isActive,
      });
    } else {
      createMutation.mutate({
        name: data.name,
        adapterType: data.adapterType,
        publicationId: data.publicationId || undefined,
        config: data.config,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const togglePasswordVisibility = (key: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isEdit && isLoadingConnection) {
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
        <p className="text-muted-foreground">Connection not found</p>
        <Link href="/slate/cms">
          <Button variant="link">Back to connections</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={isEdit ? `/slate/cms/${connectionId}` : "/slate/cms"}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {isEdit ? "Back to connection" : "Back to connections"}
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {isEdit ? "Edit Connection" : "New CMS Connection"}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My WordPress Site" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adapterType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adapter Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select adapter" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(cmsAdapterConfig).map(
                          ([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    {isEdit && (
                      <FormDescription>
                        Adapter type cannot be changed after creation
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publicationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publication</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) =>
                        field.onChange(v === "none" ? "" : v)
                      }
                      disabled={isEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Org-wide (no specific publication)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          Org-wide (no specific publication)
                        </SelectItem>
                        {publications?.items.map((pub) => (
                          <SelectItem key={pub.id} value={pub.id}>
                            {pub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {isEdit
                        ? "Publication cannot be changed after creation"
                        : "Optionally bind this connection to a specific publication"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable or disable this connection
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
              <CardTitle>
                {cmsAdapterConfig[adapterType as CmsAdapterType]?.label ?? ""}{" "}
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {configFields.map((cf: ConfigField) => (
                <div key={cf.key} className="space-y-2">
                  <label className="text-sm font-medium">{cf.label}</label>
                  <div className="relative">
                    <Input
                      type={
                        cf.type === "password" && !visiblePasswords[cf.key]
                          ? "password"
                          : "text"
                      }
                      placeholder={cf.placeholder}
                      value={String(configValues?.[cf.key] ?? "")}
                      onChange={(e) =>
                        form.setValue(`config.${cf.key}`, e.target.value, {
                          shouldDirty: true,
                        })
                      }
                    />
                    {cf.type === "password" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => togglePasswordVisibility(cf.key)}
                      >
                        {visiblePasswords[cf.key] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  {cf.description && (
                    <p className="text-sm text-muted-foreground">
                      {cf.description}
                    </p>
                  )}
                  {form.formState.errors.config?.[cf.key] && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.config[cf.key]?.message as string}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  isEdit ? `/slate/cms/${connectionId}` : "/slate/cms",
                )
              }
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Connection"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
