"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
/**
 * Period data as received from tRPC (dates may be string or Date after serialization).
 */
const SIM_SUB_POLICY_TYPES = [
  { value: "allowed", label: "Allowed" },
  { value: "prohibited", label: "Prohibited" },
  { value: "allowed_notify", label: "Allowed (Notify)" },
  { value: "allowed_withdraw", label: "Allowed (Withdraw)" },
] as const;

const GENRES = [
  { value: "poetry", label: "Poetry" },
  { value: "fiction", label: "Fiction" },
  { value: "creative_nonfiction", label: "Creative Nonfiction" },
  { value: "nonfiction", label: "Nonfiction" },
  { value: "drama", label: "Drama" },
  { value: "translation", label: "Translation" },
  { value: "visual_art", label: "Visual Art" },
  { value: "comics", label: "Comics" },
  { value: "audio", label: "Audio" },
  { value: "other", label: "Other" },
] as const;

interface PeriodData {
  id: string;
  name: string;
  description: string | null;
  opensAt: Date | string;
  closesAt: Date | string;
  fee: number | null;
  maxSubmissions: number | null;
  formDefinitionId: string | null;
  blindReviewMode?: string;
  isContest?: boolean;
  contestPrize?: string | null;
  contestWinnersAnnouncedAt?: Date | string | null;
  simSubPolicy?: {
    type: string;
    notifyWindowHours?: number;
    genreOverrides?: Array<{ genre: string; type: string }>;
    notes?: string;
  };
}

/**
 * Local form schema using string dates for datetime-local inputs.
 * Converted to Date objects before submission.
 */
const genreOverrideSchema = z.object({
  genre: z.string().min(1),
  type: z.string().min(1),
});

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
  opensAt: z.string().min(1, "Opens at is required"),
  closesAt: z.string().min(1, "Closes at is required"),
  fee: z.string().optional(),
  maxSubmissions: z.string().optional(),
  formDefinitionId: z.string().optional(),
  blindReviewMode: z.string().optional(),
  isContest: z.boolean().optional(),
  contestPrize: z.string().max(500).optional(),
  contestWinnersAnnouncedAt: z.string().optional(),
  simSubPolicyType: z.string().optional(),
  simSubNotifyWindowHours: z.string().optional(),
  simSubGenreOverrides: z.array(genreOverrideSchema).optional(),
  simSubNotes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof formSchema>;

function toDatetimeLocal(date: Date): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

interface PeriodFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: PeriodData;
}

export function PeriodFormDialog({
  open,
  onOpenChange,
  period,
}: PeriodFormDialogProps) {
  const utils = trpc.useUtils();
  const isEdit = !!period;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      opensAt: "",
      closesAt: "",
      fee: "",
      maxSubmissions: "",
      formDefinitionId: "__none__",
      blindReviewMode: "none",
      isContest: false,
      contestPrize: "",
      contestWinnersAnnouncedAt: "",
      simSubPolicyType: "allowed",
      simSubNotifyWindowHours: "",
      simSubGenreOverrides: [],
      simSubNotes: "",
    },
  });

  useEffect(() => {
    if (open && period) {
      form.reset({
        name: period.name,
        description: period.description ?? "",
        opensAt: toDatetimeLocal(new Date(period.opensAt)),
        closesAt: toDatetimeLocal(new Date(period.closesAt)),
        fee: period.fee != null ? String(period.fee) : "",
        maxSubmissions:
          period.maxSubmissions != null ? String(period.maxSubmissions) : "",
        formDefinitionId: period.formDefinitionId ?? "__none__",
        blindReviewMode: period.blindReviewMode ?? "none",
        isContest: period.isContest ?? false,
        contestPrize: period.contestPrize ?? "",
        contestWinnersAnnouncedAt: period.contestWinnersAnnouncedAt
          ? toDatetimeLocal(new Date(period.contestWinnersAnnouncedAt))
          : "",
        simSubPolicyType: period.simSubPolicy?.type ?? "allowed",
        simSubNotifyWindowHours:
          period.simSubPolicy?.notifyWindowHours != null
            ? String(period.simSubPolicy.notifyWindowHours)
            : "",
        simSubGenreOverrides: period.simSubPolicy?.genreOverrides ?? [],
        simSubNotes: period.simSubPolicy?.notes ?? "",
      });
    } else if (open) {
      form.reset({
        name: "",
        description: "",
        opensAt: "",
        closesAt: "",
        fee: "",
        maxSubmissions: "",
        formDefinitionId: "__none__",
        blindReviewMode: "none",
        isContest: false,
        contestPrize: "",
        contestWinnersAnnouncedAt: "",
        simSubPolicyType: "allowed",
        simSubNotifyWindowHours: "",
        simSubGenreOverrides: [],
        simSubNotes: "",
      });
    }
  }, [open, period, form]);

  const formsQuery = trpc.forms.list.useQuery(
    { status: "PUBLISHED", page: 1, limit: 100 },
    { enabled: open },
  );

  const createMutation = trpc.periods.create.useMutation({
    onSuccess: () => {
      utils.periods.list.invalidate();
      toast.success("Period created");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.periods.update.useMutation({
    onSuccess: () => {
      utils.periods.list.invalidate();
      toast.success("Period updated");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: FormData) => {
    // Build sim-sub policy object — Zod validates on tRPC boundary
    const policyType = data.simSubPolicyType ?? "allowed";
    const simSubPolicy = {
      type: policyType,
      ...((policyType === "allowed_notify" ||
        policyType === "allowed_withdraw") &&
        data.simSubNotifyWindowHours && {
          notifyWindowHours: Number(data.simSubNotifyWindowHours),
        }),
      ...((data.simSubGenreOverrides?.length ?? 0) > 0 && {
        genreOverrides: data.simSubGenreOverrides,
      }),
      ...(data.simSubNotes && { notes: data.simSubNotes }),
    } as {
      type: "prohibited" | "allowed" | "allowed_notify" | "allowed_withdraw";
      notifyWindowHours?: number;
      genreOverrides?: Array<{ genre: string; type: string }>;
      notes?: string;
    };

    const payload = {
      name: data.name,
      description: data.description || undefined,
      opensAt: new Date(data.opensAt),
      closesAt: new Date(data.closesAt),
      fee: data.fee ? Number(data.fee) : undefined,
      maxSubmissions: data.maxSubmissions
        ? Number(data.maxSubmissions)
        : undefined,
      formDefinitionId:
        data.formDefinitionId && data.formDefinitionId !== "__none__"
          ? data.formDefinitionId
          : undefined,
      blindReviewMode:
        data.blindReviewMode && data.blindReviewMode !== "none"
          ? (data.blindReviewMode as "single_blind" | "double_blind")
          : undefined,
      isContest: data.isContest || undefined,
      contestPrize:
        data.isContest && data.contestPrize ? data.contestPrize : undefined,
      contestWinnersAnnouncedAt:
        data.isContest && data.contestWinnersAnnouncedAt
          ? new Date(data.contestWinnersAnnouncedAt)
          : undefined,
      simSubPolicy,
    };

    if (isEdit) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateMutation.mutate({ id: period.id, ...payload } as any);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createMutation.mutate(payload as any);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Period" : "Create Period"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the submission period details."
              : "Create a new submission period for your organization."}
          </DialogDescription>
        </DialogHeader>
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
                      placeholder="Spring 2026 Reading Period"
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
                      placeholder="Optional description..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="opensAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opens At</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="closesAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Closes At</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxSubmissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Submissions</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Unlimited"
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
              name="formDefinitionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Form (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No form" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {formsQuery.data?.items.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
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
              name="blindReviewMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blind Review</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="single_blind">Single Blind</SelectItem>
                      <SelectItem value="double_blind">Double Blind</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sim-Sub Policy */}
            <FormField
              control={form.control}
              name="simSubPolicyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Simultaneous Submission Policy</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Allowed" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SIM_SUB_POLICY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(form.watch("simSubPolicyType") === "allowed_notify" ||
              form.watch("simSubPolicyType") === "allowed_withdraw") && (
              <FormField
                control={form.control}
                name="simSubNotifyWindowHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notification Window (hours)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 48"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch("simSubPolicyType") !== "allowed" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Genre Overrides</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const current =
                        form.getValues("simSubGenreOverrides") ?? [];
                      form.setValue("simSubGenreOverrides", [
                        ...current,
                        { genre: "", type: "allowed" },
                      ]);
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Override
                  </Button>
                </div>
                {(form.watch("simSubGenreOverrides") ?? []).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={form.watch(`simSubGenreOverrides.${idx}.genre`)}
                      onValueChange={(v) =>
                        form.setValue(`simSubGenreOverrides.${idx}.genre`, v)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRES.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={form.watch(`simSubGenreOverrides.${idx}.type`)}
                      onValueChange={(v) =>
                        form.setValue(`simSubGenreOverrides.${idx}.type`, v)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Policy" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIM_SUB_POLICY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const current =
                          form.getValues("simSubGenreOverrides") ?? [];
                        form.setValue(
                          "simSubGenreOverrides",
                          current.filter((_, i) => i !== idx),
                        );
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <FormField
              control={form.control}
              name="simSubNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sim-Sub Policy Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about your sim-sub policy..."
                      rows={2}
                      maxLength={1000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isContest"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>This is a contest</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {form.watch("isContest") && (
              <div className="space-y-4 rounded-md border p-4">
                <FormField
                  control={form.control}
                  name="contestPrize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prize</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="$500 and publication"
                          maxLength={500}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contestWinnersAnnouncedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Winners Announced</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Period"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
