---
name: new-hook
description: Scaffold a new custom React hook with proper patterns.
---

# /new-hook

Scaffold a new custom React hook with proper patterns.

## What this skill does

1. Creates a hook file in `apps/web/src/hooks/`
2. Follows React hook conventions
3. Includes TypeScript interfaces
4. Sets up proper error handling

## Usage

```
/new-hook submission-editor           # Create basic hook
/new-hook organization-members --query  # Create query wrapper hook
/new-hook file-delete --mutation       # Create mutation wrapper hook
```

## Options

- `--query` - Wrap a tRPC useQuery
- `--mutation` - Wrap a tRPC useMutation
- `--state` - Create a state management hook

## Instructions for Claude

When the user invokes `/new-hook [options] <name>`:

### 1. Validate the name

- Must be kebab-case (e.g., `submission-editor`)
- Will be converted to camelCase for the function name
- Will get `use` prefix (e.g., `useSubmissionEditor`)

### 2. Create the hook file

**Path:** `apps/web/src/hooks/use-<name>.ts`

#### Basic hook:

```typescript
'use client';

import { useState, useCallback } from 'react';

interface Use<Name>Options {
  // TODO: Add options
}

interface Use<Name>Return {
  // TODO: Define return type
}

export function use<Name>(options: Use<Name>Options = {}): Use<Name>Return {
  // TODO: Implement hook logic

  return {
    // TODO: Return values
  };
}
```

#### Query hook (`--query`):

```typescript
'use client';

import { trpc } from '@/lib/trpc';

interface Use<Name>Options {
  enabled?: boolean;
  // TODO: Add query parameters
}

export function use<Name>({
  enabled = true,
  // TODO: destructure parameters
}: Use<Name>Options = {}) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = trpc./* router.query */.useQuery(
    {
      // TODO: Add input
    },
    {
      enabled,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  return {
    data,
    isLoading,
    error,
    refetch,
    // TODO: Add computed values or helper functions
  };
}
```

#### Mutation hook (`--mutation`):

```typescript
'use client';

import { useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface Use<Name>Options {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function use<Name>({
  onSuccess,
  onError,
}: Use<Name>Options = {}) {
  const utils = trpc.useUtils();

  const mutation = trpc./* router.mutation */.useMutation({
    onSuccess: () => {
      toast.success('Success!');
      // TODO: Invalidate relevant queries
      // utils.router.query.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const execute = useCallback(
    async (input: /* TODO: input type */) => {
      return mutation.mutateAsync(input);
    },
    [mutation]
  );

  return {
    execute,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

#### State hook (`--state`):

```typescript
'use client';

import { useState, useCallback, useMemo } from 'react';

interface Use<Name>State {
  // TODO: Define state shape
}

const initialState: Use<Name>State = {
  // TODO: Initial values
};

export function use<Name>(initial?: Partial<Use<Name>State>) {
  const [state, setState] = useState<Use<Name>State>({
    ...initialState,
    ...initial,
  });

  const updateState = useCallback((updates: Partial<Use<Name>State>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // TODO: Add computed values
  const computed = useMemo(() => {
    return {
      // derived values
    };
  }, [state]);

  return {
    ...state,
    ...computed,
    updateState,
    reset,
  };
}
```

### 3. Export from hooks/index.ts (if exists)

If `apps/web/src/hooks/index.ts` exists, add the export:

```typescript
export { use<Name> } from './use-<name>';
```

### 4. Summary

Inform the user:

- The file path created
- What TODOs need to be completed
- How to import and use the hook
