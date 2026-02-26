export type UIContributionPoint =
  | "dashboard.widget"
  | "submission.detail.section"
  | "submission.list.action"
  | "pipeline.stage.action"
  | "settings.section"
  | "navigation.item"
  | "form.field"
  | "publication.preview";

export interface UIExtensionDeclaration {
  point: UIContributionPoint;
  id: string;
  label: string;
  icon?: string;
  requiredPermissions?: string[];
  component: string;
  order?: number;
}
