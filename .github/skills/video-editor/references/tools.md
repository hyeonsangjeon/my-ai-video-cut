# 도구와 실행 환경

## 필요한 기능만 확인

| 기능 | 도구 | 없을 때 |
|---|---|---|
| 영상 정보/컷/합성 | `ffprobe`, `ffmpeg` | 영상 처리를 중단하고 설치 필요 안내 |
| 편집표 계산/SRT 시간 변환 | `jq` 1.6 이상 | 수작업/임시 Python 계산으로 대체하지 않음 |
| YouTube 메타데이터/다운로드 | `yt-dlp` | 로컬 파일 경로는 계속 사용 가능 |
| 번인 자막 | FFmpeg `subtitles` 필터(libass), 해당 언어 폰트 | 별도 SRT는 생성 가능; 번인 성공으로 보고하지 않음 |
| ASR | 사용자가 선택한 로컬/승인된 서비스 CLI | 원본 SRT 요청 또는 자막 없는 출력만 명시적으로 선택 |
| TTS | `edge-tts` CLI 또는 사용자 지정 도구 | 원음 유지 경로에는 영향 없음 |

`yt-dlp`, `edge-tts`가 내부적으로 Python을 사용하더라도 이 스킬은 Python API나
프로젝트 가상환경을 필수로 요구하지 않는다. 도구의 설치 요구 사항은 별개다.
설치는 자동 실행하지 말고 필요한 도구가 없을 때 현재 플랫폼과 사용자 권한에
맞는 공식 배포 방법을 안내한다. `yt-dlp`는 배포판에 따라 JavaScript 런타임과
`yt-dlp-ejs`가 필요하다. 오래된 옵션을 추측하지 말고 설치 버전의 도움말을 읽는다.

```bash
ffmpeg -hide_banner -version
ffprobe -hide_banner -version
jq --version
ffmpeg -hide_banner -filters
```

YouTube/TTS 요청일 때만 추가로 실행한다.

```bash
yt-dlp --version
yt-dlp --help
edge-tts --help
```

한국어 폰트는 macOS의 Apple SD Gothic Neo, Linux의 Noto Sans CJK KR 등
실제로 설치된 폰트를 선택한다. 예제의 폰트 이름을 모든 OS에 강제하지 않는다.
fontconfig 환경에서는 `fc-match 'Noto Sans CJK KR'`의 **실제 선택된 폰트**를
확인한다. fallback 결과가 나온 것을 요청 폰트가 존재한다고 해석하지 않는다.

기존 Homebrew 설치에 libass가 빠졌을 때만 빌드/설치 대안을 검토한다.
`brew tap homebrew-ffmpeg/ffmpeg` 및 libass 포함 빌드는 가능한 선택지이지
이미 작동하는 FFmpeg를 무조건 교체하는 절차가 아니다.

## 실행 디렉터리와 셸

참고 문서의 명령은 **Bash** 기준이다. macOS/Linux의 Bash 또는 Windows의
WSL/Git Bash를 사용한다. Bash 문법을 PowerShell에 그대로 붙이지 않는다.
사용 중인 FFmpeg 실행 파일과 경로 표기 방식도 같은 환경으로 맞춘다.
전용 셸 실행 환경이 없는 호스트에서는 편집안만 만들 수 있고 렌더링은 할 수 없다.

스킬 경로는 호스트가 알려 준 실제 위치를 사용한다. `.github/skills` 또는
저장소 루트가 현재 디렉터리라고 가정하지 않는다. 모든 아래 명령은 새 작업
디렉터리에서 실행하며, 도구 호출마다 `cd`와 필요한 변수를 다시 지정한다.

```bash
# JOB은 사용자가 지정한 작업 공간 안의 새 절대 경로로 설정한다.
test ! -e "$JOB"
mkdir -p "$JOB"
cd "$JOB"
mkdir sources clips captions audio exports logs
```

명령 블록은 앞선 단계의 산출물이 있어야 한다. 여러 명령을 실행하는 Bash에는
`set -euo pipefail`을 사용하고, 파일 생성 전에는 기존 파일이 없는지 확인한다.
FFmpeg는 `-n -nostdin`으로 덮어쓰기와 입력 대기를 막는다.
실패 후 남은 파일은 성공 산출물로 사용하지 않는다. 재시도는 새 작업/버전
디렉터리에서 하거나, 이번 실행이 만든 정확한 임시 파일만 확인 후 정리한다.

텍스트 파일은 에이전트의 파일 편집 도구로 작성한다. 프로그램 출력 리다이렉션은
허용되지만 에러를 삼키거나 기존 사용자 파일을 덮어쓰지 않는다.
JSON·메타데이터를 `source`/`eval`하지 않는다. jq로 값을 읽고 인수에 따옴표를 쓴다.

## 입력 정규화

원본 경로는 공백·한글을 포함할 수 있다. 파일 도구 또는 `cp -n`으로 작업의
`sources/source-a.mov` 같은 안전한 이름에 복사하고 원본 경로를 요청 기록에 남긴다.
원본을 이동/삭제하지 않는다. 작업 공간 자체의 경로에 공백이 있어도 `cd "$JOB"`
후 필터에는 단순 상대 경로를 사용하면 여러 겹의 경로 이스케이프를 피할 수 있다.

소스마다 다음 정보를 기록한다.

```bash
ffprobe -v error -show_format -show_streams -of json sources/source-a.mp4
```

길이, 비디오/오디오 트랙, FPS/time base, 시작 타임스탬프, 회전, 화면 비율,
샘플레이트/채널, HDR/색 공간을 본다. 오디오가 없으면 무음 소스로 표시한다.
오디오와 영상의 시작 시각이 다르거나 타임스탬프가 끊기면 먼저 동기를 보존하는
정규화가 필요하다. 두 스트림의 시작을 각각 0으로 당겨 원래 지연을 없애지 않는다.
HDR→SDR은 단순 리사이즈가 아니므로 명시적인 톤 매핑 정책 없이 출력하지 않는다.

## 공식 참고

- [FFmpeg CLI](https://ffmpeg.org/ffmpeg.html)
- [FFmpeg 필터](https://ffmpeg.org/ffmpeg-filters.html)
- [jq 매뉴얼](https://jqlang.org/manual/)
- [yt-dlp 설치/의존성](https://github.com/yt-dlp/yt-dlp#installation)
- [edge-tts CLI](https://github.com/rany2/edge-tts#usage)
