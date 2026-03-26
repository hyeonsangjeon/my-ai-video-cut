#!/usr/bin/env python3
"""demo_scenario.json 기반 SRT 자막 파일 생성."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def format_srt_time(seconds: float) -> str:
    """초를 SRT 시간 형식 (HH:MM:SS,mmm)으로 변환."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def generate_srt(scenario_path: str, lang: str, output_path: str) -> None:
    """시나리오 JSON에서 SRT 자막 파일을 생성.

    Args:
        scenario_path: demo_scenario.json 경로.
        lang: 언어 코드 (ko 또는 en).
        output_path: 출력 SRT 파일 경로.
    """
    scenario = json.loads(Path(scenario_path).read_text(encoding="utf-8"))
    scenes = scenario["scenes"]
    script_key = f"script_{lang}"

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    current_time = 0.0
    entries: list[str] = []

    for i, scene in enumerate(scenes, 1):
        text = scene.get(script_key, "")
        if not text:
            print(f"   ⚠️  Scene '{scene['id']}': {script_key} 없음, 건너뜀")
            current_time += scene["duration_target"]
            continue

        start = current_time
        end = current_time + scene["duration_target"]

        entries.append(
            f"{i}\n"
            f"{format_srt_time(start)} --> {format_srt_time(end)}\n"
            f"{text}\n"
        )
        current_time = end

    out.write_text("\n".join(entries), encoding="utf-8")

    total_duration = current_time
    print(f"📝 SRT 생성: {out}")
    print(f"   언어: {lang} | {len(entries)}개 자막 | 총 {total_duration:.1f}초")
    for i, scene in enumerate(scenes):
        text = scene.get(script_key, "(없음)")
        print(f"   [{i+1}] {scene['id']}: {text[:40]}{'...' if len(text) > 40 else ''}")


def main() -> None:
    parser = argparse.ArgumentParser(description="demo_scenario.json → SRT 자막 생성")
    parser.add_argument("--scenario", "-s", required=True, help="demo_scenario.json 경로")
    parser.add_argument("--lang", "-l", default="ko", choices=["ko", "en"], help="언어 코드 (기본: ko)")
    parser.add_argument("--output", "-o", help="출력 SRT 경로 (기본: video/subtitles/demo_{lang}.srt)")
    args = parser.parse_args()

    output = args.output or f"video/subtitles/demo_{args.lang}.srt"
    generate_srt(args.scenario, args.lang, output)


if __name__ == "__main__":
    main()
