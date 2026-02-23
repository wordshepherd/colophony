export type {
  CmsAdapter,
  CmsTestResult,
  CmsPublishResult,
  CmsIssuePayload,
  CmsPiecePayload,
} from './cms-adapter.interface.js';
export { wordpressAdapter } from './wordpress.adapter.js';
export { ghostAdapter } from './ghost.adapter.js';

import type { CmsAdapterType } from '@colophony/types';
import type { CmsAdapter } from './cms-adapter.interface.js';
import { wordpressAdapter } from './wordpress.adapter.js';
import { ghostAdapter } from './ghost.adapter.js';

const adapters: Record<CmsAdapterType, CmsAdapter> = {
  WORDPRESS: wordpressAdapter,
  GHOST: ghostAdapter,
};

/** Resolve the CMS adapter implementation for a given adapter type. */
export function getCmsAdapter(type: CmsAdapterType): CmsAdapter {
  return adapters[type];
}
