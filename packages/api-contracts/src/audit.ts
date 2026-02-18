import { listAuditEventsSchema } from "@colophony/types";
import { restPaginationQuery } from "./shared.js";

// ---------------------------------------------------------------------------
// Query schema — override page/limit with z.coerce for REST query strings,
// and coerce date params for from/to.
// ---------------------------------------------------------------------------

export const restListAuditEventsQuery = listAuditEventsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);
