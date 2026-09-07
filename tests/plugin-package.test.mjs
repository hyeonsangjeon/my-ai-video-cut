import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPackage,
  collectPackage,
  inspectPackage,
  repositoryRoot,
  skillRoot,
} from "../tools/plugin-package.mjs";

function workspace(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "video-plugin-package-"));
  t.after(() => rmSync(directory, { recursive: true }));
  return directory;
}

function sourceFixture(t) {
  const root = workspace(t);
  for (const [filename, bytes] of collectPackage().entries) {
    const target = path.join(root, filename);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  return root;
}

function change(entries, filename, transform) {
  const result = new Map(entries);
  result.set(filename, Buffer.from(transform(result.get(filename).toString("utf8"))));
  return result;
}

test("three native manifests and the standalone skill share one package contract", () => {
  const { entries, metadata } = collectPackage();
  assert.equal(metadata.name, "video-editor");
  assert.equal(entries.has(`${skillRoot}/SKILL.md`), true);
  assert.equal(metadata.files, entries.size);
});

test("packaging excludes media, user notes, legacy scripts and VS Code adapter", (t) => {
  const root = sourceFixture(t);
  for (const filename of [
    "input/private.mov", "output/customer.json", "video/raw.mp4",
    `${skillRoot}/scripts/private.py`, `${skillRoot}/references/private-notes.md`,
    ".github/agents/video-editor.agent.md", ".env",
  ]) {
    const target = path.join(root, filename);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "must not be published");
  }
  const output = path.join(workspace(t), "clean bundle");
  const result = buildPackage({ sourceRoot: root, outputDirectory: output });
  const expectedFiles = [...collectPackage().entries.keys()];
  assert.deepEqual(Object.keys(result.hashes).sort(), expectedFiles.sort());
  assert.equal(result.files, expectedFiles.length);
  assert.equal(collectPackage(output).metadata.version, result.version);
  for (const filename of expectedFiles) {
    assert.deepEqual(readFileSync(path.join(output, filename)), readFileSync(path.join(root, filename)));
  }
});

test("refuses existing output without touching the existing files", (t) => {
  const output = workspace(t);
  const sentinel = path.join(output, "keep.txt");
  writeFileSync(sentinel, "user owned");
  assert.throws(() => buildPackage({ outputDirectory: output }), { code: "EEXIST" });
  assert.equal(readFileSync(sentinel, "utf8"), "user owned");
});

test("does not publish an incomplete source with a missing required resource", (t) => {
  const root = sourceFixture(t);
  rmSync(path.join(root, `${skillRoot}/references/subtitles.md`));
  assert.throws(() => buildPackage({
    sourceRoot: root, outputDirectory: path.join(workspace(t), "bundle"),
  }), { code: "ENOENT" });
});

test("rejects both leaf and ancestor symlinks instead of reading outside sources", (t) => {
  for (const relativePath of [`${skillRoot}/SKILL.md`, ".github"]) {
    const root = sourceFixture(t);
    const target = path.join(root, relativePath);
    rmSync(target, { recursive: true });
    symlinkSync(path.join(repositoryRoot, relativePath), target);
    assert.throws(() => collectPackage(root), /Symlink is not a package source/);
  }
});

test("preserves the declared license and optional notice without rewriting them", (t) => {
  const root = sourceFixture(t);
  writeFileSync(path.join(root, "NOTICE"), "Test-only notice marker");
  const result = buildPackage({ sourceRoot: root, outputDirectory: path.join(workspace(t), "bundle") });
  assert.equal(result.files, collectPackage().entries.size + 1);
  assert.deepEqual(readFileSync(path.join(result.output, "LICENSE")), readFileSync(path.join(root, "LICENSE")));
  assert.equal(readFileSync(path.join(result.output, "NOTICE"), "utf8"), "Test-only notice marker");
});

test("a declared license requires a bundled notice and matching metadata", () => {
  const { entries } = collectPackage();
  const missing = new Map(entries);
  missing.delete("LICENSE");
  assert.throws(() => inspectPackage(missing), /license notice is missing/);
  const changed = change(entries, ".codex-plugin/plugin.json", (text) => {
    const manifest = JSON.parse(text);
    manifest.license = "Apache-2.0";
    return JSON.stringify(manifest);
  });
  assert.throws(() => inspectPackage(changed), /license drift/);
});

test("rejects version drift, noncanonical paths and automatic components", () => {
  const { entries } = collectPackage();
  for (const [field, value] of [
    ["version", "99.0.0"], ["skills", "./missing/"], ["hooks", "./hooks.json"],
  ]) {
    const changed = change(entries, ".claude-plugin/plugin.json", (text) => {
      const json = JSON.parse(text);
      json[field] = value;
      return JSON.stringify(json);
    });
    assert.throws(() => inspectPackage(changed));
  }
});

test("rejects marketplace paths that escape or miss the package", () => {
  const { entries } = collectPackage();
  const changed = change(entries, ".agents/plugins/marketplace.json", (text) => {
    const json = JSON.parse(text);
    json.plugins[0].source.path = "../outside";
    return JSON.stringify(json);
  });
  assert.throws(() => inspectPackage(changed), /Codex marketplace/);
});

test("rejects resources linked by the skill but absent from the bundle", () => {
  const { entries } = collectPackage();
  const changed = change(entries, `${skillRoot}/SKILL.md`, (text) =>
    `${text}\n[not bundled](references/private-notes.md)\n`);
  assert.throws(() => inspectPackage(changed), /Reference is not inside the bundle/);
});

test("validates the Codex UI prompt against the actual skill name", () => {
  const { entries } = collectPackage();
  const changed = change(entries, `${skillRoot}/agents/openai.yaml`, (text) =>
    text.replace("$video-editor", "$wrong-skill"));
  assert.throws(() => inspectPackage(changed), /default_prompt/);
});
