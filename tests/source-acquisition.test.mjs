import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { repositoryRoot, skillRoot } from "../tools/plugin-package.mjs";

function recipe(file, id) {
  const text = readFileSync(path.join(repositoryRoot, skillRoot, "references", file), "utf8");
  const matches = [...text.matchAll(/<!-- recipe: ([a-z-]+) -->\n```bash\n([\s\S]*?)\n```/g)]
    .filter((match) => match[1] === id);
  assert.equal(matches.length, 1, `Missing or duplicate recipe ${id}`);
  return matches[0][2];
}

function executable(filename, code) {
  writeFileSync(filename, `#!${process.execPath}\n${code}`, { mode: 0o755 });
  chmodSync(filename, 0o755);
}

function fixture(t) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "video-source-acquisition-"));
  t.after(() => rmSync(cwd, { recursive: true }));
  for (const directory of ["bin", "tool/bin", "sources", "clips"]) mkdirSync(path.join(cwd, directory), { recursive: true });
  const template = path.join(cwd, "mock-yt-dlp");
  const installed = path.join(cwd, "tool/bin/yt-dlp");
  const calls = path.join(cwd, "calls.jsonl");
  const media = path.join(cwd, "sample.mp4");
  const generated = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-n", "-nostdin", "-f", "lavfi",
    "-i", "color=c=black:size=160x90:rate=5:duration=0.4",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", media,
  ], { encoding: "utf8" });
  assert.equal(generated.status, 0, generated.stderr);
  executable(template, `
const fs = require("node:fs");
const args = process.argv.slice(2);
const stage = args.includes("--version") ? "probe" : "download";
fs.appendFileSync(process.env.MOCK_CALLS, JSON.stringify({stage,args}) + "\\n");
if (stage === "probe") { console.log("mock-yt-dlp"); process.exit(0); }
if (!args.includes("--ignore-config") || !args.includes("--no-cookies-from-browser")
    || args.at(-1) !== process.env.URL) { console.error("Unexpected test invocation"); process.exit(8); }
if (process.env.MOCK_RESULT === "fail") { console.error("ERROR: simulated HTTP 503"); process.exit(9); }
fs.copyFileSync(process.env.MOCK_MEDIA, "sources/source-a.mp4", fs.constants.COPYFILE_EXCL);
console.log("sources/source-a.mp4");
`);
  executable(path.join(cwd, "bin/brew"), `
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
if (args[0] === "install" && args[1] === "yt-dlp") {
  fs.appendFileSync(process.env.MOCK_CALLS, JSON.stringify({stage:"install",args}) + "\\n");
  const target = path.join(process.env.MOCK_PREFIX, "bin/yt-dlp");
  fs.copyFileSync(process.env.MOCK_TEMPLATE, target, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(target, 0o755);
} else if (args[0] === "--prefix" && args[1] === "yt-dlp") {
  console.log(process.env.MOCK_PREFIX);
} else { console.error("Unexpected mock package-manager command"); process.exit(8); }
`);
  return {
    cwd, template, installed, calls,
    env: {
      ...process.env, PATH: path.join(cwd, "bin") + path.delimiter + process.env.PATH,
      YTDLP_BIN: installed, URL: "https://www.youtube.com/watch?v=TESTONLY000",
      MOCK_CALLS: calls, MOCK_MEDIA: media, MOCK_PREFIX: path.join(cwd, "tool"),
      MOCK_TEMPLATE: template,
    },
  };
}

function run(f, file, id, overrides = {}, expectedStatus = 0) {
  const result = spawnSync("/bin/bash", ["-euo", "pipefail", "-c", recipe(file, id)], {
    cwd: f.cwd, env: { ...f.env, ...overrides }, encoding: "utf8", timeout: 30000,
  });
  assert(!result.error, result.error?.message);
  assert.equal(result.status, expectedStatus, result.stderr);
  return result;
}

function stages(f) {
  return existsSync(f.calls)
    ? readFileSync(f.calls, "utf8").trim().split("\n").map((line) => JSON.parse(line).stage)
    : [];
}

function verifyDownloaded(f) {
  const result = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1",
    path.join(f.cwd, "sources/source-a.mp4"),
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert(Number(result.stdout) > 0);
}

test("an existing recorded tool path is used for a real requested media attempt", (t) => {
  const f = fixture(t);
  copyFileSync(f.template, f.installed);
  chmodSync(f.installed, 0o755);
  run(f, "tools.md", "probe-yt-dlp");
  assert.deepEqual(stages(f), ["probe"], "A version probe is not a download");
  run(f, "sources.md", "download-source-media");
  assert.deepEqual(stages(f), ["probe", "download"]);
  verifyDownloaded(f);
});

test("approved installation resolves missing tooling and is followed by an actual attempt", (t) => {
  const f = fixture(t);
  run(f, "tools.md", "probe-yt-dlp", {}, 1);
  assert.deepEqual(stages(f), [], "Missing binary cannot produce a download failure");
  run(f, "tools.md", "install-yt-dlp-homebrew");
  assert.deepEqual(stages(f), ["install", "probe"]);
  run(f, "sources.md", "download-source-media");
  assert.deepEqual(stages(f), ["install", "probe", "download"]);
  verifyDownloaded(f);
});

test("late installation approval resumes the same job without removing independent work", (t) => {
  const f = fixture(t);
  const localOutput = path.join(f.cwd, "clips/already-edited.txt");
  writeFileSync(localOutput, "existing local work");
  writeFileSync(path.join(f.cwd, "brief.md"), "Source use and local download approved; tool installation pending. Resume: tool preparation.");
  run(f, "tools.md", "probe-yt-dlp", {}, 1);
  assert.deepEqual(stages(f), []);
  writeFileSync(path.join(f.cwd, "brief.md"), "Source use, local download and yt-dlp installation approved. Resume: tool preparation.");
  run(f, "tools.md", "install-yt-dlp-homebrew");
  run(f, "sources.md", "download-source-media");
  assert.equal(readFileSync(localOutput, "utf8"), "existing local work");
  verifyDownloaded(f);
});

test("only actual command errors provide download-failure evidence, and retries are observable", (t) => {
  const f = fixture(t);
  copyFileSync(f.template, f.installed);
  chmodSync(f.installed, 0o755);
  run(f, "tools.md", "probe-yt-dlp");
  assert(!existsSync(path.join(f.cwd, "sources/source-a.mp4")));
  const failed = run(f, "sources.md", "download-source-media", { MOCK_RESULT: "fail" }, 9);
  assert.match(failed.stderr, /simulated HTTP 503/);
  assert.deepEqual(stages(f), ["probe", "download"]);
  assert(!existsSync(path.join(f.cwd, "sources/source-a.mp4")));
  run(f, "sources.md", "download-source-media");
  assert.deepEqual(stages(f), ["probe", "download", "download"]);
  verifyDownloaded(f);
});
