import { toKebabCase } from "../utils.js";
import type { PluginAnswers } from "../prompts.js";

export function generateReadme(answers: PluginAnswers): string {
  const kebab = toKebabCase(answers.name);
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
import { ${kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")}Plugin } from "${pkgName}";

export default defineConfig({
  plugins: [new ${kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")}Plugin()],
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
