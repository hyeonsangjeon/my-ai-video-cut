#!/usr/bin/env python3
"""전체 데모 영상 편집 파이프라인 — 한 번에 실행.

사용법:
    python scripts/run_pipeline.py --input video/raw/demo.mov --lang ko
    → video/output/foundry_iq_demo_1min_ko.mp4
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# 스킬 스크립트 디렉토리를 import 경로에 추가
SKILL_SCRIPTS = Path(__file__).resolve().parent.parent / ".github" / "skills" / "video-editor" / "scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))

from scene_detector import detect_scene_changes  # noqa: E402
from trimmer import trim_scenes  # noqa: E402
from subtitle_generator import generate_srt  # noqa: E402
from tts_generator import generate_all_narrations  # noqa: E402
from composer import compose_final  # noqa: E402

import asyncio  # noqa: E402
import json  # noqa: E402


def run_pipeline(
    input_path: str,
    lang: str,
    scenario_path: str,
    output_dir: str,
    threshold: float = 30.0,
    speed: float = 1.0,
) -> str:
    """전체 파이프라인을 순차 실행.

    Returns:
        최종 출력 파일 경로.
    """
    project_root = Path(__file__).resolve().parent.parent
    scenario_abs = str(project_root / scenario_path)
    input_abs = str(project_root / input_path) if not Path(input_path).is_absolute() else input_path

    # 시나리오 로드
    scenario = json.loads(Path(scenario_abs).read_text(encoding="utf-8"))
    title_slug = scenario.get("title", "demo").replace(" ", "_").replace("—", "").lower()[:30]

    print("=" * 60)
    print(f"🎬 데모 영상 편집 파이프라인")
    print(f"   입력: {input_abs}")
    print(f"   언어: {lang}")
    print(f"   시나리오: {scenario_abs}")
    print("=" * 60)

    # ── Step 1: Scene 감지 ──
    print("\n" + "─" * 40)
    print("📌 Step 1/5: Scene 감지 (OpenCV)")
    print("─" * 40)
    scenes_json = str(project_root / "video" / "trimmed" / "scenes.json")
    scenes = detect_scene_changes(input_abs, threshold)
    Path(scenes_json).parent.mkdir(parents=True, exist_ok=True)
    Path(scenes_json).write_text(
        json.dumps(scenes, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # ── Step 2: 트리밍 ──
    print("\n" + "─" * 40)
    print("📌 Step 2/5: 트리밍 (FFmpeg)")
    print("─" * 40)
    trimmed_dir = str(project_root / "video" / "trimmed")
    trim_scenes(
        input_abs,
        scenes_json if scenes else None,
        scenario_abs,
        trimmed_dir,
        speed,
    )
    merged_video = str(Path(trimmed_dir) / "merged.mp4")

    # ── Step 3: 자막 생성 ──
    print("\n" + "─" * 40)
    print("📌 Step 3/5: 자막 생성 (SRT)")
    print("─" * 40)
    srt_path = str(project_root / "video" / "subtitles" / f"demo_{lang}.srt")
    generate_srt(scenario_abs, lang, srt_path)

    # ── Step 4: TTS 생성 ──
    print("\n" + "─" * 40)
    print("📌 Step 4/5: TTS 나레이션 생성 (edge-tts)")
    print("─" * 40)
    tts_dir = str(project_root / "video" / "tts")
    asyncio.run(generate_all_narrations(scenario_abs, lang, tts_dir))

    # ── Step 5: 합성 ──
    print("\n" + "─" * 40)
    print("📌 Step 5/5: 최종 합성 (FFmpeg)")
    print("─" * 40)
    out_dir = Path(project_root / output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    output_filename = f"foundry_iq_demo_1min_{lang}.mp4"
    output_path = str(out_dir / output_filename)
    compose_final(merged_video, tts_dir, srt_path, output_path)

    # ── 완료 ──
    print("\n" + "=" * 60)
    print(f"🎉 파이프라인 완료!")
    print(f"   최종 영상: {output_path}")
    print("=" * 60)

    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="데모 영상 편집 파이프라인 — raw 녹화 → 1분 데모 영상",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예:
  python scripts/run_pipeline.py --input video/raw/demo.mov --lang ko
  python scripts/run_pipeline.py --input video/raw/demo.mov --lang en
  python scripts/run_pipeline.py --input video/raw/demo.mov --lang ko --speed 1.2
        """,
    )
    parser.add_argument("--input", "-i", required=True, help="입력 영상 파일 경로")
    parser.add_argument("--lang", "-l", default="ko", choices=["ko", "en"], help="언어 코드 (기본: ko)")
    parser.add_argument("--scenario", "-s", default="config/demo_scenario.json", help="시나리오 JSON 경로")
    parser.add_argument("--output-dir", "-o", default="video/output", help="출력 디렉토리 (기본: video/output)")
    parser.add_argument("--threshold", "-t", type=float, default=30.0, help="Scene 감지 임계값 (기본: 30)")
    parser.add_argument("--speed", type=float, default=1.0, help="재생 속도 배율 (기본: 1.0)")
    args = parser.parse_args()

    run_pipeline(
        args.input, args.lang, args.scenario, args.output_dir,
        args.threshold, args.speed,
    )


if __name__ == "__main__":
    main()
