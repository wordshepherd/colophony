import {
  formDefinitions,
  formFields,
  formPages,
  submissionPeriods,
  submissions,
  eq,
  and,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { desc, asc, ilike, count, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type {
  CreateFormDefinitionInput,
  UpdateFormDefinitionInput,
  CreateFormFieldInput,
  UpdateFormFieldInput,
  ReorderFormFieldsInput,
  ListFormDefinitionsInput,
  CreateFormPageInput,
  UpdateFormPageInput,
  ReorderFormPagesInput,
  FormFieldError,
} from '@colophony/types';
import {
  AuditActions,
  AuditResources,
  PRESENTATIONAL_FIELD_TYPES,
  evaluateFieldVisibilityWithBranching,
  extractBranchingConfig,
} from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';
import { validateFieldValue } from './form-validation.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class FormNotFoundError extends Error {
  constructor(id: string) {
    super(`Form definition "${id}" not found`);
    this.name = 'FormNotFoundError';
  }
}

export class FormFieldNotFoundError extends Error {
  constructor(id: string) {
    super(`Form field "${id}" not found`);
    this.name = 'FormFieldNotFoundError';
  }
}

export class FormPageNotFoundError extends Error {
  constructor(id: string) {
    super(`Form page "${id}" not found`);
    this.name = 'FormPageNotFoundError';
  }
}

export class InvalidBranchReferenceError extends Error {
  constructor(details: string) {
    super(`Invalid branch reference: ${details}`);
    this.name = 'InvalidBranchReferenceError';
  }
}

export class FormNotDraftError extends Error {
  constructor() {
    super('Form must be in DRAFT status for this operation');
    this.name = 'FormNotDraftError';
  }
}

export class FormNotPublishedError extends Error {
  constructor() {
    super('Form must be in PUBLISHED status for this operation');
    this.name = 'FormNotPublishedError';
  }
}

export class DuplicateFieldKeyError extends Error {
  constructor(key: string) {
    super(`Field key "${key}" already exists in this form`);
    this.name = 'DuplicateFieldKeyError';
  }
}

export class FormHasNoFieldsError extends Error {
  constructor() {
    super('Cannot publish a form with no fields');
    this.name = 'FormHasNoFieldsError';
  }
}

export class FormInUseError extends Error {
  constructor() {
    super(
      'Cannot delete this form because it is referenced by submission periods or submissions',
    );
    this.name = 'FormInUseError';
  }
}

export class InvalidFormDataError extends Error {
  readonly fieldErrors: FormFieldError[];

  constructor(fieldErrors: FormFieldError[]) {
    super('Form data validation failed');
    this.name = 'InvalidFormDataError';
    this.fieldErrors = fieldErrors;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getFormForUpdate(tx: DrizzleDb, id: string) {
  const rows = await tx.execute<{
    id: string;
    status: string;
  }>(sql`SELECT id, status FROM form_definitions WHERE id = ${id} FOR UPDATE`);
  return rows.rows[0] ?? null;
}

async function assertDraft(tx: DrizzleDb, id: string) {
  const form = await getFormForUpdate(tx, id);
  if (!form) throw new FormNotFoundError(id);
  if (form.status !== 'DRAFT') throw new FormNotDraftError();
  return form;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const formService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListFormDefinitionsInput) {
    const { status, search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(formDefinitions.status, status));
    if (search) conditions.push(ilike(formDefinitions.name, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(formDefinitions)
        .where(where)
        .orderBy(desc(formDefinitions.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(formDefinitions).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(tx: DrizzleDb, id: string) {
    const [form] = await tx
      .select()
      .from(formDefinitions)
      .where(eq(formDefinitions.id, id))
      .limit(1);

    if (!form) return null;

    const [fields, pages] = await Promise.all([
      tx
        .select()
        .from(formFields)
        .where(eq(formFields.formDefinitionId, id))
        .orderBy(asc(formFields.sortOrder)),
      tx
        .select()
        .from(formPages)
        .where(eq(formPages.formDefinitionId, id))
        .orderBy(asc(formPages.sortOrder)),
    ]);

    return { ...form, fields, pages };
  },

  // -------------------------------------------------------------------------
  // Create / Update / Delete
  // -------------------------------------------------------------------------

  async create(
    tx: DrizzleDb,
    input: CreateFormDefinitionInput,
    orgId: string,
    userId: string,
  ) {
    const [form] = await tx
      .insert(formDefinitions)
      .values({
        organizationId: orgId,
        name: input.name,
        description: input.description ?? null,
        status: 'DRAFT',
        version: 1,
        createdBy: userId,
      })
      .returning();

    return form;
  },

  async createWithAudit(svc: ServiceContext, input: CreateFormDefinitionInput) {
    assertEditorOrAdmin(svc.actor.role);
    const form = await formService.create(
      svc.tx,
      input,
      svc.actor.orgId,
      svc.actor.userId,
    );
    await svc.audit({
      action: AuditActions.FORM_CREATED,
      resource: AuditResources.FORM,
      resourceId: form.id,
      newValue: { name: input.name },
    });
    return form;
  },

  async update(tx: DrizzleDb, id: string, input: UpdateFormDefinitionInput) {
    await assertDraft(tx, id);

    const [updated] = await tx
      .update(formDefinitions)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(formDefinitions.id, id))
      .returning();

    return updated ?? null;
  },

  async updateWithAudit(
    svc: ServiceContext,
    id: string,
    input: UpdateFormDefinitionInput,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    const updated = await formService.update(svc.tx, id, input);
    if (!updated) throw new FormNotFoundError(id);
    await svc.audit({
      action: AuditActions.FORM_UPDATED,
      resource: AuditResources.FORM,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  // -------------------------------------------------------------------------
  // Publish / Archive
  // -------------------------------------------------------------------------

  async publish(tx: DrizzleDb, id: string) {
    await assertDraft(tx, id);

    // Check that the form has at least one field
    const allFields = await tx
      .select()
      .from(formFields)
      .where(eq(formFields.formDefinitionId, id));

    if (allFields.length === 0) throw new FormHasNoFieldsError();

    // Validate branchId references
    const validBranchIds = new Set<string>();
    for (const field of allFields) {
      const branching = extractBranchingConfig(field.config);
      if (branching?.enabled) {
        for (const branch of branching.branches) {
          validBranchIds.add(branch.id);
        }
      }
    }

    for (const field of allFields) {
      if (field.branchId && !validBranchIds.has(field.branchId)) {
        throw new InvalidBranchReferenceError(
          `Field "${field.fieldKey}" references branch "${field.branchId}" which does not exist`,
        );
      }
    }

    // Check for circular branch chains
    for (const field of allFields) {
      if (field.branchId) {
        const visited = new Set<string>();
        let currentBranchId: string | null = field.branchId;
        while (currentBranchId) {
          if (visited.has(currentBranchId)) {
            throw new InvalidBranchReferenceError(
              `Circular branch chain detected involving field "${field.fieldKey}"`,
            );
          }
          visited.add(currentBranchId);
          // Find the source field for this branch
          const sourceField = allFields.find((f) => {
            const b = extractBranchingConfig(f.config);
            return (
              b?.enabled && b.branches.some((br) => br.id === currentBranchId)
            );
          });
          currentBranchId = sourceField?.branchId ?? null;
        }
      }
    }

    const [published] = await tx
      .update(formDefinitions)
      .set({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(formDefinitions.id, id))
      .returning();

    return published;
  },

  async publishWithAudit(svc: ServiceContext, id: string) {
    assertEditorOrAdmin(svc.actor.role);
    const published = await formService.publish(svc.tx, id);
    await svc.audit({
      action: AuditActions.FORM_PUBLISHED,
      resource: AuditResources.FORM,
      resourceId: id,
    });
    return published;
  },

  async archive(tx: DrizzleDb, id: string) {
    const form = await getFormForUpdate(tx, id);
    if (!form) throw new FormNotFoundError(id);
    if (form.status !== 'PUBLISHED') throw new FormNotPublishedError();

    const [archived] = await tx
      .update(formDefinitions)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(formDefinitions.id, id))
      .returning();

    return archived;
  },

  async archiveWithAudit(svc: ServiceContext, id: string) {
    assertEditorOrAdmin(svc.actor.role);
    const archived = await formService.archive(svc.tx, id);
    await svc.audit({
      action: AuditActions.FORM_ARCHIVED,
      resource: AuditResources.FORM,
      resourceId: id,
    });
    return archived;
  },

  // -------------------------------------------------------------------------
  // Duplicate
  // -------------------------------------------------------------------------

  async duplicate(tx: DrizzleDb, id: string, orgId: string, userId: string) {
    const source = await formService.getById(tx, id);
    if (!source) throw new FormNotFoundError(id);

    const [newForm] = await tx
      .insert(formDefinitions)
      .values({
        organizationId: orgId,
        name: `${source.name} (copy)`,
        description: source.description,
        status: 'DRAFT',
        version: source.version + 1,
        duplicatedFromId: source.id,
        createdBy: userId,
      })
      .returning();

    // Copy pages with new UUIDs
    const pageIdMap = new Map<string, string>();
    if (source.pages.length > 0) {
      const newPages = source.pages.map((p) => {
        const newPageId = randomUUID();
        pageIdMap.set(p.id, newPageId);
        return {
          id: newPageId,
          formDefinitionId: newForm.id,
          title: p.title,
          description: p.description,
          sortOrder: p.sortOrder,
          branchingRules: p.branchingRules,
        };
      });
      await tx.insert(formPages).values(newPages);
    }

    // Copy fields with remapped branchIds and pageIds
    const branchIdMap = new Map<string, string>();
    if (source.fields.length > 0) {
      // First pass: remap branching config in fields that are branch sources
      const fieldValues = source.fields.map((f) => {
        let config = f.config;
        const branching = extractBranchingConfig(f.config);
        if (branching?.enabled) {
          const newBranches = branching.branches.map((b) => {
            const newBranchId = randomUUID();
            branchIdMap.set(b.id, newBranchId);
            return { ...b, id: newBranchId };
          });
          config = {
            ...config,
            branching: { enabled: true, branches: newBranches },
          };
        }
        return {
          formDefinitionId: newForm.id,
          fieldKey: f.fieldKey,
          fieldType: f.fieldType,
          label: f.label,
          description: f.description,
          placeholder: f.placeholder,
          required: f.required,
          sortOrder: f.sortOrder,
          config,
          conditionalRules: f.conditionalRules,
          branchId: f.branchId ? (branchIdMap.get(f.branchId) ?? null) : null,
          pageId: f.pageId ? (pageIdMap.get(f.pageId) ?? null) : null,
        };
      });

      // Second pass: remap branchId references (some may reference branches
      // from fields processed later in the first pass)
      for (const fv of fieldValues) {
        if (fv.branchId === null) {
          // Check the original field for a branchId that wasn't mapped yet in first pass
          const originalField = source.fields.find(
            (f) => f.fieldKey === fv.fieldKey,
          );
          if (originalField?.branchId) {
            fv.branchId = branchIdMap.get(originalField.branchId) ?? null;
          }
        }
      }

      await tx.insert(formFields).values(fieldValues);
    }

    return formService.getById(tx, newForm.id);
  },

  async duplicateWithAudit(svc: ServiceContext, id: string) {
    assertEditorOrAdmin(svc.actor.role);
    const duplicated = await formService.duplicate(
      svc.tx,
      id,
      svc.actor.orgId,
      svc.actor.userId,
    );
    if (!duplicated) throw new FormNotFoundError(id);
    await svc.audit({
      action: AuditActions.FORM_DUPLICATED,
      resource: AuditResources.FORM,
      resourceId: duplicated.id,
      newValue: { sourceFormId: id },
    });
    return duplicated;
  },

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  async delete(tx: DrizzleDb, id: string) {
    await assertDraft(tx, id);

    // Check if referenced by submission periods or submissions
    const [periodRefs, submissionRefs] = await Promise.all([
      tx
        .select({ count: count() })
        .from(submissionPeriods)
        .where(eq(submissionPeriods.formDefinitionId, id)),
      tx
        .select({ count: count() })
        .from(submissions)
        .where(eq(submissions.formDefinitionId, id)),
    ]);

    if (
      (periodRefs[0]?.count ?? 0) > 0 ||
      (submissionRefs[0]?.count ?? 0) > 0
    ) {
      throw new FormInUseError();
    }

    const [deleted] = await tx
      .delete(formDefinitions)
      .where(eq(formDefinitions.id, id))
      .returning();

    return deleted ?? null;
  },

  async deleteWithAudit(svc: ServiceContext, id: string) {
    assertEditorOrAdmin(svc.actor.role);
    const deleted = await formService.delete(svc.tx, id);
    if (!deleted) throw new FormNotFoundError(id);
    await svc.audit({
      action: AuditActions.FORM_DELETED,
      resource: AuditResources.FORM,
      resourceId: id,
    });
    return { success: true as const };
  },

  // -------------------------------------------------------------------------
  // Field Operations
  // -------------------------------------------------------------------------

  async addField(tx: DrizzleDb, formId: string, input: CreateFormFieldInput) {
    await assertDraft(tx, formId);

    // Auto-assign sortOrder if not provided
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const maxResult = await tx.execute<{ max_order: number | null }>(
        sql`SELECT MAX(sort_order) as max_order FROM form_fields WHERE form_definition_id = ${formId}`,
      );
      sortOrder = (maxResult.rows[0]?.max_order ?? -1) + 1;
    }

    const [field] = await tx
      .insert(formFields)
      .values({
        formDefinitionId: formId,
        fieldKey: input.fieldKey,
        fieldType: input.fieldType,
        label: input.label,
        description: input.description ?? null,
        placeholder: input.placeholder ?? null,
        required: input.required ?? false,
        sortOrder,
        config: input.config ?? {},
        branchId: input.branchId ?? null,
        pageId: input.pageId ?? null,
      })
      .returning();

    return field;
  },

  async addFieldWithAudit(
    svc: ServiceContext,
    formId: string,
    input: CreateFormFieldInput,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    try {
      const field = await formService.addField(svc.tx, formId, input);
      await svc.audit({
        action: AuditActions.FORM_FIELD_ADDED,
        resource: AuditResources.FORM,
        resourceId: formId,
        newValue: { fieldId: field.id, fieldKey: input.fieldKey },
      });
      return field;
    } catch (e) {
      // Map unique constraint violation to DuplicateFieldKeyError
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: string }).code === '23505'
      ) {
        throw new DuplicateFieldKeyError(input.fieldKey);
      }
      throw e;
    }
  },

  async updateField(
    tx: DrizzleDb,
    formId: string,
    fieldId: string,
    input: UpdateFormFieldInput,
  ) {
    await assertDraft(tx, formId);

    const [existing] = await tx
      .select()
      .from(formFields)
      .where(
        and(
          eq(formFields.id, fieldId),
          eq(formFields.formDefinitionId, formId),
        ),
      )
      .limit(1);

    if (!existing) throw new FormFieldNotFoundError(fieldId);

    const [updated] = await tx
      .update(formFields)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.placeholder !== undefined
          ? { placeholder: input.placeholder }
          : {}),
        ...(input.required !== undefined ? { required: input.required } : {}),
        ...(input.config !== undefined ? { config: input.config } : {}),
        ...(input.conditionalRules !== undefined
          ? { conditionalRules: input.conditionalRules }
          : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.pageId !== undefined ? { pageId: input.pageId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(formFields.id, fieldId))
      .returning();

    return updated ?? null;
  },

  async updateFieldWithAudit(
    svc: ServiceContext,
    formId: string,
    fieldId: string,
    input: UpdateFormFieldInput,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    const updated = await formService.updateField(
      svc.tx,
      formId,
      fieldId,
      input,
    );
    if (!updated) throw new FormFieldNotFoundError(fieldId);
    await svc.audit({
      action: AuditActions.FORM_FIELD_UPDATED,
      resource: AuditResources.FORM,
      resourceId: formId,
      newValue: { fieldId, ...input },
    });
    return updated;
  },

  async removeField(tx: DrizzleDb, formId: string, fieldId: string) {
    await assertDraft(tx, formId);

    // Load the field to check for branching config before deleting
    const [toDelete] = await tx
      .select()
      .from(formFields)
      .where(
        and(
          eq(formFields.id, fieldId),
          eq(formFields.formDefinitionId, formId),
        ),
      )
      .limit(1);

    if (!toDelete) throw new FormFieldNotFoundError(fieldId);

    // If this field has branching enabled, clear branchId on orphaned fields
    const branching = extractBranchingConfig(toDelete.config);
    if (branching?.enabled && branching.branches.length > 0) {
      const orphanedBranchIds = branching.branches.map((b) => b.id);
      await tx
        .update(formFields)
        .set({ branchId: null, updatedAt: new Date() })
        .where(
          and(
            eq(formFields.formDefinitionId, formId),
            inArray(formFields.branchId, orphanedBranchIds),
          ),
        );
    }

    const [deleted] = await tx
      .delete(formFields)
      .where(eq(formFields.id, fieldId))
      .returning();

    return deleted;
  },

  async removeFieldWithAudit(
    svc: ServiceContext,
    formId: string,
    fieldId: string,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    const removed = await formService.removeField(svc.tx, formId, fieldId);
    await svc.audit({
      action: AuditActions.FORM_FIELD_REMOVED,
      resource: AuditResources.FORM,
      resourceId: formId,
      newValue: { fieldId },
    });
    return removed;
  },

  async reorderFields(
    tx: DrizzleDb,
    formId: string,
    input: ReorderFormFieldsInput,
  ) {
    await assertDraft(tx, formId);

    // Verify all field IDs belong to this form
    const existingFields = await tx
      .select({ id: formFields.id })
      .from(formFields)
      .where(eq(formFields.formDefinitionId, formId));

    const existingIds = new Set(existingFields.map((f) => f.id));
    for (const fieldId of input.fieldIds) {
      if (!existingIds.has(fieldId)) throw new FormFieldNotFoundError(fieldId);
    }

    // Bulk update sortOrder
    for (let i = 0; i < input.fieldIds.length; i++) {
      await tx
        .update(formFields)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(formFields.id, input.fieldIds[i]));
    }

    return tx
      .select()
      .from(formFields)
      .where(eq(formFields.formDefinitionId, formId))
      .orderBy(asc(formFields.sortOrder));
  },

  async reorderFieldsWithAudit(
    svc: ServiceContext,
    formId: string,
    input: ReorderFormFieldsInput,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    const fields = await formService.reorderFields(svc.tx, formId, input);
    await svc.audit({
      action: AuditActions.FORM_FIELDS_REORDERED,
      resource: AuditResources.FORM,
      resourceId: formId,
      newValue: { fieldIds: input.fieldIds },
    });
    return fields;
  },

  // -------------------------------------------------------------------------
  // Form Data Validation
  // -------------------------------------------------------------------------

  /**
   * Validate submission formData against a published form definition.
   * Returns field-level errors. Skips presentational fields.
   */
  async validateFormData(
    tx: DrizzleDb,
    formDefinitionId: string,
    data: Record<string, unknown>,
  ): Promise<FormFieldError[]> {
    const form = await formService.getById(tx, formDefinitionId);
    if (!form) throw new FormNotFoundError(formDefinitionId);

    const errors: FormFieldError[] = [];

    for (const field of form.fields) {
      // Skip presentational fields
      if (PRESENTATIONAL_FIELD_TYPES.includes(field.fieldType)) {
        continue;
      }

      // Evaluate conditional visibility (includes branching)
      const { visible, required: conditionallyRequired } =
        evaluateFieldVisibilityWithBranching(
          {
            branchId: field.branchId,
            conditionalRules: field.conditionalRules,
          },
          form.fields,
          data,
        );

      // Skip hidden fields entirely — no validation
      if (!visible) continue;

      const isRequired = field.required || conditionallyRequired;
      const value = data[field.fieldKey];

      // Required check
      if (
        isRequired &&
        (value === undefined || value === null || value === '')
      ) {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} is required`,
        });
        continue;
      }

      // Skip further validation if value is not provided and not required
      if (value === undefined || value === null || value === '') continue;

      // Type-specific validation
      const fieldErrors = validateFieldValue(field, value);
      errors.push(...fieldErrors);
    }

    return errors;
  },

  // -------------------------------------------------------------------------
  // Page Operations
  // -------------------------------------------------------------------------

  async addPage(tx: DrizzleDb, formId: string, input: CreateFormPageInput) {
    await assertDraft(tx, formId);

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const maxResult = await tx.execute<{ max_order: number | null }>(
        sql`SELECT MAX(sort_order) as max_order FROM form_pages WHERE form_definition_id = ${formId}`,
      );
      sortOrder = (maxResult.rows[0]?.max_order ?? -1) + 1;
    }

    const [page] = await tx
      .insert(formPages)
      .values({
        formDefinitionId: formId,
        title: input.title,
        description: input.description ?? null,
        sortOrder,
      })
      .returning();

    return page;
  },

  async addPageWithAudit(
    svc: ServiceContext,
    formId: string,
    input: CreateFormPageInput,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    const page = await formService.addPage(svc.tx, formId, input);
    await svc.audit({
      action: AuditActions.FORM_PAGE_ADDED,
      resource: AuditResources.FORM,
      resourceId: formId,
      newValue: { pageId: page.id, title: input.title },
    });
    return page;
  },

  async updatePage(
    tx: DrizzleDb,
    formId: string,
    pageId: string,
    input: UpdateFormPageInput,
  ) {
    await assertDraft(tx, formId);

    const [existing] = await tx
      .select()
      .from(formPages)
      .where(
        and(eq(formPages.id, pageId), eq(formPages.formDefinitionId, formId)),
      )
      .limit(1);

    if (!existing) throw new FormPageNotFoundError(pageId);

    const [updated] = await tx
      .update(formPages)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.branchingRules !== undefined
          ? { branchingRules: input.branchingRules }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(formPages.id, pageId))
      .returning();

    return updated ?? null;
  },

  async updatePageWithAudit(
    svc: ServiceContext,
    formId: string,
    pageId: string,
    input: UpdateFormPageInput,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    const updated = await formService.updatePage(svc.tx, formId, pageId, input);
    if (!updated) throw new FormPageNotFoundError(pageId);
    await svc.audit({
      action: AuditActions.FORM_PAGE_UPDATED,
      resource: AuditResources.FORM,
      resourceId: formId,
      newValue: { pageId, ...input },
    });
    return updated;
  },

  async removePage(tx: DrizzleDb, formId: string, pageId: string) {
    await assertDraft(tx, formId);

    const [deleted] = await tx
      .delete(formPages)
      .where(
        and(eq(formPages.id, pageId), eq(formPages.formDefinitionId, formId)),
      )
      .returning();

    if (!deleted) throw new FormPageNotFoundError(pageId);
    return deleted;
  },

  async removePageWithAudit(
    svc: ServiceContext,
    formId: string,
    pageId: string,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    const removed = await formService.removePage(svc.tx, formId, pageId);
    await svc.audit({
      action: AuditActions.FORM_PAGE_REMOVED,
      resource: AuditResources.FORM,
      resourceId: formId,
      newValue: { pageId },
    });
    return removed;
  },

  async reorderPages(
    tx: DrizzleDb,
    formId: string,
    input: ReorderFormPagesInput,
  ) {
    await assertDraft(tx, formId);

    const existingPages = await tx
      .select({ id: formPages.id })
      .from(formPages)
      .where(eq(formPages.formDefinitionId, formId));

    const existingIds = new Set(existingPages.map((p) => p.id));
    for (const pageId of input.pageIds) {
      if (!existingIds.has(pageId)) throw new FormPageNotFoundError(pageId);
    }

    for (let i = 0; i < input.pageIds.length; i++) {
      await tx
        .update(formPages)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(formPages.id, input.pageIds[i]));
    }

    return tx
      .select()
      .from(formPages)
      .where(eq(formPages.formDefinitionId, formId))
      .orderBy(asc(formPages.sortOrder));
  },

  async reorderPagesWithAudit(
    svc: ServiceContext,
    formId: string,
    input: ReorderFormPagesInput,
  ) {
    assertEditorOrAdmin(svc.actor.role);
    const pages = await formService.reorderPages(svc.tx, formId, input);
    await svc.audit({
      action: AuditActions.FORM_PAGES_REORDERED,
      resource: AuditResources.FORM,
      resourceId: formId,
      newValue: { pageIds: input.pageIds },
    });
    return pages;
  },

  // -------------------------------------------------------------------------
  // DataLoader batch methods
  // -------------------------------------------------------------------------

  /**
   * Batch-load form fields by form definition IDs.
   * Used by GraphQL DataLoader for N+1 prevention.
   */
  async getFieldsByFormIds(tx: DrizzleDb, formIds: string[]) {
    if (formIds.length === 0)
      return new Map<string, (typeof formFields.$inferSelect)[]>();

    const rows = await tx
      .select()
      .from(formFields)
      .where(inArray(formFields.formDefinitionId, formIds))
      .orderBy(asc(formFields.sortOrder));

    const grouped = new Map<string, (typeof formFields.$inferSelect)[]>();
    for (const row of rows) {
      const list = grouped.get(row.formDefinitionId) ?? [];
      list.push(row);
      grouped.set(row.formDefinitionId, list);
    }

    return grouped;
  },

  /**
   * Batch-load form pages by form definition IDs.
   * Used by GraphQL DataLoader for N+1 prevention.
   */
  async getPagesByFormIds(tx: DrizzleDb, formIds: string[]) {
    if (formIds.length === 0)
      return new Map<string, (typeof formPages.$inferSelect)[]>();

    const rows = await tx
      .select()
      .from(formPages)
      .where(inArray(formPages.formDefinitionId, formIds))
      .orderBy(asc(formPages.sortOrder));

    const grouped = new Map<string, (typeof formPages.$inferSelect)[]>();
    for (const row of rows) {
      const list = grouped.get(row.formDefinitionId) ?? [];
      list.push(row);
      grouped.set(row.formDefinitionId, list);
    }

    return grouped;
  },
};
