import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { repositoryRoot, skillRoot } from "../tools/plugin-package.mjs";
import { readInstallCommand } from "./support/install-commands.mjs";

test("the source tree contains only the current implementation", () => {
  const paths = execFileSync("git", [
    "-c", "core.fsmonitor=false", "ls-files", "--cached", "--others", "--exclude-standard", "-z",
  ], { cwd: repositoryRoot, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } })
    .split("\0").filter(Boolean);
  const python = paths.filter((filename) => /\.py$/i.test(filename)
    && existsSync(path.join(repositoryRoot, filename)));
  assert.deepEqual(python, [], "Repository Python implementations must not be reintroduced");
  for (const filename of [
    "requirements.txt", "scripts", `${skillRoot}/scripts`,
    "skill_video_editor_agent.md", "uiux8_demo_video_production.md", "config/demo_scenario.json",
  ]) {
    assert(!existsSync(path.join(repositoryRoot, filename)), `Retired path exists: ${filename}`);
  }
});

test("active guidance has no retired entry points or compatibility instructions", () => {
  for (const filename of [
    "README.md", ".github/copilot-instructions.md", ".github/agents/video-editor.agent.md",
    `${skillRoot}/SKILL.md`, "docs/INSTALLATION.md", "docs/DEVELOPMENT.md",
  ]) {
    const text = readFileSync(path.join(repositoryRoot, filename), "utf8");
    assert(!/legacy|레거시|호환용|run_pipeline\.py|requirements\.txt|skill_video_editor_agent|demo_scenario\.json|uiux8_demo_video_production/i.test(text),
      `Retired guidance remains in ${filename}`);
  }
});

for (const client of ["copilot", "codex", "claude"]) {
  test(`README provides one valid single-line ${client} installation command`, () => {
    const command = readInstallCommand(client);
    assert.equal(command.split("\n").length, 1);
    const result = spawnSync("bash", ["-n"], { input: command, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  });
}
