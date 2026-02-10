import { faker } from '@faker-js/faker';
import { getTestPrisma } from '../test-context';

const prisma = getTestPrisma();

export interface CreateOrgOptions {
  name?: string;
  slug?: string;
}

/**
 * Create a test organization
 */
export async function createOrg(options: CreateOrgOptions = {}) {
  const name = options.name || faker.company.name();
  const slug = options.slug || faker.helpers.slugify(name).toLowerCase();

  return prisma.organization.create({
    data: {
      name,
      slug,
      settings: {},
    },
  });
}
