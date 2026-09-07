import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPackage, collectPackage, skillRoot } from "../tools/plugin-package.mjs";

const enabled = process.env.VIDEO_EDITOR_NATIVE_TESTS === "1";
const selector = "video-editor@my-ai-video-cut";
const marketplace = "my-ai-video-cut";

function fixture(t, homeVariable) {
  const root = mkdtempSync(path.join(os.tmpdir(), "video-plugin-native-"));
  t.after(() => rmSync(root, { recursive: true }));
  const home = path.join(root, "home");
  const cwd = path.join(root, "caller");
  mkdirSync(home);
  mkdirSync(cwd);
  const first = buildPackage({ outputDirectory: path.join(root, "first") });
  const second = buildPackage({ outputDirectory: path.join(root, "second") });
  const parts = first.version.split(".").map(Number);
  assert(parts.every(Number.isInteger), "Native upgrade fixture needs a stable release version");
  const version = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  for (const filename of ["plugin.json", ".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
    const file = path.join(second.output, filename);
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    manifest.version = version;
    writeFileSync(file, JSON.stringify(manifest, null, 2));
  }
  const skill = path.join(second.output, skillRoot, "SKILL.md");
  writeFileSync(skill, readFileSync(skill, "utf8").replace(`  version: "${first.version}"`, `  version: "${version}"`));
  assert.equal(collectPackage(second.output).metadata.version, version);
  return {
    cwd, first: first.output, second: second.output, version,
    env: { ...process.env, [homeVariable]: home, COPILOT_AUTO_UPDATE: "false" },
  };
}

function run(fixture, program, ...args) {
  const result = spawnSync(program, args, {
    cwd: fixture.cwd, env: fixture.env, encoding: "utf8",
    timeout: 120000, maxBuffer: 8 * 1024 * 1024,
  });
  assert(!result.error, `${program}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${program} ${args.join(" ")}:\n${result.stderr}\n${result.stdout}`);
  return result.stdout;
}

test("native Copilot installs and relocates the local marketplace", { skip: !enabled }, (t) => {
  const f = fixture(t, "COPILOT_HOME");
  run(f, "copilot", "plugin", "marketplace", "add", f.first);
  run(f, "copilot", "plugin", "install", selector);
  run(f, "copilot", "plugin", "uninstall", selector);
  run(f, "copilot", "plugin", "marketplace", "remove", marketplace);
  run(f, "copilot", "plugin", "marketplace", "add", f.second);
  run(f, "copilot", "plugin", "install", selector);
  assert(run(f, "copilot", "plugin", "marketplace", "list").includes(f.second));
  assert(run(f, "copilot", "plugin", "list").includes("video-editor"));
});

test("native Codex installs the new version after relocating the marketplace", { skip: !enabled }, (t) => {
  const f = fixture(t, "CODEX_HOME");
  run(f, "codex", "plugin", "marketplace", "add", f.first, "--json");
  run(f, "codex", "plugin", "add", selector, "--json");
  run(f, "codex", "plugin", "remove", selector);
  run(f, "codex", "plugin", "marketplace", "remove", marketplace);
  run(f, "codex", "plugin", "marketplace", "add", f.second, "--json");
  run(f, "codex", "plugin", "add", selector, "--json");
  const list = JSON.parse(run(f, "codex", "plugin", "list", "--marketplace", marketplace, "--json"));
  const installed = list.installed.find((plugin) => plugin.pluginId === selector);
  assert(installed?.enabled);
  assert.equal(installed.version, f.version);
  assert.equal(realpathSync(installed.source.path), realpathSync(f.second));
});

test("native Claude updates local-scope installation after source relocation", { skip: !enabled }, (t) => {
  const f = fixture(t, "CLAUDE_CONFIG_DIR");
  run(f, "claude", "plugin", "validate", path.join(f.first, ".claude-plugin/plugin.json"));
  run(f, "claude", "plugin", "marketplace", "add", f.first, "--scope", "local");
  run(f, "claude", "plugin", "install", selector, "--scope", "local");
  run(f, "claude", "plugin", "marketplace", "add", f.second, "--scope", "local");
  run(f, "claude", "plugin", "update", selector, "--scope", "local");
  const list = run(f, "claude", "plugin", "list");
  assert(list.includes(selector) && list.includes(f.version));
  assert(run(f, "claude", "plugin", "marketplace", "list").includes(f.second));
});
