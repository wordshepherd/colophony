import { faker } from '@faker-js/faker';
import { SubmissionStatus } from '@prisma/client';
import { getTestPrisma } from '../test-context';

const prisma = getTestPrisma();

export interface CreateSubmissionOptions {
  orgId: string;
  submitterId: string;
  title?: string;
  content?: string;
  status?: SubmissionStatus;
}

/**
 * Create a test submission
 */
export async function createSubmission(options: CreateSubmissionOptions) {
  return prisma.submission.create({
    data: {
      organizationId: options.orgId,
      submitterId: options.submitterId,
      title: options.title || faker.lorem.sentence(),
      content: options.content || faker.lorem.paragraphs(3),
      status: options.status || 'DRAFT',
    },
  });
}
