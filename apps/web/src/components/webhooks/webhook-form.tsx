"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CreateWebhookEndpointInput } from "@colophony/types";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { EventTypeSelector } from "./event-type-selector";
import { SecretDisplayDialog } from "./secret-display-dialog";

const formSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  description: z.string().max(512).optional(),
  eventTypes: z.array(z.string()).min(1, "Select at least one event type"),
});

type FormValues = z.infer<typeof formSchema>;

export function WebhookForm() {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      description: "",
      eventTypes: [],
    },
  });

  const createMutation = trpc.webhooks.create.useMutation({
    onSuccess: (data) => {
      if (data.secret) {
        setSecret(data.secret);
        setSecretDialogOpen(true);
      } else {
        toast.success("Webhook endpoint created");
        router.push("/webhooks");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values as unknown as CreateWebhookEndpointInput);
  };

  const handleSecretDialogClose = (open: boolean) => {
    setSecretDialogOpen(open);
    if (!open) {
      toast.success("Webhook endpoint created");
      router.push("/webhooks");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>New Webhook Endpoint</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/webhooks"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The HTTPS endpoint that will receive webhook POST requests
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Production webhook for..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Events</FormLabel>
                    <FormControl>
                      <EventTypeSelector
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Webhook
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {secret && (
        <SecretDisplayDialog
          open={secretDialogOpen}
          onOpenChange={handleSecretDialogClose}
          secret={secret}
        />
      )}
    </>
  );
}
