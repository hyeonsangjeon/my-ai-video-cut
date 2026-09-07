import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
export const skillRoot = ".github/skills/video-editor";
export const packageFiles = Object.freeze([
  "plugin.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".codex-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  `${skillRoot}/SKILL.md`,
  `${skillRoot}/agents/openai.yaml`,
  ...["tools", "sources", "editing", "subtitles", "localization", "audio", "export"]
    .map((name) => `${skillRoot}/references/${name}.md`),
  ...["brief", "edit-plan", "language-profile"]
    .map((name) => `${skillRoot}/assets/${name}.template.md`),
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function readRegularFile(root, relativePath) {
  let current = root;
  const parts = relativePath.split("/");
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = lstatSync(current);
    requireCondition(!stat.isSymbolicLink(), `Symlink is not a package source: ${current}`);
    requireCondition(
      index === parts.length - 1 ? stat.isFile() : stat.isDirectory(),
      `Expected a regular package path: ${current}`,
    );
  }
  return readFileSync(current);
}

function scalar(text, key, indentation = 0) {
  const matches = [...text.matchAll(new RegExp(`^ {${indentation}}${key}:\\s*(.+)$`, "gm"))];
  requireCondition(matches.length === 1, `Expected one ${key} field`);
  const value = matches[0][1].trim();
  // Package metadata uses plain identifiers or JSON-compatible quoted strings.
  if (value.startsWith('"')) return JSON.parse(value);
  requireCondition(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value),
    `${key} must be a plain identifier or a double-quoted string`);
  return value;
}

function validateReferences(entries) {
  const included = new Set(entries.keys());
  for (const [filename, bytes] of entries) {
    if (!filename.endsWith(".md")) continue;
    const text = bytes.toString("utf8");
    for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1].replace(/^<|>$/g, "");
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const local = decodeURIComponent(target.split("#")[0]);
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(filename), local));
      requireCondition(!local.startsWith("/") && included.has(resolved),
        `Reference is not inside the bundle: ${filename} -> ${target}`);
    }
  }
}

export function inspectPackage(entries) {
  const text = (filename) => {
    requireCondition(entries.has(filename), `Missing package file: ${filename}`);
    return entries.get(filename).toString("utf8");
  };
  const readJson = (filename) => JSON.parse(text(filename));
  const manifestPaths = ["plugin.json", ".claude-plugin/plugin.json", ".codex-plugin/plugin.json"];
  const manifests = manifestPaths.map(readJson);
  const { name, version, license } = manifests[0];
  requireCondition(name === "video-editor", "The plugin name must match the canonical skill");
  requireCondition(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), "Invalid plugin version");
  for (const [index, manifest] of manifests.entries()) {
    requireCondition(manifest.name === name && manifest.version === version,
      `Manifest name/version drift: ${manifestPaths[index]}`);
    requireCondition(manifest.license === license,
      `Manifest license drift: ${manifestPaths[index]}`);
    requireCondition(manifest.skills === "./.github/skills/",
      `Unexpected skill collection path: ${manifestPaths[index]}`);
    requireCondition(typeof manifest.description === "string" && manifest.description.length > 0,
      `Missing description: ${manifestPaths[index]}`);
    for (const field of ["agents", "commands", "hooks", "mcpServers", "lspServers", "extensions"]) {
      requireCondition(!(field in manifest), `The published package is skills-only: ${field}`);
    }
  }

  const claudeMarket = readJson(".claude-plugin/marketplace.json");
  const codexMarket = readJson(".agents/plugins/marketplace.json");
  requireCondition(claudeMarket.name === "my-ai-video-cut" && codexMarket.name === claudeMarket.name,
    "Marketplace names must agree");
  requireCondition(claudeMarket.plugins?.length === 1
    && claudeMarket.plugins[0].name === name && claudeMarket.plugins[0].source === "./",
  "Claude marketplace must resolve the bundle root");
  requireCondition(codexMarket.plugins?.length === 1
    && codexMarket.plugins[0].name === name
    && codexMarket.plugins[0].source?.source === "local"
    && codexMarket.plugins[0].source?.path === "./",
  "Codex marketplace must resolve the bundle root");

  const skill = text(`${skillRoot}/SKILL.md`);
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  requireCondition(frontmatter, "Missing skill frontmatter");
  requireCondition(scalar(frontmatter, "name") === name, "Skill name does not match plugin name");
  requireCondition(scalar(frontmatter, "version", 2) === version, "Skill/plugin version drift");
  requireCondition(/^license:/m.test(frontmatter) === (license !== undefined),
    "Skill/plugin license declaration drift");
  if (license !== undefined) {
    requireCondition(typeof license === "string" && license.length > 0,
      "Invalid plugin license");
    requireCondition(scalar(frontmatter, "license") === license, "Skill/plugin license drift");
    requireCondition(["LICENSE", "LICENSE.md", "LICENSE.txt"].some((filename) => entries.has(filename)),
      "Declared license notice is missing from the bundle");
  }
  const description = scalar(frontmatter, "description");
  const compatibility = scalar(frontmatter, "compatibility");
  requireCondition(description.length > 0 && description.length <= 1024, "Invalid skill description length");
  requireCondition(compatibility.length <= 500, "Skill compatibility exceeds 500 characters");
  requireCondition(skill.split("\n").length < 500, "Move long instructions into references");

  const ui = text(`${skillRoot}/agents/openai.yaml`);
  const shortDescription = scalar(ui, "short_description", 2);
  requireCondition(shortDescription.length >= 25 && shortDescription.length <= 64,
    "Codex UI short_description must have 25-64 characters");
  requireCondition(scalar(ui, "default_prompt", 2).includes("$video-editor"),
    "Codex default_prompt must explicitly mention $video-editor");
  validateReferences(entries);
  return { name, version, files: entries.size };
}

export function collectPackage(sourceRoot = repositoryRoot) {
  const root = realpathSync(path.resolve(sourceRoot));
  const entries = new Map(packageFiles.map((filename) => [filename, readRegularFile(root, filename)]));
  for (const filename of ["LICENSE", "LICENSE.md", "LICENSE.txt", "NOTICE"]) {
    try {
      lstatSync(path.join(root, filename));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    entries.set(filename, readRegularFile(root, filename));
  }
  const metadata = inspectPackage(entries);
  return { entries, metadata };
}

export function buildPackage({ sourceRoot = repositoryRoot, outputDirectory }) {
  requireCondition(typeof outputDirectory === "string" && outputDirectory.length > 0,
    "An explicit new output directory is required");
  const { entries, metadata } = collectPackage(sourceRoot);
  const output = path.resolve(outputDirectory);
  mkdirSync(path.dirname(output), { recursive: true });
  mkdirSync(output, { mode: 0o700 });
  const hashes = {};
  for (const [filename, bytes] of entries) {
    const target = path.join(output, filename);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes, { flag: "wx", mode: 0o644 });
    hashes[filename] = createHash("sha256").update(bytes).digest("hex");
  }
  return { ...metadata, output, hashes };
}
