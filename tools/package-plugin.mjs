#!/usr/bin/env node
import { parseArgs } from "node:util";
import { buildPackage, repositoryRoot } from "./plugin-package.mjs";

try {
  const { values } = parseArgs({
    options: {
      output: { type: "string" },
      source: { type: "string", default: repositoryRoot },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log("Usage: node tools/package-plugin.mjs --output <new-directory> [--source <repository>]");
  } else {
    const result = buildPackage({ sourceRoot: values.source, outputDirectory: values.output });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(`Plugin packaging failed: ${error.message}`);
  process.exitCode = 1;
}
