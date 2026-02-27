import { z } from 'zod';
import type { UIExtensionDeclaration } from '@colophony/plugin-sdk';
import { createRouter, orgProcedure } from '../init.js';
import { getGlobalExtensions } from '../../adapters/extensions-accessor.js';

const uiExtensionPointEnum = z.enum([
  'dashboard.widget',
  'submission.detail.section',
  'submission.list.action',
  'pipeline.stage.action',
  'settings.section',
  'navigation.item',
  'form.field',
  'publication.preview',
]);

const uiExtensionSchema = z.object({
  point: uiExtensionPointEnum,
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  requiredPermissions: z.array(z.string()).optional(),
  component: z.string(),
  order: z.number().optional(),
});

/**
 * Build the set of granted permissions for an org role.
 * ADMIN gets everything; EDITOR gets read + write; READER gets read-only.
 */
function buildPermissionsForRole(
  role: 'ADMIN' | 'EDITOR' | 'READER',
): Set<string> {
  const perms = new Set<string>();

  // Read permissions for all roles
  perms.add('submissions:read');
  perms.add('forms:read');
  perms.add('files:read');
  perms.add('publications:read');
  perms.add('pipeline:read');
  perms.add('issues:read');
  perms.add('contracts:read');

  if (role === 'EDITOR' || role === 'ADMIN') {
    perms.add('submissions:write');
    perms.add('forms:write');
    perms.add('files:write');
    perms.add('publications:write');
    perms.add('pipeline:write');
    perms.add('issues:write');
    perms.add('contracts:write');
    perms.add('database:write');
  }

  if (role === 'ADMIN') {
    perms.add('settings:read');
    perms.add('settings:write');
    perms.add('members:read');
    perms.add('members:write');
    perms.add('audit:read');
    perms.add('api-keys:read');
    perms.add('api-keys:write');
    perms.add('webhooks:read');
    perms.add('webhooks:write');
  }

  return perms;
}

function extensionAllowed(
  ext: UIExtensionDeclaration,
  grantedPermissions: Set<string>,
): boolean {
  if (!ext.requiredPermissions || ext.requiredPermissions.length === 0) {
    return true;
  }
  return ext.requiredPermissions.every((p) => grantedPermissions.has(p));
}

export const pluginsRouter = createRouter({
  listExtensions: orgProcedure
    .input(
      z
        .object({ point: uiExtensionPointEnum.optional() })
        .optional()
        .default({}),
    )
    .output(z.array(uiExtensionSchema))
    .query(({ ctx, input }) => {
      const extensions = getGlobalExtensions();
      const granted = buildPermissionsForRole(ctx.authContext.role);

      let filtered = extensions.filter((ext) => extensionAllowed(ext, granted));

      if (input.point) {
        filtered = filtered.filter((ext) => ext.point === input.point);
      }

      // Sort by order ascending, nullish last
      filtered.sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });

      return filtered;
    }),
});
