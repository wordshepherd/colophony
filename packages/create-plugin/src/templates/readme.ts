import { toKebabCase, toPascalCase } from "../utils.js";
import type { PluginAnswers } from "../prompts.js";

export function generateReadme(answers: PluginAnswers): string {
  const kebab = toKebabCase(answers.name);
  const pascal = toPascalCase(answers.name);
  const pkgName = `colophony-plugin-${kebab}`;

  return `# ${answers.name}

${answers.description || `A Colophony plugin: ${answers.name}`}

## Installation

\`\`\`bash
npm install ${pkgName}
\`\`\`

## Usage

Add the plugin to your \`colophony.config.ts\`:

\`\`\`typescript
import { defineConfig } from "@colophony/plugin-sdk";
import { ${pascal}Plugin } from "${pkgName}";

export default defineConfig({
  plugins: [new ${pascal}Plugin()],
});
\`\`\`

## Development

\`\`\`bash
npm install
npm run build
npm test
\`\`\`

## License

${answers.license || "MIT"}
`;
}
