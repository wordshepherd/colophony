import { collectAnswers } from "./prompts.js";
import { buildFileMap, scaffoldProject } from "./write.js";

export async function run(options?: {
  cwd?: string;
}): Promise<{ outputDir: string; files: string[] }> {
  console.log("\nColophony Plugin Scaffolder\n");

  const answers = await collectAnswers();
  const input = buildFileMap(answers, options);

  await scaffoldProject(input);

  const files = Object.keys(input.files);

  console.log(`\nCreated ${files.length} files in ${input.outputDir}\n`);
  console.log("Next steps:");
  console.log(`  cd ${input.outputDir}`);
  console.log("  npm install");
  console.log("  npm run build");
  console.log("  npm test\n");

  return { outputDir: input.outputDir, files };
}
