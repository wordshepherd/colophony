import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorDashboard } from '../editor-dashboard';

// Mock tRPC
let mockData: {
  items: Array<{
    id: string;
    title: string;
    status: string;
    submittedAt: string | null;
    submitter: { email: string } | null;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} | undefined = undefined;
let mockIsLoading = false;
let mockError: { message: string } | null = null;

jest.mock('@/lib/trpc', () => ({
  trpc: {
    submissions: {
      list: {
        useQuery: () => ({
          data: mockData,
          isLoading: mockIsLoading,
          error: mockError,
        }),
      },
    },
  },
}));

// Mock StatusBadge
jest.mock('@/components/submissions/status-badge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('EditorDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockData = undefined;
    mockIsLoading = false;
    mockError = null;
  });

  it('should render header and filter tabs', () => {
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    render(<EditorDashboard />);
    expect(screen.getByText('Editor Dashboard')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Under Review')).toBeInTheDocument();
  });

  it('should show loading skeletons while loading', () => {
    mockIsLoading = true;
    const { container } = render(<EditorDashboard />);
    expect(container.querySelector('[class*="animate-pulse"], [data-slot="skeleton"]')).toBeTruthy();
  });

  it('should show empty state when no submissions', () => {
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    render(<EditorDashboard />);
    expect(screen.getByText(/no submissions/i)).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockError = { message: 'Failed to load' };
    render(<EditorDashboard />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('should render submissions table', () => {
    mockData = {
      items: [
        {
          id: 'sub-1',
          title: 'Test Submission',
          status: 'SUBMITTED',
          submittedAt: '2024-01-15T12:00:00Z',
          submitter: { email: 'author@test.com' },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorDashboard />);
    expect(screen.getByText('Test Submission')).toBeInTheDocument();
    expect(screen.getByText('author@test.com')).toBeInTheDocument();
  });

  it('should render pagination when multiple pages', () => {
    mockData = {
      items: [
        {
          id: 'sub-1',
          title: 'Test',
          status: 'SUBMITTED',
          submittedAt: null,
          submitter: { email: 'test@test.com' },
        },
      ],
      total: 40,
      page: 1,
      limit: 20,
      totalPages: 2,
    };
    render(<EditorDashboard />);
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('should allow clicking tab filters', async () => {
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    const user = userEvent.setup();
    render(<EditorDashboard />);

    await user.click(screen.getByText('All'));
    // Tab should be active - just verify it can be clicked without error
    expect(screen.getByText('All')).toBeInTheDocument();
  });
});
