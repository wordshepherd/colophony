"use client";

import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function VerifyEmailSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailSkeleton />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
