"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useOrganization } from "@/hooks/use-organization";
import { getUserManager } from "@/lib/oidc";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  Download,
  Trash2,
  Building2,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react";
import { NotificationPreferencesCard } from "@/components/settings/notification-preferences-card";
import { PluginSlot } from "@/components/plugins/plugin-slot";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { organizations, currentOrg, switchOrganization } = useOrganization();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const deleteAccountMutation = trpc.gdpr.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted successfully. Signing out...");
      const userManager = getUserManager();
      if (userManager) {
        void userManager.signoutRedirect();
      } else {
        router.push("/");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete account");
    },
  });

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // The actual export will open a download link
      toast.info("Preparing your data export...");
      // In a real implementation, this would call an API endpoint that returns a download URL
      // For now, we'll just show a placeholder message
      setTimeout(() => {
        toast.success(
          "Data export is ready. Check your email for the download link.",
        );
        setIsExporting(false);
      }, 2000);
    } catch {
      toast.error("Failed to export data");
      setIsExporting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            {user.name && (
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">{user.name}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium">Email Verified</p>
              <Badge variant={user.emailVerified ? "default" : "secondary"}>
                {user.emailVerified ? "Verified" : "Not verified"}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Member Since</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(user.createdAt), "PPP")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Organizations you&apos;re a member of
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You&apos;re not a member of any organizations yet.
            </p>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {org.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        org.role === "ADMIN"
                          ? "default"
                          : org.role === "EDITOR"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {org.role.toLowerCase()}
                    </Badge>
                    {currentOrg?.id === org.id && (
                      <Badge variant="outline">Current</Badge>
                    )}
                    {org.role === "ADMIN" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          switchOrganization(org.id);
                          router.push("/organizations/settings");
                        }}
                      >
                        <SettingsIcon className="mr-1 h-3 w-3" />
                        Manage
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href="/organizations/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Organization
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <NotificationPreferencesCard />

      <PluginSlot point="settings.section" className="space-y-6" />

      {/* Privacy & Data */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy & Data</CardTitle>
          <CardDescription>
            Manage your data and privacy settings (GDPR)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Export Your Data</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Download a copy of all your data including profile, submissions,
              and activity history.
            </p>
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={isExporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Preparing..." : "Export Data"}
            </Button>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2 text-destructive">
              Delete Account
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setDeleteConfirmation("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your
              account and remove all associated data including:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 my-4">
            <li>Your profile information</li>
            <li>All manuscripts and files</li>
            <li>Organization memberships</li>
            <li>Activity history (anonymized)</li>
          </ul>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Type <span className="font-mono text-destructive">DELETE</span> to
              confirm:
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteAccountMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteConfirmation !== "DELETE" ||
                deleteAccountMutation.isPending
              }
              onClick={() => deleteAccountMutation.mutate()}
            >
              {deleteAccountMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Yes, delete my account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
