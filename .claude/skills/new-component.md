# /new-component

Scaffold a new React component with proper patterns for Prospector.

## What this skill does

1. Creates a component file with proper imports and structure
2. Generates TypeScript interfaces
3. Sets up error handling and loading states
4. Follows shadcn/ui conventions

## Usage

```
/new-component submission-status-badge    # Create simple component
/new-component payment-form --form        # Create form component
/new-component org-members-list --list    # Create list component
/new-component confirm-dialog --dialog    # Create dialog component
```

## Options

- `--form` - Create a form component with react-hook-form
- `--list` - Create a list component with tRPC query and pagination
- `--dialog` - Create a dialog/modal component
- `--card` - Create a card display component
- `--category <name>` - Specify component category (default: inferred from name)

## Instructions for Claude

When the user invokes `/new-component [options] <name>`:

### 1. Determine component category

Infer from name or `--category`:

- Names with `submission` → `submissions/`
- Names with `editor` → `editor/`
- Names with `auth`, `login`, `register` → `auth/`
- Names with `payment` → `payments/`
- Names with `org` → `organizations/`
- Otherwise → `common/`

### 2. Create the component file

**Path:** `apps/web/src/components/<category>/<name>.tsx`

#### Simple component:

```typescript
'use client';

import { cn } from '@/lib/utils';

interface <Name>Props {
  className?: string;
  // TODO: Add props
}

export function <Name>({ className }: <Name>Props) {
  return (
    <div className={cn('', className)}>
      {/* TODO: Add content */}
    </div>
  );
}
```

#### Form component (`--form`):

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  // TODO: Define form fields
  name: z.string().min(1, 'Name is required'),
});

type FormData = z.infer<typeof formSchema>;

interface <Name>Props {
  onSuccess?: () => void;
  // TODO: Add props
}

export function <Name>({ onSuccess }: <Name>Props) {
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  // TODO: Replace with actual mutation
  const mutation = trpc./* router.method */.useMutation({
    onSuccess: () => {
      toast.success('Success!');
      form.reset();
      onSuccess?.();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    await mutation.mutateAsync(data);
  };

  return (
    <Card>
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

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* TODO: Add more fields */}

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

#### List component (`--list`):

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Plus } from 'lucide-react';

interface <Name>Props {
  // TODO: Add props
}

export function <Name>({}: <Name>Props) {
  const [page, setPage] = useState(1);
  const limit = 20;

  // TODO: Replace with actual query
  const { data, isLoading, error } = trpc./* router.list */.useQuery({
    page,
    limit,
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TODO: Title</h1>
          <p className="text-muted-foreground">TODO: Description</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add New
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.items.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No items</h3>
          <p className="text-muted-foreground">
            Get started by creating your first item.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {/* TODO: Add columns */}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{/* TODO: item.name */}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

#### Dialog component (`--dialog`):

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface <Name>Props {
  trigger?: React.ReactNode;
  onConfirm?: () => void | Promise<void>;
  // TODO: Add props
}

export function <Name>({
  trigger,
  onConfirm,
}: <Name>Props) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm?.();
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Open</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>TODO: Title</DialogTitle>
          <DialogDescription>
            TODO: Description
          </DialogDescription>
        </DialogHeader>

        {/* TODO: Add dialog content */}
        <div className="py-4">
          <p>Dialog content goes here</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Summary

Inform the user:

- The file path created
- What TODOs need attention
- Any additional imports needed in parent components
