export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) =>
      c ? c.toUpperCase() : "",
    )
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

export function toPluginId(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

export function validatePluginName(name: string): string | true {
  if (!name || name.trim().length === 0) {
    return "Plugin name is required";
  }
  if (name.length < 2) {
    return "Plugin name must be at least 2 characters";
  }
  if (name.length > 50) {
    return "Plugin name must be at most 50 characters";
  }
  if (/^-/.test(name)) {
    return "Plugin name cannot start with a hyphen";
  }
  if (!/^[a-z0-9][a-z0-9 -]*$/.test(name)) {
    return "Plugin name must contain only lowercase letters, numbers, spaces, and hyphens";
  }
  return true;
}
