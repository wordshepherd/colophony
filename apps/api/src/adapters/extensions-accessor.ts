import type { UIExtensionDeclaration } from '@colophony/plugin-sdk';

let _extensions: UIExtensionDeclaration[] = [];

export function setGlobalExtensions(
  extensions: UIExtensionDeclaration[],
): void {
  _extensions = extensions;
}

export function getGlobalExtensions(): UIExtensionDeclaration[] {
  return _extensions;
}
