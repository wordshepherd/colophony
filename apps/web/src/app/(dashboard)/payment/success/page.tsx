'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle } from 'lucide-react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');
  const submissionId = searchParams.get('submission_id');

  // Optionally fetch submission details
  const { data: submission, isLoading } = trpc.submissions.getById.useQuery(
    { id: submissionId! },
    { enabled: !!submissionId }
  );

  // Redirect if no session ID
  useEffect(() => {
    if (!sessionId) {
      router.push('/submissions');
    }
  }, [sessionId, router]);

  if (!sessionId) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle>Payment Successful!</CardTitle>
        <CardDescription>
          Your payment has been processed successfully.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {isLoading ? (
          <Skeleton className="h-4 w-48 mx-auto" />
        ) : submission ? (
          <p className="text-sm text-muted-foreground">
            Your submission &ldquo;{submission.title}&rdquo; has been submitted
            for review.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your submission has been submitted for review. You will receive an
            email confirmation shortly.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {submissionId && (
          <Link href={`/submissions/${submissionId}`} className="w-full">
            <Button className="w-full">View Submission</Button>
          </Link>
        )}
        <Link href="/submissions" className="w-full">
          <Button variant="outline" className="w-full">
            Back to Submissions
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Suspense
        fallback={
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto mt-2" />
            </CardHeader>
          </Card>
        }
      >
        <PaymentSuccessContent />
      </Suspense>
    </div>
  );
}
