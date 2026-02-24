import type { CmsAdapterType } from "@colophony/types";

export interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url";
  required: boolean;
  description?: string;
}

interface AdapterConfig {
  label: string;
  badgeVariant: "default" | "secondary" | "outline";
  configFields: ConfigField[];
}

export const cmsAdapterConfig: Record<CmsAdapterType, AdapterConfig> = {
  WORDPRESS: {
    label: "WordPress",
    badgeVariant: "default",
    configFields: [
      {
        key: "siteUrl",
        label: "Site URL",
        placeholder: "https://example.com",
        type: "url",
        required: true,
        description: "The URL of your WordPress site",
      },
      {
        key: "username",
        label: "Username",
        placeholder: "admin",
        type: "text",
        required: true,
        description: "WordPress username with API access",
      },
      {
        key: "applicationPassword",
        label: "Application Password",
        placeholder: "xxxx xxxx xxxx xxxx xxxx xxxx",
        type: "password",
        required: true,
        description:
          "Generate an application password in WordPress under Users → Profile",
      },
    ],
  },
  GHOST: {
    label: "Ghost",
    badgeVariant: "secondary",
    configFields: [
      {
        key: "apiUrl",
        label: "API URL",
        placeholder: "https://your-site.ghost.io",
        type: "url",
        required: true,
        description: "Your Ghost site URL",
      },
      {
        key: "adminApiKey",
        label: "Admin API Key",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx:yyyyyyyy",
        type: "password",
        required: true,
        description:
          "Found in Ghost Admin under Settings → Integrations → Custom",
      },
    ],
  },
};

export function getAdapterLabel(type: CmsAdapterType): string {
  return cmsAdapterConfig[type].label;
}

export function getAdapterConfigFields(type: CmsAdapterType): ConfigField[] {
  return cmsAdapterConfig[type].configFields;
}

export function maskConfigValue(value: unknown, fieldType: string): string {
  const str = String(value ?? "");
  if (fieldType !== "password") return str;
  if (str.length <= 4) return "••••";
  return "••••" + str.slice(-4);
}
