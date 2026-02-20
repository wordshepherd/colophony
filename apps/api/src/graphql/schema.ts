import { builder } from './builder.js';

// Import types (registers object types on builder)
import './types/index.js';

// Import resolvers (registers query fields on builder via side effects)
import './resolvers/index.js';

export const schema = builder.toSchema();
