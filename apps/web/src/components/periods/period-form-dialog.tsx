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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
/**
 * Period data as received from tRPC (dates may be string or Date after serialization).
 */
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
}

/**
 * Local form schema using string dates for datetime-local inputs.
 * Converted to Date objects before submission.
 */
const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
  opensAt: z.string().min(1, "Opens at is required"),
  closesAt: z.string().min(1, "Closes at is required"),
  fee: z.string().optional(),
  maxSubmissions: z.string().optional(),
  formDefinitionId: z.string().optional(),
  blindReviewMode: z.string().optional(),
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
    };

    if (isEdit) {
      updateMutation.mutate({ id: period.id, ...payload });
    } else {
      createMutation.mutate(payload);
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
