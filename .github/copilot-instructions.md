# Project Guidelines - my-ai-video-cut

## Overview

Markdown 중심의 영상 편집 플러그인이다. 이용 권한이 있는 YouTube/로컬 영상의
구간 선별·컷·취합, SRT/VTT 시간 변환, 다국어 자막과 선택형 음성을 지원한다.
GitHub Copilot, Codex, Claude Code가 같은 스킬을 읽는다.

## Conventions

- `.github/skills/video-editor/SKILL.md`가 유일한 공통 진입점이다. 필요한 참고 문서만 읽는다.
- 영상 처리 절차는 Markdown과 FFmpeg/ffprobe/jq CLI 레시피로 작성한다.
- 별도 Python 구현, 프로젝트 가상환경 또는 작업별 실행 프로그램을 추가하지 않는다.
- `tools/`와 `tests/`는 Node.js 22 이상의 유지보수 도구이며 설치 번들에 포함하지 않는다.
- Node 도구는 내장 모듈과 명시적 오류 처리를 사용한다. 새 npm 의존성을 불필요하게 추가하지 않는다.
- 편집표 MD의 단일 JSON 블록에서 출력 프레임과 모든 자막 시간을 계산한다.
- 원음 유지·하드컷이 기본이다. TTS, 60초 제한, 자막 번인, 크롭을 묵시적으로 적용하지 않는다.
- 결과는 사용자의 작업 공간에 저장한다. 설치된 스킬 디렉터리에는 쓰지 않는다.
- 원본과 기존 작업을 보존하고 이번 편집표의 명시적 파일 목록만 합친다.
- 자막은 UTF-8이며 원문·번역·설명·새 나레이션을 구분한다.
- 다운로드 권한과 외부 전송 승인을 확인한다. 쿠키 접근·유료 API·게시·Git 작업을 자동 수행하지 않는다.
- 명시된 소스/작업/도구 설치 승인은 기존 brief에서 재사용한다. 구체적 충돌 없는 사용자 소유/허가 설명에 증빙을 반복 요구하지 않는다.
- 도구 없음·미시도·실제 실패를 구분하고, 승인 답변 뒤에는 중단 단계부터 재개한다. 필수 클립이 없는 대체 결과를 전체 완료로 보고하지 않는다.
- README는 호스트별 한 줄 최초 설치 명령과 현재 사용법만 안내한다.
- 삭제된 실행 경로나 자료를 복구하지 않는다.

## Architecture

```text
.github/skills/video-editor/SKILL.md     # 공통 스킬
.github/skills/video-editor/references/ # CLI 작업 절차
.github/skills/video-editor/assets/     # 요청/편집표/언어 템플릿
.github/skills/video-editor/agents/     # 호스트 표시 메타데이터
tools/                                 # 정적 번들 생성기
tests/                                 # 패키지·문서·미디어·native 호환성
video/jobs/                            # 로컬 산출물, Git 제외
```

## Validation

```bash
node --test tests/*.test.mjs
node tools/package-plugin.mjs --output /absolute/path/to/new-plugin-bundle
```

`tools/plugin-package.mjs`의 허용 목록 밖 파일을 배포하지 않는다.
필수 리소스를 추가하면 허용 목록과 테스트를 함께 갱신한다.
세 plugin manifest와 SKILL.md metadata.version, 라이선스를 일치시킨다.
원격에 게시되지 않은 버전이 이미 설치 가능하다고 안내하지 않는다.

미디어 검증은 작은 로컬 합성 소스를 사용한다. 외부 영상 다운로드/전사/TTS를
자동 호출하지 않는다. native CLI 확인은 opt-in으로 임시 설정 홈과 작업 공간에서만
수행한다. README의 한 줄 명령도 이 격리 환경에서 확인하며 실제 사용자 설정은 바꾸지 않는다.
