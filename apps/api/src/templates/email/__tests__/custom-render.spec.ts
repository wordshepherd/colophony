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

  // -------------------------------------------------------------------------
  // Array / block interpolation integration tests
  // -------------------------------------------------------------------------

  const feedback = [
    {
      tags: ['compelling voice', 'strong imagery'],
      comment: 'Beautiful prose, but the ending felt rushed.',
    },
    { tags: ['needs revision'], comment: null },
  ];

  it('renders {{readerFeedback}} scalar tag as default formatted block', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Update on {{submissionTitle}}',
        bodyHtml:
          '<p>Dear writer,</p><p>We received feedback:</p>{{readerFeedback}}',
      },
      { submissionTitle: 'My Poem', readerFeedback: feedback },
      orgName,
    );

    expect(result.html).toContain('compelling voice, strong imagery');
    expect(result.html).toContain(
      'Beautiful prose, but the ending felt rushed.',
    );
    expect(result.html).toContain('needs revision');
  });

  it('renders {{#each readerFeedback}} with custom layout per item', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Update',
        bodyHtml:
          '{{#each readerFeedback}}<p><strong>{{this.tags}}</strong>: {{this.comment}}</p>{{/each}}',
      },
      { readerFeedback: feedback },
      orgName,
    );

    expect(result.html).toContain('compelling voice, strong imagery');
    expect(result.html).toContain(
      'Beautiful prose, but the ending felt rushed.',
    );
  });

  it('includes feedback content in plain text output with line breaks', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Update',
        bodyHtml: '<p>Feedback:</p>{{readerFeedback}}',
      },
      { readerFeedback: feedback },
      orgName,
    );

    expect(result.text).toContain('compelling voice, strong imagery');
    expect(result.text).toContain(
      'Beautiful prose, but the ending felt rushed.',
    );
    expect(result.text).toContain('needs revision');
  });

  it('renders nothing when readerFeedback array is empty', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Update',
        bodyHtml: '<p>Before</p>{{readerFeedback}}<p>After</p>',
      },
      { readerFeedback: [] },
      orgName,
    );

    expect(result.text).toContain('Before');
    expect(result.text).toContain('After');
    expect(result.text).not.toContain('border-left');
  });

  it('silently ignores readerFeedback when template does not reference it', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Update',
        bodyHtml: '<p>Thank you.</p>',
      },
      { readerFeedback: feedback },
      orgName,
    );

    expect(result.text).toBe('Thank you.');
  });

  it('escapes XSS in feedback values in final HTML', () => {
    const xssFeedback = [
      {
        tags: ['<script>alert(1)</script>'],
        comment: '<img onerror=alert(1)>',
      },
    ];
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Update',
        bodyHtml: '{{readerFeedback}}',
      },
      { readerFeedback: xssFeedback },
      orgName,
    );

    expect(result.html).not.toContain('<script>');
    // onerror appears as escaped text (&lt;img onerror=...) not as an active attribute
    expect(result.html).not.toContain('<img');
  });

  it('does not render HTML blocks in subject line for array fields', () => {
    const result = renderCustomTemplate(
      {
        subjectTemplate: 'Feedback: {{readerFeedback}}',
        bodyHtml: '<p>Body</p>',
      },
      { readerFeedback: feedback },
      orgName,
    );

    expect(result.subject).toBe('Feedback: ');
    expect(result.subject).not.toContain('<div');
  });
});
