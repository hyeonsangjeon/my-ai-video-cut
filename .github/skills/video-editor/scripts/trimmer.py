#!/usr/bin/env python3
"""FFmpeg 기반 구간 트리밍 + 클립 병합."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path


def get_video_duration(video_path: str) -> float:
    """ffprobe로 영상 길이(초)를 반환."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def get_video_resolution(video_path: str) -> tuple[int, int]:
    """ffprobe로 영상 해상도(width, height)를 반환."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=p=0",
            video_path,
        ],
        capture_output=True, text=True, check=True,
    )
    w, h = result.stdout.strip().split(",")
    return int(w), int(h)


def format_time(seconds: float) -> str:
    """초를 HH:MM:SS.mmm 형식으로 변환."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def trim_clip(
    input_path: str,
    start: float,
    end: float,
    output_path: str,
    scale_1080p: bool = False,
) -> None:
    """FFmpeg로 구간 트리밍."""
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ss", format_time(start),
        "-to", format_time(end),
    ]

    if scale_1080p:
        cmd += ["-vf", "scale=1920:1080"]
        cmd += ["-c:v", "libx264", "-preset", "fast", "-crf", "23"]
    else:
        cmd += ["-c", "copy"]

    cmd.append(output_path)
    subprocess.run(cmd, check=True, capture_output=True)


def concat_clips(clip_paths: list[str], output_path: str) -> None:
    """FFmpeg concat demuxer로 클립 병합."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False
    ) as f:
        for clip in clip_paths:
            f.write(f"file '{Path(clip).resolve()}'\n")
        concat_file = f.name

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    Path(concat_file).unlink(missing_ok=True)


def trim_scenes(
    input_path: str,
    scenes_json: str | None,
    scenario_json: str | None,
    output_dir: str,
    speed: float = 1.0,
) -> list[str]:
    """Scene 정보를 기반으로 영상을 구간별 트리밍 후 병합.

    scenes_json이 주어지면 감지된 scene boundary를 사용.
    scenario_json이 주어지면 duration_target 기반으로 균등 분할.
    둘 다 없으면 전체 영상을 그대로 복사.
    """
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    total_duration = get_video_duration(input_path)
    width, height = get_video_resolution(input_path)
    need_scale = width > 1920 or height > 1080

    print(f"📹 입력: {input_path}")
    print(f"   길이: {total_duration:.1f}초 | 해상도: {width}x{height}")
    if need_scale:
        print("   ⚠️  Retina 해상도 감지 → 1920x1080으로 스케일 다운")

    # Scene 경계 결정
    boundaries: list[tuple[float, float, str]] = []

    if scenes_json and Path(scenes_json).exists():
        scenes = json.loads(Path(scenes_json).read_text(encoding="utf-8"))
        timestamps = [0.0] + [s["timestamp"] for s in scenes] + [total_duration]
        for i in range(len(timestamps) - 1):
            boundaries.append((
                timestamps[i],
                timestamps[i + 1],
                f"{i + 1:02d}_scene",
            ))
    elif scenario_json and Path(scenario_json).exists():
        scenario = json.loads(Path(scenario_json).read_text(encoding="utf-8"))
        current = 0.0
        for sc in scenario["scenes"]:
            end = min(current + sc["duration_target"], total_duration)
            boundaries.append((current, end, f"{len(boundaries) + 1:02d}_{sc['id']}"))
            current = end
    else:
        boundaries.append((0.0, total_duration, "01_full"))

    # 트리밍 실행
    clip_paths: list[str] = []
    for start, end, name in boundaries:
        clip_path = str(out_dir / f"{name}.mp4")
        print(f"   ✂️  {name}: {start:.1f}s → {end:.1f}s ({end - start:.1f}s)")
        trim_clip(input_path, start, end, clip_path, scale_1080p=need_scale)
        clip_paths.append(clip_path)

    # 병합
    merged_path = str(out_dir / "merged.mp4")
    if len(clip_paths) > 1:
        concat_clips(clip_paths, merged_path)
    else:
        import shutil
        shutil.copy2(clip_paths[0], merged_path)

    merged_duration = get_video_duration(merged_path)
    print(f"✅ 병합 완료: {merged_path} ({merged_duration:.1f}초)")

    # 속도 조절
    if speed != 1.0:
        speed_path = str(out_dir / f"merged_{speed}x.mp4")
        cmd = [
            "ffmpeg", "-y", "-i", merged_path,
            "-filter_complex",
            f"[0:v]setpts=PTS/{speed}[v];[0:a]atempo={speed}[a]",
            "-map", "[v]", "-map", "[a]",
            speed_path,
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        # 속도 조절본을 merged로 대체
        Path(merged_path).unlink()
        Path(speed_path).rename(merged_path)
        new_dur = get_video_duration(merged_path)
        print(f"   ⏩ {speed}x 속도 조절 → {new_dur:.1f}초")

    return clip_paths


def main() -> None:
    parser = argparse.ArgumentParser(description="FFmpeg 구간 트리밍 + 클립 병합")
    parser.add_argument("--input", "-i", required=True, help="입력 영상 파일 경로")
    parser.add_argument("--scenes", help="scene_detector 출력 JSON 경로")
    parser.add_argument("--scenario", help="demo_scenario.json 경로")
    parser.add_argument("--output-dir", "-o", default="video/trimmed/", help="출력 디렉토리 (기본: video/trimmed/)")
    parser.add_argument("--speed", type=float, default=1.0, help="재생 속도 배율 (기본: 1.0)")
    args = parser.parse_args()

    trim_scenes(args.input, args.scenes, args.scenario, args.output_dir, args.speed)


if __name__ == "__main__":
    main()
