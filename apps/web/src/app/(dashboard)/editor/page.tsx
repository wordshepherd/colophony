'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { EditorDashboard } from '@/components/editor/editor-dashboard';

export default function EditorPage() {
  return (
    <ProtectedRoute requireEditor>
      <EditorDashboard />
    </ProtectedRoute>
  );
}
