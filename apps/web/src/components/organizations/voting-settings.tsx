"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { votingConfigSchema } from "@colophony/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  votingEnabled: z.boolean(),
  scoringEnabled: z.boolean(),
  scoreMin: z.coerce.number().int().min(0),
  scoreMax: z.coerce.number().int().min(1),
});

type FormData = z.infer<typeof formSchema>;

export function VotingSettings() {
  const { isAdmin } = useOrganization();
  const utils = trpc.useUtils();

  const { data: org } = trpc.organizations.get.useQuery();

  const votingConfig = votingConfigSchema.parse(
    (org?.settings as Record<string, unknown>) ?? {},
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      votingEnabled: false,
      scoringEnabled: false,
      scoreMin: 1,
      scoreMax: 10,
    },
  });

  useEffect(() => {
    if (org) {
      form.reset({
        votingEnabled: votingConfig.votingEnabled,
        scoringEnabled: votingConfig.scoringEnabled,
        scoreMin: votingConfig.scoreMin,
        scoreMax: votingConfig.scoreMax,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const updateMutation = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.get.invalidate();
      toast.success("Voting settings updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onSubmit = (data: FormData) => {
    const currentSettings = (org?.settings as Record<string, unknown>) ?? {};
    updateMutation.mutate({
      settings: {
        ...currentSettings,
        votingEnabled: data.votingEnabled,
        scoringEnabled: data.scoringEnabled,
        scoreMin: data.scoreMin,
        scoreMax: data.scoreMax,
      },
    });
  };

  const watchVotingEnabled = form.watch("votingEnabled");

  if (!isAdmin) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          <span className="font-medium">Voting:</span>{" "}
          {votingConfig.votingEnabled ? "Enabled" : "Disabled"}
        </p>
        {votingConfig.votingEnabled && (
          <>
            <p>
              <span className="font-medium">Scoring:</span>{" "}
              {votingConfig.scoringEnabled ? "Enabled" : "Disabled"}
            </p>
            {votingConfig.scoringEnabled && (
              <p>
                <span className="font-medium">Score range:</span>{" "}
                {votingConfig.scoreMin}–{votingConfig.scoreMax}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="votingEnabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Enable Voting</FormLabel>
                <FormDescription>
                  Allow reviewers and editors to vote on submissions.
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

        <FormField
          control={form.control}
          name="scoringEnabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Enable Scoring</FormLabel>
                <FormDescription>
                  Allow voters to attach a numeric score to their vote.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!watchVotingEnabled}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <FormField
            control={form.control}
            name="scoreMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Score</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    className="w-24"
                    disabled={!watchVotingEnabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="scoreMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Score</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    className="w-24"
                    disabled={!watchVotingEnabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Voting Settings
        </Button>
      </form>
    </Form>
  );
}
