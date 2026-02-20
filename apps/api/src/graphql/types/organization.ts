import type { Organization, OrganizationMember } from '@colophony/db';
import { builder } from '../builder.js';
import { RoleEnum } from './enums.js';
import { UserType } from './user.js';

export const OrganizationType = builder
  .objectRef<Organization>('Organization')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      slug: t.exposeString('slug'),
      settings: t.expose('settings', { type: 'JSON', nullable: true }),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
      members: t.field({
        type: [OrganizationMemberType],
        resolve: (org, _args, ctx) => ctx.loaders.orgMembers.load(org.id),
      }),
    }),
  });

export const OrganizationMemberType = builder
  .objectRef<OrganizationMember>('OrganizationMember')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      organizationId: t.exposeString('organizationId'),
      userId: t.exposeString('userId'),
      role: t.expose('role', { type: RoleEnum }),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      user: t.field({
        type: UserType,
        nullable: true,
        resolve: (member, _args, ctx) => ctx.loaders.user.load(member.userId),
      }),
    }),
  });
