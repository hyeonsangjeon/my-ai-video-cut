#!/usr/bin/env python3
"""edge-tts 기반 Scene별 TTS 나레이션 생성."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


async def generate_narration(text: str, voice: str, output_path: str) -> None:
    """단일 텍스트에 대한 TTS 음성을 생성."""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)


async def generate_all_narrations(
    scenario_path: str,
    lang: str,
    output_dir: str,
    voice_override: str | None = None,
) -> list[str]:
    """시나리오 JSON의 모든 scene에 대해 TTS 음성을 생성.

    Args:
        scenario_path: demo_scenario.json 경로.
        lang: 언어 코드 (ko 또는 en).
        output_dir: 출력 디렉토리.
        voice_override: 음성 ID 오버라이드 (기본: scenario의 voice_ko/voice_en).

    Returns:
        생성된 MP3 파일 경로 리스트.
    """
    scenario = json.loads(Path(scenario_path).read_text(encoding="utf-8"))
    scenes = scenario["scenes"]

    voice_key = f"voice_{lang}"
    voice = voice_override or scenario.get(voice_key, "ko-KR-SunHiNeural")
    script_key = f"script_{lang}"

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"🎙️  TTS 생성 시작")
    print(f"   언어: {lang} | 음성: {voice} | Scene 수: {len(scenes)}")

    output_paths: list[str] = []

    for i, scene in enumerate(scenes, 1):
        text = scene.get(script_key, "")
        if not text:
            print(f"   ⚠️  Scene '{scene['id']}': {script_key} 없음, 건너뜀")
            continue

        filename = f"{i:02d}_{scene['id']}.mp3"
        out_path = str(out_dir / filename)

        await generate_narration(text, voice, out_path)
        output_paths.append(out_path)
        print(f"   ✅ {filename}: {text[:50]}{'...' if len(text) > 50 else ''}")

    print(f"🎙️  TTS 완료: {len(output_paths)}개 파일 → {out_dir}")
    return output_paths


def main() -> None:
    parser = argparse.ArgumentParser(description="edge-tts Scene별 나레이션 생성")
    parser.add_argument("--scenario", "-s", required=True, help="demo_scenario.json 경로")
    parser.add_argument("--lang", "-l", default="ko", choices=["ko", "en"], help="언어 코드 (기본: ko)")
    parser.add_argument("--output-dir", "-o", default="video/tts/", help="출력 디렉토리 (기본: video/tts/)")
    parser.add_argument("--voice", help="음성 ID 오버라이드 (예: ko-KR-SunHiNeural)")
    args = parser.parse_args()

    asyncio.run(
        generate_all_narrations(args.scenario, args.lang, args.output_dir, args.voice)
    )


if __name__ == "__main__":
    main()
