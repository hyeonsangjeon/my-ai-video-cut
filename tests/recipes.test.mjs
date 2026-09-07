import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { repositoryRoot, skillRoot } from "../tools/plugin-package.mjs";

const references = path.join(repositoryRoot, skillRoot, "references");
const recipes = new Map();
for (const filename of readdirSync(references).filter((name) => name.endsWith(".md"))) {
  const text = readFileSync(path.join(references, filename), "utf8");
  for (const match of text.matchAll(/<!-- recipe: ([a-z-]+) -->\n```bash\n([\s\S]*?)\n```/g)) {
    assert(!recipes.has(match[1]), `Duplicate recipe ID: ${match[1]}`);
    recipes.set(match[1], match[2]);
  }
}

function workspace(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "video-plugin-recipes-"));
  for (const folder of ["sources", "clips", "captions", "audio/ko", "exports", "logs"]) {
    mkdirSync(path.join(directory, folder), { recursive: true });
  }
  t.after(() => rmSync(directory, { recursive: true }));
  return directory;
}

function command(directory, program, args, { env = {}, fail = false } = {}) {
  const result = spawnSync(program, args, {
    cwd: directory, env: { ...process.env, ...env }, encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024, timeout: 120000,
  });
  assert(!result.error, `${program}: ${result.error?.message}`);
  if (fail) {
    assert.notEqual(result.status, 0, `${program} unexpectedly succeeded`);
  } else {
    assert.equal(result.status, 0, `${program} failed:\n${result.stderr}\n${result.stdout}`);
  }
  return result;
}

function recipe(directory, name, options = {}) {
  assert(recipes.has(name), `Missing documented recipe: ${name}`);
  return command(directory, "bash", ["-euo", "pipefail", "-c", recipes.get(name)], options);
}

function ffmpeg(directory, args) {
  return command(directory, "ffmpeg", ["-hide_banner", "-loglevel", "error", "-n", "-nostdin", ...args]);
}

function writeJson(directory, filename, value) {
  writeFileSync(path.join(directory, filename), JSON.stringify(value));
}

function readJson(directory, filename) {
  return JSON.parse(readFileSync(path.join(directory, filename), "utf8"));
}

function plan() {
  return {
    version: 1, fps_num: 30, fps_den: 1, width: 320, height: 180,
    sources: [
      { id: "source-a", media: "sources/source-a.mp4", source_duration_ms: 6000,
        media_origin_ms: 0, media_duration_ms: 6000, captions: "sources/source-a.srt" },
      { id: "source-b", media: "sources/source-b.mp4", source_duration_ms: 3000,
        media_origin_ms: 0, media_duration_ms: 3000, captions: "sources/source-b.srt" },
    ],
    clips: [
      { id: "c01", source_id: "source-b", in_ms: 500, out_ms: 1500, speed: 0.5, reason: "Silent portrait first" },
      { id: "c02", source_id: "source-a", in_ms: 2000, out_ms: 4000, speed: 2, reason: "Fast excerpt" },
      { id: "c03", source_id: "source-a", in_ms: 1000, out_ms: 2000, speed: 1, reason: "Earlier excerpt reordered" },
    ],
  };
}

function resolve(directory, input = plan()) {
  writeJson(directory, "plan.json", input);
  recipe(directory, "resolve-timeline");
  return readJson(directory, "timeline.json");
}

function makeVideo(directory, { output, size = "320x240", fps = "24", duration = 6, audio = true }) {
  const args = ["-f", "lavfi", "-i", `testsrc2=size=${size}:rate=${fps}:duration=${duration}`];
  if (audio) args.push("-f", "lavfi", "-i", `sine=frequency=440:sample_rate=44100:duration=${duration}`);
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p");
  args.push(...(audio ? ["-c:a", "aac"] : ["-an"]), output);
  ffmpeg(directory, args);
}

test("extracts one Markdown plan and computes a frame-based reordered timeline", (t) => {
  const directory = workspace(t);
  writeFileSync(path.join(directory, "edit-plan.md"), `# Plan\n\n\`\`\`json\n${JSON.stringify(plan())}\n\`\`\`\n`);
  recipe(directory, "extract-plan");
  recipe(directory, "resolve-timeline");
  const timeline = readJson(directory, "timeline.json");
  assert.equal(timeline.total_frames, 120);
  assert.equal(timeline.total_ms, 4000);
  assert.deepEqual(timeline.clips.map((clip) => clip.output_start_ms), [0, 2000, 3000]);
});

test("invalid IDs, intervals, paths, rates and dimensions fail explicitly", (t) => {
  const mutations = [
    (p) => { p.clips[0].source_id = "missing"; },
    (p) => { p.clips[1].id = p.clips[0].id; },
    (p) => { p.clips[0].out_ms = p.clips[0].in_ms; },
    (p) => { p.clips[0].out_ms = 999999; },
    (p) => { p.clips[0].speed = -1; },
    (p) => { p.sources[0].media = "../outside.mp4"; },
    (p) => { p.fps_den = 0; },
    (p) => { p.width = 319; },
  ];
  for (const mutate of mutations) {
    const directory = workspace(t);
    const input = plan();
    mutate(input);
    writeJson(directory, "plan.json", input);
    recipe(directory, "resolve-timeline", { fail: true });
  }
});

test("partial-download origin affects local seek, not original clip times", (t) => {
  const directory = workspace(t);
  const input = plan();
  input.sources[0].media_origin_ms = 1000;
  input.sources[0].media_duration_ms = 4000;
  const timeline = resolve(directory, input);
  assert.equal(timeline.clips[1].input_start_ms, 1000);
  assert.equal(timeline.clips[1].in_ms, 2000);
});

test("SRT-only work accepts BOM/CRLF and preserves Unicode, multiline text and timestamps", (t) => {
  const directory = workspace(t);
  const text = "\uCCAB \uBB38\uC7A5\nSecond line";
  writeFileSync(path.join(directory, "source.srt"),
    `\uFEFF1\r\n01:00:00,001 --> 01:00:02,002\r\n${text.replaceAll("\n", "\r\n")}\r\n\r\n`);
  recipe(directory, "parse-srt", { env: {
    SOURCE_ID: "source-a", SRT_FILE: "source.srt", CUES_FILE: "captions/parsed.json",
  } });
  recipe(directory, "subtitle-only", { env: { SOURCE_CUES: "captions/parsed.json" } });
  const cues = readJson(directory, "captions/timeline.cues.json");
  assert.equal(cues[0].text, text);
  assert.equal(cues[0].start_ms, 3600001);
  assert.equal(readJson(directory, "timeline.json").timing_basis, "subtitle-only");
  recipe(directory, "export-srt", { env: {
    FINAL_CUES: "captions/timeline.cues.json", SRT_OUTPUT: "captions/final.srt",
  } });
  assert.equal(readFileSync(path.join(directory, "captions/final.srt"), "utf8"),
    `1\n01:00:00,001 --> 01:00:02,002\n${text}\n`);
});

test("caption clipping, translation IDs and bilingual output use the same timeline", (t) => {
  const directory = workspace(t);
  resolve(directory);
  const cues = [
    { id: "source-a:1", source_id: "source-a", start_ms: 500, end_ms: 2500, text: "First" },
    { id: "source-a:2", source_id: "source-a", start_ms: 2500, end_ms: 3500, text: "Second\nline" },
    { id: "source-a:3", source_id: "source-a", start_ms: 3500, end_ms: 5500, text: "Third" },
    { id: "source-b:1", source_id: "source-b", start_ms: 100, end_ms: 1000, text: "Fourth" },
    { id: "source-b:2", source_id: "source-b", start_ms: 1000, end_ms: 2000, text: "Fifth" },
  ];
  writeJson(directory, "captions/sources.cues.json", cues);
  recipe(directory, "retime-cues");
  const timed = readJson(directory, "captions/timeline.cues.json");
  assert.deepEqual(timed.map((cue) => [cue.start_ms, cue.end_ms]), [
    [0, 1000], [1000, 2000], [2000, 2250], [2250, 2750], [2750, 3000], [3000, 4000],
  ]);
  assert.equal(timed.filter((cue) => cue.boundary_review).length, 5);
  assert.equal(new Set(timed.map((cue) => cue.id)).size, 6);
  const translated = Object.fromEntries(timed.map((cue, index) => [cue.id, `Translation ${index + 1}`]));
  writeJson(directory, "captions/translations.ko.json", translated);
  recipe(directory, "merge-translations", { env: {
    TRANSLATIONS: "captions/translations.ko.json", LOCALIZED_CUES: "captions/final.ko.cues.json",
  } });
  recipe(directory, "bilingual-cues");
  assert(readJson(directory, "captions/bilingual.ko.cues.json").every((cue) => cue.text.split("\n").length === 2));
  recipe(directory, "export-srt", { env: {
    FINAL_CUES: "captions/bilingual.ko.cues.json", SRT_OUTPUT: "captions/final.ko.srt",
  } });
  delete translated[timed[0].id];
  writeJson(directory, "captions/incomplete.json", translated);
  recipe(directory, "merge-translations", { fail: true, env: {
    TRANSLATIONS: "captions/incomplete.json", LOCALIZED_CUES: "captions/rejected.json",
  } });
});

test("mixed, silent and sped media exports exactly the planned frames with subtitle tracks", (t) => {
  const directory = workspace(t);
  resolve(directory);
  makeVideo(directory, { output: "sources/source-a.mp4" });
  makeVideo(directory, { output: "sources/source-b.mp4", size: "180x320", fps: "30", duration: 3, audio: false });
  recipe(directory, "render-clips");
  recipe(directory, "assemble");
  recipe(directory, "export-video");
  recipe(directory, "inspect-export", { env: { VIDEO_OUTPUT: "exports/final.mp4" } });
  const probe = readJson(directory, "logs/export-probe.json");
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  assert.equal(video.width, 320);
  assert.equal(video.height, 180);
  assert.equal(Number(video.nb_read_frames), 120);
  assert(Math.abs(Number(video.duration) - 4) <= 1 / 30);
  assert.equal(audio.channels, 2);
  assert.equal(Number(audio.sample_rate), 48000);
  for (const language of ["ko", "en"]) {
    writeFileSync(path.join(directory, `captions/final.${language}.srt`),
      `1\n00:00:00,000 --> 00:00:01,000\n${language} caption\n`);
  }
  recipe(directory, "mux-subtitles");
  const streams = JSON.parse(command(directory, "ffprobe", [
    "-v", "error", "-show_streams", "-of", "json", "exports/final-multilingual.mp4",
  ]).stdout).streams;
  assert.deepEqual(streams.filter((stream) => stream.codec_type === "subtitle").map((stream) => stream.tags.language), ["kor", "eng"]);
  assert(Math.abs(Number(streams.find((stream) => stream.codec_type === "video").duration) - 4) <= 1 / 30);
});

test("narration is padded per clip; oversized narration is rejected before rendering", (t) => {
  const directory = workspace(t);
  const timeline = resolve(directory);
  for (const clip of timeline.clips) {
    ffmpeg(directory, ["-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=0.2",
      "-c:a", "pcm_s16le", `audio/ko/${clip.id}.raw.wav`]);
    recipe(directory, "pad-narration", { env: {
      CLIP_ID: clip.id, AUDIO_INPUT: `audio/ko/${clip.id}.raw.wav`, AUDIO_OUTPUT: `audio/ko/${clip.id}.wav`,
    } });
  }
  recipe(directory, "assemble-narration");
  const duration = Number(command(directory, "ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", "audio/ko/narration.wav",
  ]).stdout);
  assert(Math.abs(duration - 4) < 0.001);
  ffmpeg(directory, ["-f", "lavfi", "-i", "sine=duration=1.2", "-c:a", "pcm_s16le", "audio/ko/too-long.wav"]);
  recipe(directory, "pad-narration", { fail: true, env: {
    CLIP_ID: "c02", AUDIO_INPUT: "audio/ko/too-long.wav", AUDIO_OUTPUT: "audio/ko/rejected.wav",
  } });
});

test("malformed SRT and overlapping final cues are rejected", (t) => {
  for (const content of [
    "1\n00:00:99,000 --> 00:01:00,000\nBad\n",
    "1\n00:00:02,000 --> 00:00:01,000\nBackwards\n",
    "",
  ]) {
    const directory = workspace(t);
    writeFileSync(path.join(directory, "invalid.srt"), content);
    recipe(directory, "parse-srt", { fail: true, env: {
      SOURCE_ID: "source-a", SRT_FILE: "invalid.srt", CUES_FILE: "captions/invalid.json",
    } });
  }
  const directory = workspace(t);
  resolve(directory);
  writeJson(directory, "captions/overlap.json", [
    { id: "one", start_ms: 0, end_ms: 1000, text: "One" },
    { id: "two", start_ms: 500, end_ms: 1500, text: "Two" },
  ]);
  recipe(directory, "export-srt", { fail: true, env: {
    FINAL_CUES: "captions/overlap.json", SRT_OUTPUT: "captions/rejected.srt",
  } });
});

test("explicitly absent captions produce an empty cue list without inventing text", (t) => {
  const directory = workspace(t);
  const input = plan();
  for (const source of input.sources) source.captions = null;
  resolve(directory, input);
  writeJson(directory, "captions/sources.cues.json", []);
  recipe(directory, "retime-cues");
  assert.deepEqual(readJson(directory, "captions/timeline.cues.json"), []);
});

test("non-square pixels keep display aspect ratio without reset_sar", (t) => {
  const directory = workspace(t);
  const input = plan();
  input.sources = [{ ...input.sources[0], source_duration_ms: 2000, media_duration_ms: 2000, captions: null }];
  input.clips = [{ ...input.clips[0], source_id: "source-a", in_ms: 0, out_ms: 1000, speed: 1 }];
  resolve(directory, input);
  ffmpeg(directory, ["-f", "lavfi", "-i", "color=c=white:size=320x180:rate=30:duration=2",
    "-vf", "setsar=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "sources/source-a.mp4"]);
  recipe(directory, "render-clips");
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-i", "clips/c01.nut",
    "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
  ], { cwd: directory });
  assert.equal(result.status, 0, result.stderr.toString());
  assert.equal(result.stdout.length, 320 * 180 * 3);
  const pixel = (x, y) => result.stdout[(y * 320 + x) * 3];
  assert(pixel(160, 90) > 200, "The image must remain visible");
  assert(pixel(160, 20) < 20 && pixel(160, 160) < 20, "32:9 display content needs top/bottom padding");
});

test("fractional FPS and repeated clips do not accumulate timestamp rounding", (t) => {
  const directory = workspace(t);
  const input = plan();
  input.fps_num = 30000;
  input.fps_den = 1001;
  input.sources = [{ ...input.sources[0], captions: null }];
  input.clips = Array.from({ length: 12 }, (_, index) => ({
    id: `c${index}`, source_id: "source-a", in_ms: 501, out_ms: 1202,
    speed: 1.2, reason: "Fractional timing",
  }));
  const timeline = resolve(directory, input);
  makeVideo(directory, { output: "sources/source-a.mp4" });
  recipe(directory, "render-clips");
  recipe(directory, "assemble");
  recipe(directory, "export-video");
  recipe(directory, "inspect-export", { env: { VIDEO_OUTPUT: "exports/final.mp4" } });
  const probe = readJson(directory, "logs/export-probe.json");
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  assert.equal(Number(video.nb_read_frames), timeline.total_frames);
  assert(Math.abs(Number(video.duration) * 1000 - timeline.total_ms) < 1000 * 1001 / 30000);
  const frames = JSON.parse(command(directory, "ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=best_effort_timestamp_time",
    "-of", "json", "exports/final.mp4",
  ]).stdout).frames;
  for (let index = 1; index < frames.length; index++) {
    const gap = Number(frames[index].best_effort_timestamp_time) - Number(frames[index - 1].best_effort_timestamp_time);
    assert(Math.abs(gap - 1001 / 30000) < 0.00001);
  }
});

function tonePower(bytes, frequency) {
  const samples = bytes.length / 4;
  let real = 0;
  let imaginary = 0;
  for (let index = 0; index < samples; index++) {
    const value = bytes.readFloatLE(index * 4);
    const angle = 2 * Math.PI * frequency * index / 48000;
    real += value * Math.cos(angle);
    imaginary += value * Math.sin(angle);
  }
  return Math.hypot(real, imaginary) / samples;
}

test("explanations, new narration, replace/mix and burned captions remain aligned", (t) => {
  const directory = workspace(t);
  const input = plan();
  input.sources = [{ ...input.sources[0], source_duration_ms: 2000, media_duration_ms: 2000, captions: null }];
  input.clips = [{ ...input.clips[0], source_id: "source-a", in_ms: 0, out_ms: 1000, speed: 1 }];
  resolve(directory, input);
  ffmpeg(directory, [
    "-f", "lavfi", "-i", "color=c=black:size=320x180:rate=30:duration=2",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "sources/source-a.mp4",
  ]);
  recipe(directory, "render-clips");
  recipe(directory, "assemble");
  writeJson(directory, "captions/explanations.ko.json", { c01: "An explanation, not a quotation." });
  recipe(directory, "explanatory-cues");
  assert.equal(readJson(directory, "captions/explanatory.ko.cues.json")[0].end_ms, 1000);
  ffmpeg(directory, ["-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=0.2",
    "-c:a", "pcm_s16le", "audio/ko/c01.raw.wav"]);
  recipe(directory, "pad-narration", { env: {
    CLIP_ID: "c01", AUDIO_INPUT: "audio/ko/c01.raw.wav", AUDIO_OUTPUT: "audio/ko/c01.wav",
  } });
  recipe(directory, "assemble-narration");
  writeJson(directory, "audio/ko/local.cues.json", [
    { id: "c01:1", source_id: "c01", start_ms: 0, end_ms: 200, text: "Hello" },
  ]);
  recipe(directory, "retime-narration");
  assert.deepEqual(readJson(directory, "captions/narration.ko.cues.json").map((cue) => [cue.start_ms, cue.end_ms]), [[0, 200]]);
  recipe(directory, "export-srt", { env: {
    FINAL_CUES: "captions/narration.ko.cues.json", SRT_OUTPUT: "captions/narration.ko.srt",
  } });
  recipe(directory, "replace-audio");
  recipe(directory, "mix-audio");
  for (const kind of ["voice", "mix"]) {
    const audio = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-ss", "0.05",
      "-i", `exports/final-ko-${kind}.mp4`, "-t", "0.1", "-map", "0:a:0",
      "-ac", "1", "-ar", "48000", "-f", "f32le", "-",
    ], { cwd: directory });
    assert.equal(audio.status, 0, audio.stderr.toString());
    assert(tonePower(audio.stdout, 660) > tonePower(audio.stdout, 440) * 3,
      `${kind} must select the narration, not just the original audio`);
    if (kind === "mix") assert(tonePower(audio.stdout, 440) > 0.001);
  }
  recipe(directory, "burn-subtitles", { env: {
    VIDEO_INPUT: "exports/final-ko-voice.mp4", SUBTITLE_FILE: "captions/narration.ko.srt",
    SUBTITLE_STYLE: "FontSize=18,Outline=1,MarginV=20", VIDEO_OUTPUT: "exports/burned.mp4",
  } });
  recipe(directory, "inspect-export", { env: { VIDEO_OUTPUT: "exports/burned.mp4" } });
  const image = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-ss", "0.1",
    "-i", "exports/burned.mp4", "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
  ], { cwd: directory });
  assert.equal(image.status, 0, image.stderr.toString());
  assert(image.stdout.some((channel) => channel > 200), "A white caption must render on the black source");
});
