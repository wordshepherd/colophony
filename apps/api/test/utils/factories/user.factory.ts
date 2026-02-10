import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { getTestPrisma } from '../test-context';

const prisma = getTestPrisma();

export interface CreateUserOptions {
  email?: string;
  password?: string;
  emailVerified?: boolean;
}

/**
 * Create a test user
 */
export async function createUser(options: CreateUserOptions = {}) {
  const email = options.email || faker.internet.email();
  const password = options.password || 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified: options.emailVerified ?? false,
    },
  });
}

/**
 * Create a user and add them to an organization
 */
export async function createUserWithOrg(
  orgId: string,
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'READER',
  options: CreateUserOptions = {}
) {
  const user = await createUser(options);

  await prisma.organizationMember.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      role,
    },
  });

  return user;
}
