'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { XCircle } from 'lucide-react';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('submission_id');

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
          <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle>Payment Cancelled</CardTitle>
        <CardDescription>
          Your payment was not completed.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t worry - your submission has been saved as a draft. You can
          complete the payment whenever you&apos;re ready.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {submissionId && (
          <Link href={`/submissions/${submissionId}`} className="w-full">
            <Button className="w-full">Return to Submission</Button>
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

export default function PaymentCancelPage() {
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
        <PaymentCancelContent />
      </Suspense>
    </div>
  );
}
