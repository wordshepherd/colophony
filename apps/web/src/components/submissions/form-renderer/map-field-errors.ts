// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetErrorFn = (name: any, error: { message: string }) => void;

interface FieldError {
  fieldKey: string;
  message: string;
}

/**
 * Extract field errors from a TRPCClientError.
 * The error formatter in `apps/api/src/trpc/init.ts` surfaces fieldErrors
 * at `error.data.fieldErrors` as `Array<{ fieldKey, message }>`.
 */
export function extractFieldErrors(error: unknown): FieldError[] | null {
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "fieldErrors" in error.data &&
    Array.isArray(error.data.fieldErrors)
  ) {
    return error.data.fieldErrors as FieldError[];
  }
  return null;
}

/**
 * Map backend field validation errors to react-hook-form errors.
 * Calls `setError('formData.${fieldKey}', { message })` for each error.
 * Returns true if field errors were found and mapped, false otherwise.
 */
export function mapFieldErrorsToForm(
  error: unknown,
  setError: SetErrorFn,
): boolean {
  const fieldErrors = extractFieldErrors(error);
  if (!fieldErrors || fieldErrors.length === 0) return false;

  for (const { fieldKey, message } of fieldErrors) {
    setError(`formData.${fieldKey}`, { message });
  }

  return true;
}
