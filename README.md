# my-ai-video-cut

> YouTube·로컬 영상 → 구간 선별 → 컷·취합 → 다국어 SRT → 선택형 음성·자막 합성

**Markdown 중심 영상 편집 스킬**입니다. 에이전트가 요청과 자료를 해석하고,
FFmpeg/ffprobe/jq 같은 CLI가 미디어 처리와 시간 계산을 담당합니다.
편집 절차는 MD와 CLI 레시피로 구성되며, 특정 모델이나 프로젝트 가상환경에 묶이지 않습니다.

## 플러그인 한 줄 설치

아래는 **사용자 전역 최초 설치** 명령입니다. 각 CLI 설치·로그인이 필요하며,
저장소가 private인 경우 해당 GitHub 저장소를 읽을 권한도 있어야 합니다.

| 플러그인 | 한 줄 설치 명령 |
|---|---|
| GHCP | `copilot plugin marketplace add hyeonsangjeon/my-ai-video-cut && copilot plugin install video-editor@my-ai-video-cut` |
| Codex | `codex plugin marketplace add hyeonsangjeon/my-ai-video-cut && codex plugin add video-editor@my-ai-video-cut` |
| Claude Code | `claude plugin marketplace add hyeonsangjeon/my-ai-video-cut --scope user && claude plugin install video-editor@my-ai-video-cut --scope user` |

세 도구는 같은 [video-editor 스킬](.github/skills/video-editor/SKILL.md)을 사용합니다.
이미 카탈로그가 등록되어 있거나 프로젝트 범위에만 설치하려면
[설치·업데이트 안내](docs/INSTALLATION.md)를 따르세요.
원격 명령은 게시된 소스를 설치합니다. 미게시 변경은 로컬 번들로 사용할 수 있습니다.
플러그인 설치가 외부 도구 설치나 미디어 전송을 자동 승인하지는 않습니다.
이미 승인된 소스·로컬 다운로드/재편집·도구 설치 범위는 재사용합니다. 도구 없음,
미시도와 실제 실패를 구분하고, 보류 사유가 해소되면 해당 단계부터 이어갑니다.

## 라이선스와 접근 권한

코드와 스킬 문서는 [MIT License](LICENSE)를 적용합니다.
MIT는 코드 수신자의 사용·수정·상업적 이용·재배포 조건이며, 저장소 공개 범위와는
별개입니다. 저작권/허가 고지는 보존해야 합니다.
입력 영상·음원·폰트·외부 도구의 권리와 라이선스는 별도입니다.

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
[개발·호환성·비교 안내](docs/DEVELOPMENT.md)에 검증 범위와 배포 조건을 정리했습니다.

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

## 작업 흐름

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

## 배포 스킬 구조

```text
.github/skills/video-editor/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── tools.md
│   ├── sources.md
│   ├── editing.md
│   ├── subtitles.md
│   ├── localization.md
│   ├── audio.md
│   └── export.md
└── assets/
    ├── brief.template.md
    ├── edit-plan.template.md
    └── language-profile.template.md
```

`input/`, `output/`, `video/`, `task/`, `config/backup/`은 로컬 제작 자료용으로
Git 추적에서 제외합니다. 이 규칙은 파일을 삭제하지 않으며, 기존 커밋이나
이전 릴리스의 내용을 지우는 기능도 아닙니다.
