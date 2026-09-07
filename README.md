# my-ai-video-cut

> YouTube·로컬 영상 → 구간 선별 → 컷·취합 → 다국어 SRT → 선택형 음성·자막 합성

**Markdown 중심 영상 편집 스킬**입니다. 에이전트가 요청과 자료를 해석하고,
FFmpeg/ffprobe/jq 같은 CLI가 미디어 처리와 시간 계산을 담당합니다.
새 Python 애플리케이션이나 특정 모델을 필수로 요구하지 않습니다.

## 라이선스와 접근 권한

코드와 스킬 문서는 [MIT License](LICENSE)를 적용합니다. **저장소와 GitHub
Release는 private로 유지**하며, 다운로드하려면 저장소 접근 권한이 필요합니다.
MIT는 저장소를 공개하는 설정이 아니라 코드를 받은 사람의 사용·수정·상업적 이용·
재배포를 허용하는 조건입니다. 저작권/허가 고지는 보존해야 합니다.
입력 영상·음원·폰트·외부 도구의 권리와 라이선스는 별도입니다.

## 스킬과 플러그인 등록

Codex, GitHub Copilot, Claude Code가 같은
[video-editor 스킬](.github/skills/video-editor/SKILL.md)을 사용합니다.
호스트별 등록 명령과 로컬/저장소 설치 방법은
[설치 안내](docs/INSTALLATION.md)를 참고하세요.
플러그인 등록은 FFmpeg 같은 외부 도구 설치나 미디어 전송을 자동 승인하지 않습니다.
Copilot은 marketplace 방식 설치를 우선합니다. 직접 경로/저장소 설치는 현재 CLI에서
deprecated 경고가 나올 수 있습니다.

## 배포 번들과 개발 검증

미디어가 섞인 작업 폴더를 그대로 설치하지 않고, 허용된 파일만 번들로 만듭니다.
생성기는 Node.js 22 이상의 내장 모듈만 사용하며 npm 패키지는 필요 없습니다.
**이 개발 도구는 설치된 영상 스킬의 런타임 의존성이 아닙니다.**

```bash
node tools/package-plugin.mjs --output dist/video-editor
node --test tests/*.test.mjs
```

기존 출력은 덮어쓰지 않습니다. 배포 버전별로 새 경로를 사용하세요.
테스트에는 FFmpeg/ffprobe, jq, libass와 기본 폰트가 필요하며 실제 영상 다운로드,
ASR/TTS 서비스, 호스트 모델 호출은 하지 않습니다.
[개발·호환성·비교 안내](docs/DEVELOPMENT.md)에 검증 범위와 남은 배포 조건을 정리했습니다.

## 사용 예시

```text
video-editor 스킬로 내가 이용 권한을 가진 YouTube 영상 두 개를 편집해줘.
소스: <첫 번째 URL>, <두 번째 URL>
주제: 두 영상에서 설명하는 핵심 개념과 사례
길이: 90~120초
원음을 유지하고 한국어·영어 SRT를 각각 만들어줘.
한국어는 간결한 존댓말, 제품명과 수치는 원문대로 유지해줘.
영상은 비율을 보존하고, 한국어 번인 버전도 출력해줘.
```

```text
input/interview.mp4의 00:30~00:45와 input/demo.mov의 01:10~01:25를
이 순서로 연결해줘. 같이 제공한 SRT를 컷에 맞춰 한국어로 번역해줘.
TTS와 업로드는 하지 마.
```

```text
captions/source.srt를 일본어로 번역해줘.
시간과 의미를 유지하고, 용어집을 따라 자연스러운 발표체로 써줘.
영상 다운로드나 재인코딩은 필요 없어.
```

## 새 작업 흐름

| 단계 | 내용 |
|---|---|
| 요청 | [요청 양식](.github/skills/video-editor/assets/brief.template.md)으로 소스·권한·목적·출력 지정 |
| 수집 | 메타데이터/자막을 먼저 확인하고 필요한 미디어만 확보 |
| 편집 | [편집표](.github/skills/video-editor/assets/edit-plan.template.md)의 단일 JSON 블록에서 타임라인 계산 |
| 자막 | 원본 cue의 컷 교집합·배속·누적 시작을 계산한 뒤 언어별로 번역 |
| 출력 | 원음/무음/선택형 TTS, 별도 SRT·번인·내장 자막 중 필요한 결과만 생성 |

`video/jobs/<job-id>/`로 작업을 분리하고 원본과 이전 결과는 보존합니다.
작업 디렉터리는 스킬 설치 경로와 독립적입니다. 영상이 60초를 넘는다고
임의로 배속하거나, 번역 요청에 TTS를 자동으로 추가하지 않습니다.

기본 지원은 순차 하드컷과 클립별 0.5~2배 고정 배속입니다.
크로스페이드·속도 램프·라이브 스트림은 별도 설계가 필요합니다.
다운로드·재편집이 허용된 소스만 처리하며 게시/업로드는 자동 실행하지 않습니다.

## 도구

기본은 FFmpeg/ffprobe와 jq 1.6 이상입니다. URL 수집에는 yt-dlp,
번인에는 libass와 해당 언어 폰트, ASR/TTS에는 선택한 도구가 추가로 필요합니다.
먼저 설치 상태를 확인하고 **없는 도구만** 설치합니다. 자세한 조건은
[도구 안내](.github/skills/video-editor/references/tools.md)에 있습니다.

## 스킬 구조

```text
.github/skills/video-editor/
├── SKILL.md
├── references/
│   ├── tools.md
│   ├── sources.md
│   ├── editing.md
│   ├── subtitles.md
│   ├── localization.md
│   ├── audio.md
│   └── export.md
├── assets/
│   ├── brief.template.md
│   ├── edit-plan.template.md
│   └── language-profile.template.md
└── scripts/  # 기존 Python 파이프라인, 기본 경로가 아님
```

## 레거시 Python 데모 파이프라인

아래는 기존 작업을 위한 호환용 안내입니다. 기존 Python 파일과 사용자 수정은
보존하며, 위 범용 스킬에서 자동 호출하지 않습니다. YouTube 수집·다국어 원본 SRT
편집은 **새 스킬 흐름**을 사용하세요.

기존 파이프라인은 클립/자막/음성의 공통 타임라인이나 작업별 분리를 보장하지
않습니다. 시나리오는 실제 존재하는 JSON을 `--scenario`로 지정해야 합니다.
`config/demo_scenario.json`을 옮긴 작업 트리에서는 기본 명령이 동작하지 않으며,
이 문서가 사용자의 파일을 자동 복구하지는 않습니다.

### 레거시 구조

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

### 레거시 설치

```bash
# 기존 FFmpeg에 subtitles 필터가 없을 때 검토할 libass 포함 빌드
brew tap homebrew-ffmpeg/ffmpeg
brew install homebrew-ffmpeg/ffmpeg/ffmpeg --with-libass

# Python 의존성
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 레거시 사용법

#### 전체 파이프라인 (한 번에)

```bash
# 실제 존재하는 사용자 시나리오 JSON 경로로 설정
SCENARIO=/absolute/path/to/scenario.json
test -f "$SCENARIO"

# 한국어 버전
.venv/bin/python scripts/run_pipeline.py --input video/raw/demo.mov --scenario "$SCENARIO" --lang ko
# → video/output/foundry_iq_demo_1min_ko.mp4

# 영어 버전
.venv/bin/python scripts/run_pipeline.py --input video/raw/demo.mov --scenario "$SCENARIO" --lang en
# → video/output/foundry_iq_demo_1min_en.mp4

# 1분 초과 시 1.2x 속도
.venv/bin/python scripts/run_pipeline.py --input video/raw/demo.mov --scenario "$SCENARIO" --lang ko --speed 1.2
```

#### 레거시 개별 단계

같은 셸에서 위 `SCENARIO`를 지정한 뒤 실행합니다. 이 예시의 씬 감지는
유지할 내용의 선별을 대신하지 않습니다.

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
  --scenario "$SCENARIO" --lang ko \
  --output video/subtitles/demo_ko.srt

# 4. TTS 나레이션
.venv/bin/python $SCRIPTS/tts_generator.py \
  --scenario "$SCENARIO" --lang ko \
  --output-dir video/tts/

# 5. 최종 합성
.venv/bin/python $SCRIPTS/composer.py \
  --video video/trimmed/merged.mp4 \
  --tts-dir video/tts/ \
  --srt video/subtitles/demo_ko.srt \
  --output video/output/foundry_iq_demo_1min_ko.mp4
```

### VS Code Copilot 연동

Chat에서 에이전트와 스킬을 직접 사용할 수 있습니다:

- **에이전트**: Agent picker에서 `video-editor` 선택
- **스킬**: Chat에서 `/video-editor` 입력

#### 레거시 에이전트 프롬프트 예시

```
@video-editor

video/raw/demo.mov 영상을 편집해줘.
기존 Python 파이프라인을 명시적으로 사용하고,
내가 제공한 실제 시나리오 JSON 경로를 --scenario로 지정해줘.
```

### 레거시 파이프라인 흐름

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

### 레거시 시나리오 커스터마이징

사용자가 지정한 시나리오 JSON으로 Scene 구성, 자막, TTS 음성을 변경합니다
(`config/demo_scenario.json`은 기존 기본 경로이며 현재 존재한다고 가정하지 않습니다).

| 필드 | 설명 |
|------|------|
| `scenes[].id` | Scene 고유 ID |
| `scenes[].duration_target` | 목표 길이 (초) |
| `scenes[].script_ko` | 한국어 자막/나레이션 텍스트 |
| `scenes[].script_en` | 영어 자막/나레이션 텍스트 |
| `voice_ko` | 한국어 TTS 음성 (기본: `ko-KR-SunHiNeural`) |
| `voice_en` | 영어 TTS 음성 (기본: `en-US-AriaNeural`) |

### 레거시 FFmpeg 자막 Burn-in (subtitles 필터)

FFmpeg의 `subtitles` 필터(libass 기반)를 사용하여 SRT 자막을 영상에 직접 렌더링합니다.
아래 스타일과 Python 이스케이프 코드는 기존 작업 참고용으로 보존합니다.
새 스킬은 안전한 작업 상대 경로와
[출력 레시피](.github/skills/video-editor/references/export.md)를 사용합니다.

#### 레거시 기본 명령

```bash
ffmpeg -y -i merged.mp4 \
  -vf "subtitles=video/subtitles/demo_ko.srt:force_style='FontName=Apple SD Gothic Neo,FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,MarginV=80'" \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  output.mp4
```

#### force_style 파라미터

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `FontName` | `Apple SD Gothic Neo` | macOS 한글 기본 폰트 |
| `FontSize` | `22` | 자막 크기 |
| `PrimaryColour` | `&HFFFFFF` | 흰색 텍스트 |
| `OutlineColour` | `&H000000` | 검정 외곽선 |
| `Outline` | `2` | 외곽선 두께 |
| `MarginV` | `80` | 하단 여백 (px) |

#### libass 경로 이스케이프 이슈

FFmpeg `subtitles` 필터는 내부적으로 **libass** 라이브러리를 사용하며, SRT 파일 경로에 특수문자(`:`, `\`, `'`, 공백 등)가 포함되면 파싱 에러가 발생합니다. 특히 macOS의 절대 경로(`/Users/...`)에는 콜론이 없지만, 프로젝트 경로에 공백이 있거나 Windows 환경(`C:\...`)에서는 반드시 이스케이프가 필요합니다.

**기존 `composer.py`의 이스케이프 처리:**

```python
# SRT 절대 경로의 특수문자를 FFmpeg subtitles 필터 형식에 맞게 이스케이프
srt_abs = str(Path(srt_path).resolve())
srt_escaped = (
    srt_abs
    .replace("\\", "\\\\\\\\")   # \ → \\\\
    .replace(":", "\\\\:")       # : → \\:
    .replace("'", "\\\\'")      # ' → \\'
)
subtitle_filter = f"subtitles={srt_escaped}:force_style='...'"
```

**에러 예시 (이스케이프 미적용 시):**

```
[Parsed_subtitles_0 @ 0x...] No usable fontconfig configuration found
[libass] Shaper: FriBidi 1.0.x (SIMPLE) HarfBuzz-ng 8.x.x (COMPLEX)
[Parsed_subtitles_0 @ 0x...] Unable to open subtitles file
```

#### libass 주요 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `Unable to open subtitles file` | 경로 특수문자 미이스케이프 | 위 이스케이프 코드 적용 또는 상대 경로 사용 |
| `No usable fontconfig configuration found` | fontconfig 미설치 | `brew install fontconfig` (FFmpeg 8.x에서는 보통 번들됨) |
| 한글 자막이 `□□□`로 표시 | 한글 폰트 누락 | macOS: "Apple SD Gothic Neo" 확인, Linux: `apt install fonts-noto-cjk` |
| 자막이 안 보임 (렌더링 OK) | `MarginV` 값이 너무 크거나 작음 | `force_style='MarginV=80'` 조정 |
| `Discarding subtitle at time > video` | SRT 타이밍이 영상 길이 초과 | 실제 클립 순서·길이·배속 기준으로 SRT 재생성; 새 흐름은 `timeline.json` 사용 |

#### FFmpeg 빌드 확인

`subtitles` 필터를 사용하려면 FFmpeg이 `--enable-libass`로 빌드되어 있어야 합니다:

```bash
# libass 지원 확인
ffmpeg -filters 2>/dev/null | grep subtitles
# 출력: .. subtitles  V->V  Render text subtitles onto input video using the libass library.

# homebrew-ffmpeg tap으로 libass 포함 설치
brew tap homebrew-ffmpeg/ffmpeg
brew install homebrew-ffmpeg/ffmpeg/ffmpeg --with-libass
```

## 참고

- 새 작업의 `video/jobs/`와 기존 지정된 미디어 하위 폴더는 `.gitignore`로 제외됩니다
- edge-tts는 인터넷 연결이 필요합니다
- 새 스킬은 출력 규격에 맞춰 비율을 보존합니다. 기존 Python 구현은 자동 1920×1080 축소를 보장하지 않습니다
- Apple SD Gothic Neo는 macOS 폰트 예시이며 다른 환경에서는 설치된 한글 폰트를 선택합니다

---

*Hyeonsang Jeon · 2026.03*
