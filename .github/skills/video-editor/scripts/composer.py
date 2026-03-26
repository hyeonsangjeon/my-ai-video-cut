#!/usr/bin/env python3
"""영상 + TTS 오디오 + 자막 최종 합성."""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path


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


def concat_tts_audio(tts_dir: str, output_path: str) -> None:
    """TTS MP3 파일들을 하나의 오디오로 연결."""
    tts_files = sorted(Path(tts_dir).glob("*.mp3"))
    if not tts_files:
        raise FileNotFoundError(f"TTS 파일이 없습니다: {tts_dir}")

    print(f"   🔊 TTS 오디오 {len(tts_files)}개 연결")

    if len(tts_files) == 1:
        import shutil
        shutil.copy2(tts_files[0], output_path)
        return

    # concat demuxer 사용
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False
    ) as f:
        for mp3 in tts_files:
            f.write(f"file '{mp3.resolve()}'\n")
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


def compose_final(
    video_path: str,
    tts_dir: str,
    srt_path: str,
    output_path: str,
    font_name: str = "Apple SD Gothic Neo",
) -> None:
    """영상 + TTS + 자막을 합성하여 최종 출력.

    Args:
        video_path: 트리밍/병합된 영상 경로.
        tts_dir: TTS MP3 파일 디렉토리.
        srt_path: SRT 자막 파일 경로.
        output_path: 최종 출력 MP4 경로.
        font_name: 자막 폰트 이름.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    print(f"🎬 최종 합성 시작")
    print(f"   영상: {video_path}")
    print(f"   TTS:  {tts_dir}")
    print(f"   자막: {srt_path}")

    # 1. TTS 오디오 연결
    narration_path = str(Path(tts_dir) / "_narration_full.mp3")
    concat_tts_audio(tts_dir, narration_path)

    # 2. 해상도 확인 → Retina 스케일 다운 필요 여부
    width, height = get_video_resolution(video_path)
    vf_filters: list[str] = []

    if width > 1920 or height > 1080:
        print(f"   ⚠️  Retina 해상도 ({width}x{height}) → 1920x1080 스케일 다운")
        vf_filters.append("scale=1920:1080")

    # 3. 자막 필터 (SRT 경로의 특수문자 이스케이프)
    srt_escaped = srt_path.replace("\\", "\\\\").replace(":", "\\:")
    subtitle_filter = (
        f"subtitles={srt_escaped}:force_style='"
        f"FontName={font_name},"
        f"FontSize=22,"
        f"PrimaryColour=&HFFFFFF,"
        f"OutlineColour=&H000000,"
        f"Outline=2,"
        f"MarginV=30'"
    )
    vf_filters.append(subtitle_filter)

    # 4. FFmpeg 합성 명령
    vf_str = ",".join(vf_filters)
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", narration_path,
        "-vf", vf_str,
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_path,
    ]
    subprocess.run(cmd, check=True)

    # 5. 임시 파일 정리
    Path(narration_path).unlink(missing_ok=True)

    final_duration = get_video_duration(output_path)
    print(f"✅ 최종 영상 생성: {output_path} ({final_duration:.1f}초)")


def main() -> None:
    parser = argparse.ArgumentParser(description="영상 + TTS + 자막 최종 합성")
    parser.add_argument("--video", "-v", required=True, help="트리밍/병합된 영상 경로")
    parser.add_argument("--tts-dir", "-t", required=True, help="TTS MP3 디렉토리")
    parser.add_argument("--srt", "-s", required=True, help="SRT 자막 파일 경로")
    parser.add_argument("--output", "-o", default="video/output/demo.mp4", help="최종 출력 경로")
    parser.add_argument("--font", default="Apple SD Gothic Neo", help="자막 폰트 (기본: Apple SD Gothic Neo)")
    args = parser.parse_args()

    compose_final(args.video, args.tts_dir, args.srt, args.output, args.font)


if __name__ == "__main__":
    main()
