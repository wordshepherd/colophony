"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useInView } from "@/hooks/use-in-view";

const demoFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  magazine: z.string().min(1, "Magazine name is required"),
  message: z.string().optional(),
});

type DemoFormData = z.infer<typeof demoFormSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function LandingDemoForm() {
  const { ref, isInView } = useInView(0.1);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<DemoFormData>({
    resolver: zodResolver(demoFormSchema),
    defaultValues: {
      name: "",
      email: "",
      magazine: "",
      message: "",
    },
  });

  async function onSubmit(data: DemoFormData) {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/v1/public/demo-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      toast.success("Thank you! We'll be in touch soon.", {
        description: `We received your request for ${data.magazine}.`,
      });
      form.reset();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="demo"
      className="scroll-mt-20 border-t border-border/50 py-24 md:py-32"
    >
      <div
        ref={ref}
        className={`mx-auto max-w-2xl px-6 transition-all duration-700 ease-out lg:px-8 ${
          isInView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            See Colophony in action
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            We&rsquo;d love to walk you through the platform. Tell us about your
            magazine and we&rsquo;ll set up a time.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-12 space-y-6"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your name"
                        className="bg-card"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@magazine.org"
                        className="bg-card"
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
              name="magazine"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Magazine Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="The name of your publication"
                      className="bg-card"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Message{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anything you'd like us to know — your current workflow, what you're looking for, questions you have..."
                      className="min-h-[100px] bg-card"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-base"
            >
              {submitting ? "Sending..." : "Request a Demo"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Or{" "}
              <Link
                href="/demo"
                className="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
              >
                try the demo now
              </Link>{" "}
              &mdash; no account needed.
            </p>
          </form>
        </Form>
      </div>
    </section>
  );
}
