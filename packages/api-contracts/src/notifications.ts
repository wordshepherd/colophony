import { z } from "zod";
import { listNotificationsSchema } from "@colophony/types";
import { restPaginationQuery } from "./shared.js";

/**
 * Parse a boolean that may arrive as a query-string token.
 *
 * The first boolean query parameter on the REST surface, so this sets the
 * idiom. Three candidates were measured against the actual schema converter:
 *
 *   `z.coerce.boolean()`  — parses "false" as **true**. Silently inverts the
 *                           filter. Never use it for a query param.
 *   `z.stringbool()`      — correct on strings, but renders as
 *                           `{"type":"string"}` in the spec, so both generated
 *                           SDKs would type the field as a string, and it
 *                           rejects a real boolean outright.
 *   `z.preprocess(...)`   — renders as `{"type":"boolean"}` and accepts both a
 *                           real boolean and the string form.
 *
 * Only the exact tokens "true" and "false" convert. Anything else falls
 * through to `z.boolean()` and is rejected, so `?unreadOnly=maybe` is a 400
 * rather than a silent `false` — the same default-deny reasoning as
 * `requireScopes`. OpenAPI serializes boolean query params as those two
 * tokens, so an SDK-generated call always lands in the accepted set.
 */
const booleanQueryParam = (fallback: boolean) =>
  z
    .preprocess(
      (v) => (v === "true" ? true : v === "false" ? false : v),
      z.boolean(),
    )
    .default(fallback);

/**
 * REST query variant of `listNotificationsSchema`.
 *
 * Two things the tRPC schema can leave alone and this one cannot:
 *
 *  1. Query params arrive as strings, so `page`/`limit`/`unreadOnly` all need
 *     parsing. `restPaginationQuery` covers the first two.
 *  2. `restPaginationQuery` caps `limit` at 100 while the tRPC twin caps it at
 *     50. Merging it verbatim would silently widen what this surface accepts,
 *     so the cap is restated at 50 and the two surfaces stay in step.
 */
export const restListNotificationsQuery = listNotificationsSchema
  .omit({ page: true, limit: true, unreadOnly: true })
  .merge(restPaginationQuery)
  .extend({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Items per page (1-50, default 20)"),
    unreadOnly: booleanQueryParam(false).describe(
      "Return only notifications that have not been read",
    ),
  });

export type RestListNotificationsQuery = z.infer<
  typeof restListNotificationsQuery
>;
