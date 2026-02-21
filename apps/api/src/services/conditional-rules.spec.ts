import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateFieldVisibility,
  getFieldDependencies,
  type RuleCondition,
  type ConditionalRule,
} from '@colophony/types';

// ---------------------------------------------------------------------------
// evaluateCondition
// ---------------------------------------------------------------------------

describe('evaluateCondition', () => {
  describe('AND operator', () => {
    it('returns true when all conditions are true', () => {
      const condition: RuleCondition = {
        operator: 'AND',
        rules: [
          { field: 'category', comparator: 'eq', value: 'fiction' },
          { field: 'length', comparator: 'gt', value: 100 },
        ],
      };
      expect(
        evaluateCondition(condition, { category: 'fiction', length: 200 }),
      ).toBe(true);
    });

    it('returns false when one condition is false', () => {
      const condition: RuleCondition = {
        operator: 'AND',
        rules: [
          { field: 'category', comparator: 'eq', value: 'fiction' },
          { field: 'length', comparator: 'gt', value: 100 },
        ],
      };
      expect(
        evaluateCondition(condition, { category: 'fiction', length: 50 }),
      ).toBe(false);
    });
  });

  describe('OR operator', () => {
    it('returns true when one condition is true', () => {
      const condition: RuleCondition = {
        operator: 'OR',
        rules: [
          { field: 'category', comparator: 'eq', value: 'fiction' },
          { field: 'category', comparator: 'eq', value: 'poetry' },
        ],
      };
      expect(evaluateCondition(condition, { category: 'poetry' })).toBe(true);
    });

    it('returns false when all conditions are false', () => {
      const condition: RuleCondition = {
        operator: 'OR',
        rules: [
          { field: 'category', comparator: 'eq', value: 'fiction' },
          { field: 'category', comparator: 'eq', value: 'poetry' },
        ],
      };
      expect(evaluateCondition(condition, { category: 'nonfiction' })).toBe(
        false,
      );
    });
  });

  describe('comparators', () => {
    it('eq — matches equal strings', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'eq', value: 'hello' }],
      };
      expect(evaluateCondition(cond, { x: 'hello' })).toBe(true);
      expect(evaluateCondition(cond, { x: 'world' })).toBe(false);
    });

    it('neq — matches unequal strings', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'neq', value: 'hello' }],
      };
      expect(evaluateCondition(cond, { x: 'world' })).toBe(true);
      expect(evaluateCondition(cond, { x: 'hello' })).toBe(false);
    });

    it('gt — numeric greater than', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'gt', value: 10 }],
      };
      expect(evaluateCondition(cond, { x: 15 })).toBe(true);
      expect(evaluateCondition(cond, { x: 10 })).toBe(false);
      expect(evaluateCondition(cond, { x: 5 })).toBe(false);
    });

    it('lt — numeric less than', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'lt', value: 10 }],
      };
      expect(evaluateCondition(cond, { x: 5 })).toBe(true);
      expect(evaluateCondition(cond, { x: 10 })).toBe(false);
    });

    it('gte — numeric greater than or equal', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'gte', value: 10 }],
      };
      expect(evaluateCondition(cond, { x: 10 })).toBe(true);
      expect(evaluateCondition(cond, { x: 9 })).toBe(false);
    });

    it('lte — numeric less than or equal', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'lte', value: 10 }],
      };
      expect(evaluateCondition(cond, { x: 10 })).toBe(true);
      expect(evaluateCondition(cond, { x: 11 })).toBe(false);
    });

    it('contains — substring match', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'contains', value: 'ello' }],
      };
      expect(evaluateCondition(cond, { x: 'hello world' })).toBe(true);
      expect(evaluateCondition(cond, { x: 'goodbye' })).toBe(false);
    });

    it('not_contains — no substring match', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'not_contains', value: 'ello' }],
      };
      expect(evaluateCondition(cond, { x: 'goodbye' })).toBe(true);
      expect(evaluateCondition(cond, { x: 'hello' })).toBe(false);
    });

    it('starts_with — prefix match', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'starts_with', value: 'hel' }],
      };
      expect(evaluateCondition(cond, { x: 'hello' })).toBe(true);
      expect(evaluateCondition(cond, { x: 'world' })).toBe(false);
    });

    it('ends_with — suffix match', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'ends_with', value: 'rld' }],
      };
      expect(evaluateCondition(cond, { x: 'world' })).toBe(true);
      expect(evaluateCondition(cond, { x: 'hello' })).toBe(false);
    });

    it('is_empty — empty values', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'is_empty' }],
      };
      expect(evaluateCondition(cond, { x: '' })).toBe(true);
      expect(evaluateCondition(cond, { x: undefined })).toBe(true);
      expect(evaluateCondition(cond, {})).toBe(true);
      expect(evaluateCondition(cond, { x: null })).toBe(true);
      expect(evaluateCondition(cond, { x: [] })).toBe(true);
      expect(evaluateCondition(cond, { x: 'hi' })).toBe(false);
    });

    it('is_not_empty — non-empty values', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'is_not_empty' }],
      };
      expect(evaluateCondition(cond, { x: 'hello' })).toBe(true);
      expect(evaluateCondition(cond, { x: '' })).toBe(false);
      expect(evaluateCondition(cond, {})).toBe(false);
    });

    it('in — value in array', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'in', value: ['a', 'b', 'c'] }],
      };
      expect(evaluateCondition(cond, { x: 'b' })).toBe(true);
      expect(evaluateCondition(cond, { x: 'd' })).toBe(false);
    });

    it('not_in — value not in array', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'not_in', value: ['a', 'b', 'c'] }],
      };
      expect(evaluateCondition(cond, { x: 'd' })).toBe(true);
      expect(evaluateCondition(cond, { x: 'a' })).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles undefined field value gracefully', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'missing', comparator: 'eq', value: 'test' }],
      };
      expect(evaluateCondition(cond, {})).toBe(false);
    });

    it('handles null field value', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'is_empty' }],
      };
      expect(evaluateCondition(cond, { x: null })).toBe(true);
    });

    it('handles numeric comparison with string values', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'gt', value: 5 }],
      };
      expect(evaluateCondition(cond, { x: '10' })).toBe(true);
      expect(evaluateCondition(cond, { x: '3' })).toBe(false);
    });

    it('handles eq with boolean value', () => {
      const cond: RuleCondition = {
        operator: 'AND',
        rules: [{ field: 'x', comparator: 'eq', value: 'true' }],
      };
      expect(evaluateCondition(cond, { x: true })).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateFieldVisibility
// ---------------------------------------------------------------------------

describe('evaluateFieldVisibility', () => {
  it('returns visible=true, required=false with no rules', () => {
    expect(evaluateFieldVisibility(null, {})).toEqual({
      visible: true,
      required: false,
    });
    expect(evaluateFieldVisibility([], {})).toEqual({
      visible: true,
      required: false,
    });
    expect(evaluateFieldVisibility(undefined, {})).toEqual({
      visible: true,
      required: false,
    });
  });

  it('SHOW rule — visible when condition is true', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'SHOW',
        condition: {
          operator: 'AND',
          rules: [{ field: 'category', comparator: 'eq', value: 'fiction' }],
        },
      },
    ];
    expect(evaluateFieldVisibility(rules, { category: 'fiction' })).toEqual({
      visible: true,
      required: false,
    });
  });

  it('SHOW rule — hidden when condition is false', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'SHOW',
        condition: {
          operator: 'AND',
          rules: [{ field: 'category', comparator: 'eq', value: 'fiction' }],
        },
      },
    ];
    expect(evaluateFieldVisibility(rules, { category: 'poetry' })).toEqual({
      visible: false,
      required: false,
    });
  });

  it('HIDE rule — hidden when condition is true', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'HIDE',
        condition: {
          operator: 'AND',
          rules: [{ field: 'category', comparator: 'eq', value: 'poetry' }],
        },
      },
    ];
    expect(evaluateFieldVisibility(rules, { category: 'poetry' })).toEqual({
      visible: false,
      required: false,
    });
  });

  it('HIDE rule — visible when condition is false', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'HIDE',
        condition: {
          operator: 'AND',
          rules: [{ field: 'category', comparator: 'eq', value: 'poetry' }],
        },
      },
    ];
    expect(evaluateFieldVisibility(rules, { category: 'fiction' })).toEqual({
      visible: true,
      required: false,
    });
  });

  it('REQUIRE rule — required when condition is true', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'REQUIRE',
        condition: {
          operator: 'AND',
          rules: [{ field: 'category', comparator: 'eq', value: 'fiction' }],
        },
      },
    ];
    expect(evaluateFieldVisibility(rules, { category: 'fiction' })).toEqual({
      visible: true,
      required: true,
    });
  });

  it('REQUIRE rule — not required when condition is false', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'REQUIRE',
        condition: {
          operator: 'AND',
          rules: [{ field: 'category', comparator: 'eq', value: 'fiction' }],
        },
      },
    ];
    expect(evaluateFieldVisibility(rules, { category: 'poetry' })).toEqual({
      visible: true,
      required: false,
    });
  });

  it('mixed SHOW + REQUIRE rules', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'SHOW',
        condition: {
          operator: 'AND',
          rules: [{ field: 'category', comparator: 'eq', value: 'fiction' }],
        },
      },
      {
        effect: 'REQUIRE',
        condition: {
          operator: 'AND',
          rules: [{ field: 'category', comparator: 'eq', value: 'fiction' }],
        },
      },
    ];
    // Both conditions met
    expect(evaluateFieldVisibility(rules, { category: 'fiction' })).toEqual({
      visible: true,
      required: true,
    });

    // SHOW condition not met → hidden, REQUIRE overridden by hidden
    expect(evaluateFieldVisibility(rules, { category: 'poetry' })).toEqual({
      visible: false,
      required: false,
    });
  });

  it('multiple SHOW/HIDE rules — last wins', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'SHOW',
        condition: {
          operator: 'AND',
          rules: [{ field: 'a', comparator: 'eq', value: 'yes' }],
        },
      },
      {
        effect: 'HIDE',
        condition: {
          operator: 'AND',
          rules: [{ field: 'b', comparator: 'eq', value: 'yes' }],
        },
      },
    ];
    // SHOW passes (a=yes), then HIDE also passes (b=yes) → hidden (last wins)
    expect(evaluateFieldVisibility(rules, { a: 'yes', b: 'yes' })).toEqual({
      visible: false,
      required: false,
    });
  });
});

// ---------------------------------------------------------------------------
// getFieldDependencies
// ---------------------------------------------------------------------------

describe('getFieldDependencies', () => {
  it('returns empty array for null/undefined/empty rules', () => {
    expect(getFieldDependencies(null)).toEqual([]);
    expect(getFieldDependencies(undefined)).toEqual([]);
    expect(getFieldDependencies([])).toEqual([]);
  });

  it('extracts unique fieldKeys from rules', () => {
    const rules: ConditionalRule[] = [
      {
        effect: 'SHOW',
        condition: {
          operator: 'AND',
          rules: [
            { field: 'category', comparator: 'eq', value: 'fiction' },
            { field: 'category', comparator: 'neq', value: 'poetry' },
          ],
        },
      },
      {
        effect: 'REQUIRE',
        condition: {
          operator: 'OR',
          rules: [{ field: 'status', comparator: 'eq', value: 'active' }],
        },
      },
    ];
    const deps = getFieldDependencies(rules);
    expect(deps).toHaveLength(2);
    expect(deps).toContain('category');
    expect(deps).toContain('status');
  });
});
