# 🎬 my-ai-video-cut

> raw 화면 녹화 → 컷 편집 → 자막 → TTS 나레이션 → 최종 합성  
> Copilot 에이전트가 데모 영상 편집을 자동화합니다.

## 구조

```
.github/
├── copilot-instructions.md          # Workspace 전역 지침
├── agents/
│   └── video-editor.agent.md        # 데모 영상 편집 에이전트
└── skills/
    └── video-editor/
        ├── SKILL.md                 # 스킬 정의 (I/O 명세, FFmpeg 패턴, 트러블슈팅)
        └── scripts/
            ├── scene_detector.py    # OpenCV 화면 변화 감지 → 컷 포인트
            ├── trimmer.py           # FFmpeg 구간 트리밍 + 클립 병합
            ├── subtitle_generator.py # SRT 자막 생성
            ├── tts_generator.py     # edge-tts 나레이션 생성
            └── composer.py          # 영상 + 자막 + TTS 최종 합성
scripts/
└── run_pipeline.py                  # 전체 파이프라인 실행
config/
└── demo_scenario.json               # 촬영 시나리오 (Scene별 타이밍 + 스크립트)
video/
├── raw/          # 원본 화면 녹화
├── trimmed/      # 트리밍된 클립
├── tts/          # TTS 음성 파일
├── subtitles/    # SRT 자막 파일
└── output/       # 최종 영상
```

## 설치

```bash
# FFmpeg (이미 설치된 경우 생략)
brew install ffmpeg

# Python 의존성
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## 사용법

### 전체 파이프라인 (한 번에)

```bash
# 한국어 버전
.venv/bin/python scripts/run_pipeline.py --input video/raw/demo.mov --lang ko
# → video/output/foundry_iq_demo_1min_ko.mp4

# 영어 버전
.venv/bin/python scripts/run_pipeline.py --input video/raw/demo.mov --lang en
# → video/output/foundry_iq_demo_1min_en.mp4

# 1분 초과 시 1.2x 속도
.venv/bin/python scripts/run_pipeline.py --input video/raw/demo.mov --lang ko --speed 1.2
```

### 개별 단계 실행

```bash
SCRIPTS=.github/skills/video-editor/scripts

# 1. Scene 감지
.venv/bin/python $SCRIPTS/scene_detector.py \
  --input video/raw/demo.mov --output video/trimmed/scenes.json

# 2. 트리밍
.venv/bin/python $SCRIPTS/trimmer.py \
  --input video/raw/demo.mov --scenes video/trimmed/scenes.json \
  --output-dir video/trimmed/

# 3. 자막 생성
.venv/bin/python $SCRIPTS/subtitle_generator.py \
  --scenario config/demo_scenario.json --lang ko \
  --output video/subtitles/demo_ko.srt

# 4. TTS 나레이션
.venv/bin/python $SCRIPTS/tts_generator.py \
  --scenario config/demo_scenario.json --lang ko \
  --output-dir video/tts/

# 5. 최종 합성
.venv/bin/python $SCRIPTS/composer.py \
  --video video/trimmed/merged.mp4 \
  --tts-dir video/tts/ \
  --srt video/subtitles/demo_ko.srt \
  --output video/output/foundry_iq_demo_1min_ko.mp4
```

## VS Code Copilot 연동

Chat에서 에이전트와 스킬을 직접 사용할 수 있습니다:

- **에이전트**: Agent picker에서 `video-editor` 선택
- **스킬**: Chat에서 `/video-editor` 입력

### 에이전트 프롬프트 예시

```
@video-editor

video/raw/demo.mov 영상을 편집해줘.
config/demo_scenario.json 시나리오 참고.
한국어 1분 데모 영상 생성.
```

## 파이프라인 흐름

```
raw 영상 (.mov)
    │
    ▼
┌─────────────────┐
│ scene_detector   │  OpenCV 프레임 비교 → 컷 포인트 감지
└────────┬────────┘
         ▼
┌─────────────────┐
│ trimmer          │  FFmpeg 구간 트리밍 + concat → merged.mp4
└────────┬────────┘
         ▼
┌─────────────────┐  ┌─────────────────┐
│ subtitle_gen     │  │ tts_generator    │  병렬 실행 가능
│ → .srt           │  │ → .mp3 × N      │
└────────┬────────┘  └────────┬────────┘
         └──────┬─────────────┘
                ▼
┌─────────────────┐
│ composer         │  FFmpeg 합성 (영상 + 자막 + TTS)
└────────┬────────┘
         ▼
    최종 MP4 (1분)
```

## 시나리오 커스터마이징

[config/demo_scenario.json](config/demo_scenario.json) 을 수정하여 Scene 구성, 자막, TTS 음성을 변경할 수 있습니다:

| 필드 | 설명 |
|------|------|
| `scenes[].id` | Scene 고유 ID |
| `scenes[].duration_target` | 목표 길이 (초) |
| `scenes[].script_ko` | 한국어 자막/나레이션 텍스트 |
| `scenes[].script_en` | 영어 자막/나레이션 텍스트 |
| `voice_ko` | 한국어 TTS 음성 (기본: `ko-KR-SunHiNeural`) |
| `voice_en` | 영어 TTS 음성 (기본: `en-US-AriaNeural`) |

## 참고

- `video/` 폴더는 `.gitignore`로 제외됩니다
- edge-tts는 인터넷 연결이 필요합니다
- Mac Retina 녹화(2x 해상도)는 자동으로 1920×1080 스케일 다운됩니다
- 한글 자막 폰트: Apple SD Gothic Neo

---

*Hyeonsang Jeon · 2026.03*
