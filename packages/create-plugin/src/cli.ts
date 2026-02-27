#!/usr/bin/env node
import { run } from "./run.js";

run().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
