"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const required = searchParams.get("required");

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >(token ? "loading" : "idle");
  const [message, setMessage] = useState<string>("");

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setMessage(data.message);
    },
    onError: (error) => {
      setStatus("error");
      setMessage(error.message || "Failed to verify email");
    },
  });

  useEffect(() => {
    if (token && status === "loading") {
      verifyMutation.mutate({ token });
    }
  }, [token, status, verifyMutation]);

  // No token - show info about email verification
  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            {required
              ? "You need to verify your email to continue"
              : "Check your email for a verification link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to your email address. Click the link in
            the email to verify your account.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            If you don&apos;t see the email, check your spam folder or request a
            new verification link.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Back to login
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Loading state
  if (status === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verifying your email...</CardTitle>
          <CardDescription>
            Please wait while we verify your email
          </CardDescription>
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

  // Success state
  if (status === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email verified!</CardTitle>
          <CardDescription>
            Your email has been verified successfully
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button className="w-full">Continue to login</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Error state
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Verification failed</CardTitle>
        <CardDescription>We couldn&apos;t verify your email</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground mt-4">
          The verification link may have expired or already been used. You can
          request a new verification link from the login page.
        </p>
      </CardContent>
      <CardFooter>
        <Link href="/login" className="w-full">
          <Button variant="outline" className="w-full">
            Back to login
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
