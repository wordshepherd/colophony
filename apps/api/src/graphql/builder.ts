import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { GraphQLScalarType, Kind } from 'graphql';
import type { GraphQLContext } from './context.js';

// ---------------------------------------------------------------------------
// Custom scalars
// ---------------------------------------------------------------------------

const DateTimeScalar = new GraphQLScalarType<Date, string>({
  name: 'DateTime',
  description: 'ISO-8601 date-time string',
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    throw new TypeError('DateTime cannot represent a non-Date/string value');
  },
  parseValue(value) {
    if (typeof value === 'string') return new Date(value);
    throw new TypeError('DateTime must be a string');
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    throw new TypeError('DateTime must be a string');
  },
});

const JSONScalar = new GraphQLScalarType<unknown, unknown>({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return JSON.parse(ast.value) as unknown;
    if (ast.kind === Kind.INT) return parseInt(ast.value, 10);
    if (ast.kind === Kind.FLOAT) return parseFloat(ast.value);
    if (ast.kind === Kind.BOOLEAN) return ast.value;
    if (ast.kind === Kind.NULL) return null;
    throw new TypeError('JSON scalar could not parse literal');
  },
});

// ---------------------------------------------------------------------------
// SchemaBuilder
// ---------------------------------------------------------------------------

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Scalars: {
    DateTime: { Input: Date; Output: Date | string };
    JSON: { Input: unknown; Output: unknown };
  };
}>({
  plugins: [RelayPlugin],
  relay: {
    clientMutationId: 'omit',
    cursorType: 'String',
  },
});

builder.addScalarType('DateTime', DateTimeScalar);
builder.addScalarType('JSON', JSONScalar);

// Query root — resolvers add fields via builder.queryFields()
builder.queryType({});

// Mutation root — resolvers add fields via builder.mutationFields()
builder.mutationType({});
