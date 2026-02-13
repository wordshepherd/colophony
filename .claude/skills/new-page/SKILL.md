---
name: new-page
description: Scaffold a new Next.js page with proper patterns for the Colophony dashboard.
---

# /new-page

Scaffold a new Next.js page with proper patterns for the Colophony dashboard.

## What this skill does

1. Creates a new page file in `apps/web/src/app/`
2. Optionally creates an accompanying component
3. Sets up proper auth protection and organization context
4. Includes loading and error states

## Usage

```
/new-page settings/privacy          # Create page at /settings/privacy
/new-page organizations             # Create page at /organizations
/new-page --auth reset-password     # Create auth page (no sidebar)
/new-page --with-component reports  # Create page + component
```

## Options

- `--auth` - Create in `(auth)` route group (centered, no sidebar)
- `--with-component` - Also create a component file
- `--editor` - Require editor role
- `--admin` - Require admin role

## Instructions for Claude

When the user invokes `/new-page [options] <name>`:

### 1. Determine the route group

- If `--auth` flag: Use `apps/web/src/app/(auth)/<name>/page.tsx`
- Otherwise: Use `apps/web/src/app/(dashboard)/<name>/page.tsx`

### 2. Create the page file

**For dashboard pages:**

```typescript
'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { <Name>Content } from '@/components/<name>/<name>-content';

export default function <Name>Page() {
  return (
    <ProtectedRoute requireEditor={/* true if --editor */}>
      <<Name>Content />
    </ProtectedRoute>
  );
}
```

**For auth pages:**

```typescript
import { <Name>Form } from '@/components/auth/<name>-form';

export default function <Name>Page() {
  return <<Name>Form />;
}
```

### 3. If `--with-component`, create the component

**Dashboard component** at `apps/web/src/components/<name>/<name>-content.tsx`:

```typescript
'use client';

import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/use-auth';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function <Name>Content() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  // TODO: Add your tRPC query here
  // const { data, isLoading, error } = trpc.<router>.<method>.useQuery({...});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold"><Name></h1>
        <p className="text-muted-foreground">
          TODO: Add description
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>TODO: Card Title</CardTitle>
        </CardHeader>
        <CardContent>
          {/* TODO: Add content */}
          <p>Content goes here</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Auth component** at `apps/web/src/components/auth/<name>-form.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formSchema = z.object({
  // TODO: Add form fields
});

type FormData = z.infer<typeof formSchema>;

export function <Name>Form() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      // TODO: Add form submission logic
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>TODO: Title</CardTitle>
        <CardDescription>TODO: Description</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* TODO: Add form fields */}

            <Button type="submit" className="w-full">
              Submit
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <Link href="/login" className="text-sm text-muted-foreground hover:underline">
          Back to login
        </Link>
      </CardFooter>
    </Card>
  );
}
```

### 4. Create directory if needed

Ensure the directory structure exists before creating files.

### 5. Summary

Inform the user:

- What files were created
- What TODOs need to be filled in
- Remind to add navigation links if needed (sidebar, header)
