#!/usr/bin/env python3
"""OpenCV 기반 화면 변화 감지 → Scene 컷 포인트 추출."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def detect_scene_changes(
    video_path: str,
    threshold: float = 30.0,
    min_gap: float = 2.0,
) -> list[dict]:
    """프레임 간 차이를 비교하여 Scene 변화 시점을 감지.

    Args:
        video_path: 입력 영상 경로.
        threshold: 프레임 차이 임계값 (낮을수록 민감).
        min_gap: 연속 scene 변화 사이 최소 간격(초).

    Returns:
        [{"timestamp": float, "frame_number": int, "diff_score": float}, ...]
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"영상을 열 수 없습니다: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"📹 입력: {video_path}")
    print(f"   FPS: {fps:.1f} | 총 프레임: {total_frames} | 길이: {duration:.1f}초")

    prev_gray = None
    scenes: list[dict] = []
    last_scene_ts = -min_gap  # 첫 scene은 항상 허용

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # 성능: 프레임을 축소하여 비교
        gray_small = cv2.resize(gray, (320, 180))

        if prev_gray is not None:
            diff = cv2.absdiff(prev_gray, gray_small)
            score = float(np.mean(diff))

            if score > threshold:
                timestamp = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
                if timestamp - last_scene_ts >= min_gap:
                    scenes.append({
                        "timestamp": round(timestamp, 3),
                        "frame_number": frame_idx,
                        "diff_score": round(score, 2),
                    })
                    last_scene_ts = timestamp

        prev_gray = gray_small
        frame_idx += 1

    cap.release()

    print(f"✅ {len(scenes)}개 Scene 변화 감지됨")
    for i, s in enumerate(scenes):
        print(f"   [{i+1}] {s['timestamp']:.1f}초 (frame {s['frame_number']}, score {s['diff_score']})")

    return scenes


def main() -> None:
    parser = argparse.ArgumentParser(description="OpenCV 화면 변화 감지 → 컷 포인트 추출")
    parser.add_argument("--input", "-i", required=True, help="입력 영상 파일 경로")
    parser.add_argument("--threshold", "-t", type=float, default=30.0, help="프레임 차이 임계값 (기본: 30)")
    parser.add_argument("--min-gap", type=float, default=2.0, help="연속 scene 간 최소 간격 초 (기본: 2.0)")
    parser.add_argument("--output", "-o", default="scenes.json", help="출력 JSON 파일 경로 (기본: scenes.json)")
    args = parser.parse_args()

    scenes = detect_scene_changes(args.input, args.threshold, args.min_gap)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(scenes, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"💾 저장: {out_path}")


if __name__ == "__main__":
    main()
