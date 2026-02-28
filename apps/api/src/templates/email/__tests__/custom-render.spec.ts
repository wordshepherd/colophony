import { describe, it, expect } from 'vitest';
import { renderCustomTemplate } from '../render.js';

describe('renderCustomTemplate', () => {
  const orgName = 'The Paris Review';

  it('interpolates merge fields in subject', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'New submission: {{submissionTitle}}',
        bodyHtml: '<p>A new submission has been received.</p>',
      },
      { submissionTitle: 'My Poem' },
      orgName,
    );

    expect(result.subject).toBe('New submission: My Poem');
  });

  it('interpolates merge fields in body', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Update',
        bodyHtml: '<p>Welcome to {{orgName}}.</p>',
      },
      { orgName: 'The Paris Review' },
      orgName,
    );

    expect(result.html).toContain('Welcome to The Paris Review.');
  });

  it('sanitizes script tags from body', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Test',
        bodyHtml: '<p>Hello</p><script>alert(1)</script>',
      },
      {},
      orgName,
    );

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('Hello');
  });

  it('generates plain text from HTML', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Test',
        bodyHtml: '<p>Hello <strong>World</strong></p>',
      },
      {},
      orgName,
    );

    expect(result.text).toBe('Hello World');
  });

  it('wraps body in MJML layout with orgName', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Test',
        bodyHtml: '<p>Content</p>',
      },
      {},
      orgName,
    );

    expect(result.html).toContain('<!doctype html>');
    expect(result.html).toContain('The Paris Review');
  });

  it('replaces missing fields with empty string', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Hello {{unknownField}}',
        bodyHtml: '<p>Greeting {{anotherMissing}}</p>',
      },
      {},
      orgName,
    );

    expect(result.subject).toBe('Hello ');
    expect(result.text).toContain('Greeting');
  });
});
