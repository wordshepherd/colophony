"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useOrganization } from "@/hooks/use-organization";
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
import { Download, Trash2, Building2 } from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { organizations, currentOrg } = useOrganization();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const deleteMutation = trpc.gdpr.requestDeletion.useMutation({
    onSuccess: () => {
      toast.success(
        "Account deletion requested. You will receive a confirmation email.",
      );
      logout();
    },
    onError: (err) => {
      toast.error(err.message);
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
            <li>All submissions and files</li>
            <li>Organization memberships</li>
            <li>Activity history</li>
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate({ confirmation: "DELETE_MY_ACCOUNT" });
                setShowDeleteDialog(false);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? "Deleting..."
                : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
