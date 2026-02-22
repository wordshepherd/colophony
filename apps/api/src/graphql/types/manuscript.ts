import type { Manuscript, ManuscriptVersion } from '@colophony/db';
import { builder } from '../builder.js';

export const ManuscriptType = builder
  .objectRef<Manuscript>('Manuscript')
  .implement({
    description: "A creative work in the author's manuscript library.",
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      ownerId: t.exposeString('ownerId', {
        description: 'ID of the owning user.',
      }),
      title: t.exposeString('title', {
        description: 'Title of the manuscript.',
      }),
      description: t.exposeString('description', {
        nullable: true,
        description: 'Optional description.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the manuscript was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the manuscript was last updated.',
      }),
    }),
  });

export const ManuscriptVersionType = builder
  .objectRef<ManuscriptVersion>('ManuscriptVersion')
  .implement({
    description: 'A version of a manuscript, containing files.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      manuscriptId: t.exposeString('manuscriptId', {
        description: 'ID of the parent manuscript.',
      }),
      versionNumber: t.exposeInt('versionNumber', {
        description: 'Sequential version number.',
      }),
      label: t.exposeString('label', {
        nullable: true,
        description: 'Optional version label.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the version was created.',
      }),
    }),
  });
