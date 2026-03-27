import { describe, it, expect } from 'vitest';
import { writerProjectionService } from './writer-projection.service.js';

describe('writerProjectionService', () => {
  describe('project', () => {
    it('projects HOLD to IN_REVIEW with default label', () => {
      const result = writerProjectionService.project('HOLD', {});
      expect(result).toEqual({
        writerStatus: 'IN_REVIEW',
        writerStatusLabel: 'In Review',
      });
    });

    it('projects REJECTED to DECISION_SENT with default label', () => {
      const result = writerProjectionService.project('REJECTED');
      expect(result).toEqual({
        writerStatus: 'DECISION_SENT',
        writerStatusLabel: 'Decision Sent',
      });
    });

    it('uses org override for label when present', () => {
      const result = writerProjectionService.project('REJECTED', {
        writerStatusLabels: { DECISION_SENT: 'Not Accepted' },
      });
      expect(result).toEqual({
        writerStatus: 'DECISION_SENT',
        writerStatusLabel: 'Not Accepted',
      });
    });

    it('falls back to default when org has no writerStatusLabels', () => {
      const result = writerProjectionService.project('SUBMITTED', {
        someOtherSetting: true,
      });
      expect(result).toEqual({
        writerStatus: 'RECEIVED',
        writerStatusLabel: 'Received',
      });
    });

    it('falls back to default when org override key is missing', () => {
      const result = writerProjectionService.project('ACCEPTED', {
        writerStatusLabels: { DRAFT: 'My Draft' },
      });
      expect(result).toEqual({
        writerStatus: 'ACCEPTED',
        writerStatusLabel: 'Accepted',
      });
    });
  });

  describe('projectLabel', () => {
    it('returns string for embed use', () => {
      expect(writerProjectionService.projectLabel('UNDER_REVIEW')).toBe(
        'In Review',
      );
    });

    it('returns org-customized label', () => {
      expect(
        writerProjectionService.projectLabel('REJECTED', {
          writerStatusLabels: { DECISION_SENT: 'Declined' },
        }),
      ).toBe('Declined');
    });
  });
});
