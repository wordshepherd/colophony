/**
 * Composed contract router matching the server's REST router structure.
 * @see apps/api/src/rest/router.ts (lines 11-17)
 */
import {
  organizationsContract,
  submissionsContract,
  filesContract,
  usersContract,
  apiKeysContract,
  formsContract,
} from "@colophony/api-contracts";

export const colophonyContract = {
  organizations: organizationsContract,
  submissions: submissionsContract,
  files: filesContract,
  users: usersContract,
  apiKeys: apiKeysContract,
  forms: formsContract,
};
