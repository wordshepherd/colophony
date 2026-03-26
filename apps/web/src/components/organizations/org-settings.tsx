"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { MemberList } from "./member-list";
import { EmailTemplateSettings } from "./email-template-settings";
import { VotingSettings } from "./voting-settings";
import { WriterStatusSettings } from "./writer-status-settings";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

const nameFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
});

type NameFormData = z.infer<typeof nameFormSchema>;

export function OrgSettings() {
  const { currentOrg, isAdmin } = useOrganization();
  const utils = trpc.useUtils();
  const router = useRouter();
  const [showDeleteOrgDialog, setShowDeleteOrgDialog] = useState(false);
  const [deleteOrgConfirmation, setDeleteOrgConfirmation] = useState("");

  const { data: org, isPending: isLoading } = trpc.organizations.get.useQuery(
    undefined,
    {
      enabled: !!currentOrg,
    },
  );

  const form = useForm<NameFormData>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (org) {
      form.reset({ name: org.name });
    }
  }, [org, form]);

  const updateMutation = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.get.invalidate();
      utils.users.me.invalidate();
      toast.success("Organization updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteOrgMutation = trpc.organizations.delete.useMutation({
    onSuccess: () => {
      toast.success("Organization deleted successfully");
      utils.organizations.list.invalidate();
      utils.users.me.invalidate();
      router.push("/");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete organization");
    },
  });

  const onSubmit = (data: NameFormData) => {
    updateMutation.mutate(data);
  };

  if (!currentOrg) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Organization Settings</h1>
          <p className="text-muted-foreground">
            You don&apos;t have an organization selected.
          </p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">Create Organization</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage settings for {org?.name ?? currentOrg.name}
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
          <TabsTrigger value="voting">Voting</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="writer-status">Writer Status</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Update your organization details."
                  : "Organization details (read-only)."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium mb-1">Slug</p>
                      <p className="text-sm text-muted-foreground">
                        {org?.slug ?? currentOrg.slug}
                      </p>
                    </div>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Changes
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Name</p>
                    <p className="text-sm text-muted-foreground">
                      {org?.name ?? currentOrg.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Slug</p>
                    <p className="text-sm text-muted-foreground">
                      {org?.slug ?? currentOrg.slug}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Manage organization members and their roles."
                  : "Organization members."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemberList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Customize the email notifications sent by your magazine."
                  : "Email notification templates (admin access required to customize)."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailTemplateSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voting" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Voting</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Configure how reviewers and editors vote on submissions."
                  : "Voting configuration for this organization."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VotingSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="writer-status" className="mt-6">
            <WriterStatusSettings />
          </TabsContent>
        )}
      </Tabs>

      {/* Danger Zone — admin only */}
      {isAdmin && (
        <>
          <Separator />
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that permanently affect this organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Delete Organization
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Permanently delete this organization and all its data
                  including submissions, forms, and API keys. This action cannot
                  be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteOrgDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Organization
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={showDeleteOrgDialog}
            onOpenChange={(open) => {
              setShowDeleteOrgDialog(open);
              if (!open) setDeleteOrgConfirmation("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete organization?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete{" "}
                  <span className="font-semibold">
                    {org?.name ?? currentOrg.name}
                  </span>{" "}
                  and all associated data including:
                </DialogDescription>
              </DialogHeader>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 my-4">
                <li>All submissions and submission periods</li>
                <li>All forms and form definitions</li>
                <li>All API keys and embed tokens</li>
                <li>All member associations</li>
                <li>Audit history (anonymized)</li>
              </ul>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Type the organization name{" "}
                  <span className="font-mono text-destructive">
                    {org?.name ?? currentOrg.name}
                  </span>{" "}
                  to confirm:
                </p>
                <Input
                  value={deleteOrgConfirmation}
                  onChange={(e) => setDeleteOrgConfirmation(e.target.value)}
                  placeholder={org?.name ?? currentOrg.name}
                  autoComplete="off"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteOrgDialog(false)}
                  disabled={deleteOrgMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={
                    deleteOrgConfirmation !== (org?.name ?? currentOrg.name) ||
                    deleteOrgMutation.isPending
                  }
                  onClick={() => deleteOrgMutation.mutate()}
                >
                  {deleteOrgMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Yes, delete this organization"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
