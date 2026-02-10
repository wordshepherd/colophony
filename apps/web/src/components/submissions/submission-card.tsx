'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import type { SubmissionStatus } from '@prospector/types';

interface SubmissionCardProps {
  submission: {
    id: string;
    title: string;
    status: SubmissionStatus;
    createdAt: Date;
    submittedAt: Date | null;
  };
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const date = submission.submittedAt ?? submission.createdAt;

  return (
    <Link href={`/submissions/${submission.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">
              {submission.title}
            </CardTitle>
            <StatusBadge status={submission.status} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {submission.submittedAt ? 'Submitted' : 'Created'}{' '}
            {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
