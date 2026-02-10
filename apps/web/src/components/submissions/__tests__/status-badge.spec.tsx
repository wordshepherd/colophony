import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';
import type { SubmissionStatus } from '@prospector/types';

describe('StatusBadge', () => {
  const statusLabels: Record<SubmissionStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    HOLD: 'On Hold',
    WITHDRAWN: 'Withdrawn',
  };

  const allStatuses: SubmissionStatus[] = [
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'HOLD', 'WITHDRAWN',
  ];

  it.each(allStatuses)('should render correct label for %s status', (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(statusLabels[status])).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<StatusBadge status="DRAFT" className="custom-class" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('custom-class');
  });

  it('should apply status-specific color classes', () => {
    const { container } = render(<StatusBadge status="ACCEPTED" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-green-100');
  });

  it('should render destructive color for REJECTED', () => {
    const { container } = render(<StatusBadge status="REJECTED" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-red-100');
  });
});
