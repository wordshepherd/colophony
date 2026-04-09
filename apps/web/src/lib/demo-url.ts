/**
 * Returns the URL for the demo site.
 * On the demo subdomain itself, returns a relative path.
 * Otherwise, constructs the demo subdomain URL.
 */
export function getDemoUrl(): string {
  if (typeof window === "undefined") return "/demo";
  const host = window.location.hostname;
  if (host.startsWith("demo.")) return "/demo";
  const proto = window.location.protocol;
  return `${proto}//demo.${host}/demo`;
}
