"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const identitySchema = z.object({
  email: z.string().email("Please enter a valid email address").max(255),
  name: z.string().max(255).optional(),
});

type IdentityValues = z.infer<typeof identitySchema>;

interface EmbedIdentityStepProps {
  periodName: string;
  onContinue: (identity: { email: string; name?: string }) => void;
  isLoading: boolean;
}

export function EmbedIdentityStep({
  periodName,
  onContinue,
  isLoading,
}: EmbedIdentityStepProps) {
  const form = useForm<IdentityValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { email: "", name: "" },
  });

  const handleSubmit = form.handleSubmit((values) => {
    onContinue({
      email: values.email,
      name: values.name || undefined,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{periodName}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your information to begin your submission.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your name (optional)"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </form>
      </Form>
    </div>
  );
}
