import {
  isValidStatusTransition,
  isEditorAllowedTransition,
  VALID_STATUS_TRANSITIONS,
  EDITOR_ALLOWED_TRANSITIONS,
  type SubmissionStatus,
} from '@prospector/types';

describe('Submission Workflow', () => {
  describe('isValidStatusTransition', () => {
    it('should allow DRAFT -> SUBMITTED', () => {
      expect(isValidStatusTransition('DRAFT', 'SUBMITTED')).toBe(true);
    });

    it('should allow DRAFT -> WITHDRAWN', () => {
      expect(isValidStatusTransition('DRAFT', 'WITHDRAWN')).toBe(true);
    });

    it('should not allow DRAFT -> ACCEPTED', () => {
      expect(isValidStatusTransition('DRAFT', 'ACCEPTED')).toBe(false);
    });

    it('should allow SUBMITTED -> UNDER_REVIEW', () => {
      expect(isValidStatusTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
    });

    it('should allow SUBMITTED -> REJECTED', () => {
      expect(isValidStatusTransition('SUBMITTED', 'REJECTED')).toBe(true);
    });

    it('should allow SUBMITTED -> WITHDRAWN', () => {
      expect(isValidStatusTransition('SUBMITTED', 'WITHDRAWN')).toBe(true);
    });

    it('should allow UNDER_REVIEW -> ACCEPTED', () => {
      expect(isValidStatusTransition('UNDER_REVIEW', 'ACCEPTED')).toBe(true);
    });

    it('should allow UNDER_REVIEW -> REJECTED', () => {
      expect(isValidStatusTransition('UNDER_REVIEW', 'REJECTED')).toBe(true);
    });

    it('should allow UNDER_REVIEW -> HOLD', () => {
      expect(isValidStatusTransition('UNDER_REVIEW', 'HOLD')).toBe(true);
    });

    it('should allow HOLD -> UNDER_REVIEW', () => {
      expect(isValidStatusTransition('HOLD', 'UNDER_REVIEW')).toBe(true);
    });

    it('should allow HOLD -> ACCEPTED', () => {
      expect(isValidStatusTransition('HOLD', 'ACCEPTED')).toBe(true);
    });

    it('should not allow any transitions from ACCEPTED (terminal)', () => {
      const statuses: SubmissionStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'HOLD',
        'REJECTED',
        'WITHDRAWN',
      ];
      for (const status of statuses) {
        expect(isValidStatusTransition('ACCEPTED', status)).toBe(false);
      }
    });

    it('should not allow any transitions from REJECTED (terminal)', () => {
      const statuses: SubmissionStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'HOLD',
        'ACCEPTED',
        'WITHDRAWN',
      ];
      for (const status of statuses) {
        expect(isValidStatusTransition('REJECTED', status)).toBe(false);
      }
    });

    it('should not allow any transitions from WITHDRAWN (terminal)', () => {
      const statuses: SubmissionStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'HOLD',
        'ACCEPTED',
        'REJECTED',
      ];
      for (const status of statuses) {
        expect(isValidStatusTransition('WITHDRAWN', status)).toBe(false);
      }
    });
  });

  describe('isEditorAllowedTransition', () => {
    it('should not allow editors to transition from DRAFT', () => {
      expect(isEditorAllowedTransition('DRAFT', 'SUBMITTED')).toBe(false);
      expect(isEditorAllowedTransition('DRAFT', 'WITHDRAWN')).toBe(false);
    });

    it('should allow editors to move SUBMITTED -> UNDER_REVIEW', () => {
      expect(isEditorAllowedTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
    });

    it('should allow editors to move SUBMITTED -> REJECTED', () => {
      expect(isEditorAllowedTransition('SUBMITTED', 'REJECTED')).toBe(true);
    });

    it('should not allow editors to withdraw (submitter action)', () => {
      expect(isEditorAllowedTransition('SUBMITTED', 'WITHDRAWN')).toBe(false);
      expect(isEditorAllowedTransition('UNDER_REVIEW', 'WITHDRAWN')).toBe(false);
    });

    it('should allow editors to accept from UNDER_REVIEW', () => {
      expect(isEditorAllowedTransition('UNDER_REVIEW', 'ACCEPTED')).toBe(true);
    });

    it('should allow editors to reject from UNDER_REVIEW', () => {
      expect(isEditorAllowedTransition('UNDER_REVIEW', 'REJECTED')).toBe(true);
    });

    it('should allow editors to hold from UNDER_REVIEW', () => {
      expect(isEditorAllowedTransition('UNDER_REVIEW', 'HOLD')).toBe(true);
    });

    it('should allow editors to move HOLD -> UNDER_REVIEW', () => {
      expect(isEditorAllowedTransition('HOLD', 'UNDER_REVIEW')).toBe(true);
    });

    it('should allow editors to accept from HOLD', () => {
      expect(isEditorAllowedTransition('HOLD', 'ACCEPTED')).toBe(true);
    });

    it('should allow editors to reject from HOLD', () => {
      expect(isEditorAllowedTransition('HOLD', 'REJECTED')).toBe(true);
    });
  });

  describe('VALID_STATUS_TRANSITIONS', () => {
    it('should have all statuses defined', () => {
      const allStatuses: SubmissionStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'ACCEPTED',
        'REJECTED',
        'HOLD',
        'WITHDRAWN',
      ];

      for (const status of allStatuses) {
        expect(VALID_STATUS_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(VALID_STATUS_TRANSITIONS[status])).toBe(true);
      }
    });
  });

  describe('EDITOR_ALLOWED_TRANSITIONS', () => {
    it('should be a subset of VALID_STATUS_TRANSITIONS', () => {
      const allStatuses: SubmissionStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'ACCEPTED',
        'REJECTED',
        'HOLD',
        'WITHDRAWN',
      ];

      for (const status of allStatuses) {
        const editorAllowed = EDITOR_ALLOWED_TRANSITIONS[status];
        const validTransitions = VALID_STATUS_TRANSITIONS[status];

        for (const target of editorAllowed) {
          expect(validTransitions).toContain(target);
        }
      }
    });
  });
});
