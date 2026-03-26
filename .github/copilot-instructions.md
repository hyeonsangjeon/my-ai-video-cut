# Project Guidelines — my-ai-video-cut

## Overview

데모 화면 녹화(raw)를 자동 편집하여 1분 데모 영상을 생성하는 파이프라인 프로젝트.  
OpenCV(scene 감지) → FFmpeg(트리밍) → SRT(자막) → edge-tts(나레이션) → FFmpeg(합성).

## Code Style

- Python 3.10+, type hints 사용
- FFmpeg는 `subprocess.run(cmd, check=True)` 로 호출
- edge-tts는 `asyncio.run()` 패턴 사용
- 모든 스크립트는 `argparse` CLI 인터페이스 제공
- 파일 경로는 `pathlib.Path` 사용

## Architecture

```
.github/skills/video-editor/scripts/   # 핵심 모듈 (scene_detector, trimmer, subtitle_generator, tts_generator, composer)
scripts/run_pipeline.py                 # 파이프라인 오케스트레이터 (위 모듈들을 순차 호출)
config/demo_scenario.json               # 촬영 시나리오 + 타이밍 + 스크립트
video/                                  # 영상 파일 (git 추적 안 함)
```

## Build and Test

```bash
pip install -r requirements.txt
# FFmpeg는 brew install ffmpeg으로 이미 설치됨

# 전체 파이프라인 실행
python scripts/run_pipeline.py --input video/raw/demo.mov --lang ko

# 개별 스크립트 테스트
python .github/skills/video-editor/scripts/scene_detector.py --help
python .github/skills/video-editor/scripts/tts_generator.py --help
```

## Conventions

- `video/` 폴더는 `.gitignore`로 제외 — 영상 파일을 git에 올리지 않음
- 자막 인코딩은 항상 UTF-8
- TTS 음성: 한국어 `ko-KR-SunHiNeural`, 영어 `en-US-AriaNeural`
- Mac Retina 녹화 시 해상도가 2x일 수 있음 — 필요 시 1920x1080으로 스케일 다운
