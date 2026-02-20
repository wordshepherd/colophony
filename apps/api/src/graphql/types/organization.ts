import type { Organization, OrganizationMember } from '@colophony/db';
import { builder } from '../builder.js';
import { RoleEnum } from './enums.js';
import { UserType } from './user.js';

export const OrganizationType = builder
  .objectRef<Organization>('Organization')
  .implement({
    description:
      'A literary magazine organization — the top-level tenant in Colophony.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      name: t.exposeString('name', {
        description: 'Display name of the organization.',
      }),
      slug: t.exposeString('slug', { description: 'URL-friendly identifier.' }),
      settings: t.expose('settings', {
        type: 'JSON',
        nullable: true,
        description: 'Organization-specific settings.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the organization was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the organization was last updated.',
      }),
      members: t.field({
        type: [OrganizationMemberType],
        description: 'Members of this organization.',
        resolve: (org, _args, ctx) => ctx.loaders.orgMembers.load(org.id),
      }),
    }),
  });

export const OrganizationMemberType = builder
  .objectRef<OrganizationMember>('OrganizationMember')
  .implement({
    description:
      'A membership record linking a user to an organization with a role.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Membership record ID.' }),
      organizationId: t.exposeString('organizationId', {
        description: 'ID of the organization.',
      }),
      userId: t.exposeString('userId', {
        description: 'ID of the member user.',
      }),
      role: t.expose('role', {
        type: RoleEnum,
        description: 'Role within the organization.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the member was added.',
      }),
      user: t.field({
        type: UserType,
        nullable: true,
        description: 'The user associated with this membership.',
        resolve: (member, _args, ctx) => ctx.loaders.user.load(member.userId),
      }),
    }),
  });
