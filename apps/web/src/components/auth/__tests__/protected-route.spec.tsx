import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from '../protected-route';
import { mockPush } from '../../../../test/setup';

// Mock useAuth
let mockAuthState = {
  user: { id: '1', email: 'test@test.com', emailVerified: true, organizations: [] } as unknown,
  isLoading: false,
  isAuthenticated: true,
  isEmailVerified: true,
  error: null,
};

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuthState,
}));

// Mock useOrganization
let mockOrgState = {
  currentOrg: { id: 'org-1', name: 'Test Org', slug: 'test', role: 'ADMIN' as const },
  organizations: [{ id: 'org-1', name: 'Test Org', slug: 'test', role: 'ADMIN' as const }],
  switchOrganization: jest.fn(),
  isAdmin: true,
  isEditor: true,
  isReader: true,
  hasOrganizations: true,
};

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => mockOrgState,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      user: { id: '1', email: 'test@test.com', emailVerified: true, organizations: [] },
      isLoading: false,
      isAuthenticated: true,
      isEmailVerified: true,
      error: null,
    };
    mockOrgState = {
      currentOrg: { id: 'org-1', name: 'Test Org', slug: 'test', role: 'ADMIN' as const },
      organizations: [{ id: 'org-1', name: 'Test Org', slug: 'test', role: 'ADMIN' as const }],
      switchOrganization: jest.fn(),
      isAdmin: true,
      isEditor: true,
      isReader: true,
      hasOrganizations: true,
    };
  });

  it('should render children when authenticated', () => {
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show loading skeleton while loading', () => {
    mockAuthState.isLoading = true;
    const { container } = render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // Should render skeletons
    expect(container.querySelector('[class*="animate-pulse"], [data-slot="skeleton"]')).toBeTruthy();
  });

  it('should redirect to /login when not authenticated', () => {
    mockAuthState.isAuthenticated = false;
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /verify-email when email not verified and required', () => {
    mockAuthState.isEmailVerified = false;
    render(
      <ProtectedRoute requireEmailVerified>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/verify-email?required=true');
  });

  it('should render children when email not verified but not required', () => {
    mockAuthState.isEmailVerified = false;
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to dashboard when editor required but not editor', () => {
    mockOrgState.isEditor = false;
    render(
      <ProtectedRoute requireEditor>
        <div>Editor Content</div>
      </ProtectedRoute>
    );
    expect(screen.queryByText('Editor Content')).not.toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/dashboard?unauthorized=true');
  });

  it('should redirect to dashboard when admin required but not admin', () => {
    mockOrgState.isAdmin = false;
    render(
      <ProtectedRoute requireAdmin>
        <div>Admin Content</div>
      </ProtectedRoute>
    );
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/dashboard?unauthorized=true');
  });

  it('should redirect when no organizations and organization required', () => {
    mockOrgState.hasOrganizations = false;
    mockOrgState.currentOrg = null as unknown as typeof mockOrgState.currentOrg;
    render(
      <ProtectedRoute requireOrganization>
        <div>Org Content</div>
      </ProtectedRoute>
    );
    expect(screen.queryByText('Org Content')).not.toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/dashboard?no-org=true');
  });

  it('should render when organization not required even if no orgs', () => {
    mockOrgState.hasOrganizations = false;
    mockOrgState.currentOrg = null as unknown as typeof mockOrgState.currentOrg;
    render(
      <ProtectedRoute requireOrganization={false}>
        <div>Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
