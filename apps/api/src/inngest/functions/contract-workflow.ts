import { withRls } from '@colophony/db';
import { inngest } from '../client.js';
import type { ContractGeneratedEvent } from '../events.js';
import { contractService } from '../../services/contract.service.js';
import { createDocumensoAdapter } from '../../adapters/documenso.adapter.js';
import { validateEnv } from '../../config/env.js';

/**
 * Contract workflow — triggered when a contract is generated.
 *
 * Sends the contract to Documenso for e-signing, then waits for
 * signature events (from Documenso webhooks → Inngest events).
 *
 *   DRAFT → SENT → SIGNED → COMPLETED
 */
export const contractWorkflow = inngest.createFunction(
  {
    id: 'contract-workflow',
    name: 'Contract Signing Workflow',
    retries: 3,
  },
  { event: 'slate/contract.generated' },
  async ({ event, step }) => {
    const { orgId, contractId, pipelineItemId } =
      event.data as ContractGeneratedEvent['data'];

    // Step 1: Send contract to Documenso
    const documensoDocumentId = await step.run(
      'send-to-documenso',
      async () => {
        const env = validateEnv();
        const adapter = createDocumensoAdapter(env);
        if (!adapter) {
          throw new Error(
            'Documenso adapter not configured — cannot send contract',
          );
        }

        const contract = await withRls({ orgId }, async (tx) => {
          return contractService.getById(tx, contractId);
        });

        if (!contract) {
          throw new Error(`Contract "${contractId}" not found`);
        }

        // Create document in Documenso
        const docId = await adapter.createDocument({
          title: `Contract — ${contractId}`,
          body: contract.renderedBody,
          signers: [], // Signers will be configured via Documenso UI or API
          metadata: {
            colophonyContractId: contractId,
            colophonyPipelineItemId: pipelineItemId,
            colophonyOrgId: orgId,
          },
        });

        // Update contract with Documenso document ID and status
        await withRls({ orgId }, async (tx) => {
          await contractService.updateDocumensoId(tx, contractId, docId);
          await contractService.updateStatus(tx, contractId, 'SENT');
        });

        return docId;
      },
    );

    // Step 2: Wait for contract to be signed
    await step.waitForEvent('wait-for-signed', {
      event: 'slate/contract.signed',
      match: 'data.contractId',
      timeout: '90d',
    });

    // Step 3: Wait for contract to be completed (countersigned/finalized)
    await step.waitForEvent('wait-for-completed', {
      event: 'slate/contract.completed',
      match: 'data.contractId',
      timeout: '90d',
    });

    return {
      status: 'completed',
      contractId,
      documensoDocumentId,
    };
  },
);
