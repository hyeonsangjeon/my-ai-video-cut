# Project Guidelines — my-ai-video-cut

## Overview

Markdown 중심의 범용 영상 편집 스킬. 이용 권한이 있는 YouTube/로컬 영상의
구간 선별·컷·취합, SRT/VTT 시간 변환, 다국어 자막과 선택형 TTS를 지원한다.
기존 Python 데모 파이프라인은 호환용으로 보존한다.

## Skill Conventions

- `.github/skills/video-editor/SKILL.md`가 공통 진입점이다. 필요한 참고 문서만 읽는다.
- 스킬/참고 문서/템플릿을 우선 개선한다. Python 프로그램을 새 기본 실행 경로로 만들지 않는다.
- FFmpeg/ffprobe/jq CLI 레시피를 사용한다. 도구 누락을 임시 Python 생성으로 우회하지 않는다.
- 편집표 MD 안의 단일 JSON 블록을 기준으로 출력 프레임과 모든 자막 시간을 계산한다.
- 원음 유지·하드컷이 기본이다. TTS, 60초 제한, 자막 번인, 크롭을 묵시적으로 적용하지 않는다.
- 결과는 현재 작업 공간의 `video/jobs/<job-id>/` 또는 지정한 출력 위치에 저장한다. 설치된 스킬 디렉터리에 쓰지 않는다.
- 원본과 이전 작업을 보존한다. 이번 편집표의 명시적 파일 목록만 합친다.
- 자막은 UTF-8. 원문·번역·설명·새 나레이션을 구분하고 원본/결과 시간 기준을 혼동하지 않는다.
- 다운로드 권한과 외부 전송 승인을 확인한다. 쿠키 접근·유료 API·게시·커밋·push를 자동 실행하지 않는다.
- 호스트별 등록은 plugin manifest와 `docs/INSTALLATION.md`에서 관리한다. 공통 스킬에 모델/도구 ID를 고정하지 않는다.

## Legacy Python Style

- Python 3.10+, type hints 사용
- FFmpeg는 `subprocess.run(cmd, check=True)` 로 호출
- edge-tts는 `asyncio.run()` 패턴 사용
- 모든 스크립트는 `argparse` CLI 인터페이스 제공
- 파일 경로는 `pathlib.Path` 사용

## Architecture

```
.github/skills/video-editor/SKILL.md     # 이식 가능한 공통 스킬
.github/skills/video-editor/references/ # 도구·소스·편집·자막·언어·오디오·출력
.github/skills/video-editor/assets/     # Markdown 요청/편집표/언어 템플릿
.github/skills/video-editor/scripts/    # 기존 Python 모듈 (호환용)
scripts/run_pipeline.py                # 기존 Python 오케스트레이터
video/jobs/                            # 새 작업별 비공개 산출물 (git 제외)
```

## Validation

유지보수용 Node.js 22 이상과 이미 설치된 FFmpeg/ffprobe/jq로 실행한다.
Node 도구는 배포/검증 전용이며 스킬의 기본 영상 처리 경로에 추가하지 않는다.

```bash
node --test tests/*.test.mjs
node tools/package-plugin.mjs --output /absolute/path/to/new-plugin-bundle
```

`tools/plugin-package.mjs`의 허용 목록 밖 파일을 배포하지 않는다.
필수 리소스를 추가하면 허용 목록과 테스트를 함께 갱신한다. 세 plugin manifest와
SKILL.md metadata.version을 일치시키고, native CLI 설치 확인은 임시 설정 홈과
임시 작업 공간에서만 수행한다.

문서 상대 링크, 스킬 frontmatter, 플러그인 manifest 경로를 확인한다.
실행 레시피를 변경하면 `references/export.md`의 회귀 사례를 작은 로컬 합성
소스와 설치된 CLI로 확인한다. 외부 영상 다운로드/전사/TTS를 자동으로 호출하지 않는다.
도구 설치는 필요한 의존성이 실제로 없을 때만 검토한다.

명시적으로 레거시 Python을 다룰 때만 기존 명령을 사용한다.

```bash
pip install -r requirements.txt
python .github/skills/video-editor/scripts/scene_detector.py --help
python .github/skills/video-editor/scripts/tts_generator.py --help
```

레거시 실행은 실제 존재하는 시나리오 경로를 `--scenario`로 지정한다.
`config/demo_scenario.json`의 존재를 가정하거나 사용자가 옮긴 파일을 복구하지 않는다.
Retina 녹화는 필요할 때 비율을 유지해 축소한다. 언어별 음성과 폰트는 환경에서 확인한다.
