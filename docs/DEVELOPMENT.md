# 플러그인 개발과 배포 준비

## 경계

사용자가 설치하는 패키지는 하나의 Markdown 스킬과 정적 참고 자료다.
영상 처리는 FFmpeg/ffprobe/jq, 선택형 수집·음성 처리는 해당 CLI가 담당한다.
`tools/`와 `tests/`의 Node.js 코드는 **유지보수 전용**이며 번들에 포함하지 않는다.
실행 절차는 스킬과 참고 문서에서만 관리하며 중복 구현이나 별도 진입점을 두지 않는다.

## 로컬 명령

Node.js 22 이상, FFmpeg/ffprobe, jq 1.6 이상이 필요하다.
번인 테스트에는 libass 포함 FFmpeg와 영문을 표시할 기본 폰트가 필요하다.
누락된 도구만 환경에 맞게 설치한다. npm 의존성과 Python 가상환경은 필요 없다.

```bash
node --test tests/*.test.mjs
node tools/package-plugin.mjs --output dist/video-editor
```

`tests/native-plugins.test.mjs`는 기본 실행에서 명시적으로 건너뛴다.
세 호스트 CLI가 설치되어 있을 때 아래 opt-in 명령으로 로컬 설치·버전 갱신·
카탈로그 경로 변경까지 확인할 수 있다. npm/호스트 CLI를 자동 설치하지 않는다.

```bash
VIDEO_EDITOR_NATIVE_TESTS=1 node --test tests/*.test.mjs
```

native 테스트는 임시 `COPILOT_HOME`, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`와 임시
작업 공간만 사용한다. 실제 사용자 전역 설정이나 프로젝트는 변경하지 않는다.
README의 한 줄 명령을 그대로 읽되 원격 저장소 주소만 검증용 로컬 번들로 바꿔 실행한다.
호스트 모델을 호출하지 않지만, 호스트 CLI 자체의 환경/정책 요구 사항은 적용된다.

`--output`은 아직 존재하지 않는 디렉터리여야 한다. 실패한 부분 번들을 설치하지
말고 원인을 해결한 뒤 새 출력 디렉터리를 사용한다.
생성기는 버전, 파일 목록, SHA256 해시를 JSON으로 출력한다.

## 패키지 계약

[허용 목록](../tools/plugin-package.mjs)은 기본 17개 파일을 포함한다.
존재하는 루트 `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `NOTICE`는 추가로 보존한다.
미디어·임의 메모·캐시·실행 코드·VS Code 도구 목록은 포함하지 않는다.
필수 리소스를 추가하면 허용 목록도 명시적으로 갱신해야 한다.

세 호스트의 manifest와 marketplace는 같은 `.github/skills/video-editor/`를
가리킨다. 버전은 세 `plugin.json`과 `SKILL.md`의 `metadata.version`을 함께 바꾼다.
스킬 이름, Codex 기본 프롬프트, 번들 안의 모든 Markdown 상대 링크도 일치해야 한다.

검사기는 이 패키지의 필수 필드/문자열 표기/경로 계약을 검사한다.
임의 YAML을 처리하는 범용 파서나 세 클라이언트의 전체 schema validator를
대체하지는 않는다. 호스트별 native 확인도 설치 문서대로 별도로 수행한다.

## 오프라인 회귀 범위

미디어 테스트는 문서의 `<!-- recipe: ... -->` 코드 블록을 직접 실행한다.
따라서 문서와 별도의 테스트용 편집 구현이 서로 달라지는 것을 피한다.
입력은 작은 합성 영상·음성·SRT뿐이고 임시 작업 폴더는 종료 시 정리한다.

| 범위 | 확인 내용 |
|---|---|
| 패키지 | 3개 manifest/2개 marketplace, 버전 일치, 필수 파일, 상대 링크, Codex UI |
| 파일 경계 | 기존 출력 거부, 원본 경로의 상위/하위 심볼릭 링크 거부, 허용 목록 외 파일 제외 |
| 현재 구조 | 제거된 실행 경로 재유입 방지, README에 호스트별 한 줄 명령 유지 |
| 타임라인 | 구간/ID/배속/FPS 검증, 원본↔부분 다운로드 시간, 프레임 기반 누적 |
| 자막 | BOM/CRLF/Unicode/여러 줄, SRT-only, 컷 교집합, 반복·재배치, 번역 ID 누락 |
| 영상 | 서로 다른 FPS·화면 비율·무음 소스, SAR 정규화, 분수 FPS 반복 연결 |
| 음성/출력 | 클립별 패딩, 초과 길이 거부, 새 나레이션 시각, 교체/혼합의 실제 주파수, 번인 픽셀, 내장 자막 |

[소스 수집 행동 사례](../tests/fixtures/source-acquisition-scenarios.json)는 승인 재사용,
도구 부재와 설치 승인, 필요한 단일 질문, 뒤늦은 승인 후 재개, 실제 실패와 미시도,
승인 밖 행동을 다룬다. 지침을 각 사례에 적용해 상태·다음 행동·질문·완료 범위가
맞는지 검토하며, 키워드 존재만으로 정책 준수를 판정하지 않는다.
소스 수집 테스트는 문서의 실제 CLI 레시피를 모의 실행 파일/패키지 관리자로
실행해 호출·종료 코드·재시도·로컬 파일 보존을 확인한다. 실제 다운로드나 설치는 하지 않는다.

YouTube/ASR/TTS의 외부 서비스 가용성, 번역의 의미적 품질, 모든 플랫폼의
폰트/코덱 조합, 호스트 모델이 실제 요청을 해석하는 품질까지 자동 검증한 것은 아니다.
실사용 인수 확인은 권한 있는 작은 영상으로 수행하고 외부 전송은 별도 승인받는다.

## CI

[Validate video plugin](../.github/workflows/validate-plugin.yml)은 PR/push에서
Node 내장 테스트와 번들 생성을 실행한다. GitHub 권한은 `contents: read`만
사용하며 릴리스·PR 댓글·사용자 전역 플러그인 설치를 자동 수행하지 않는다.
Linux 배포판의 FFmpeg에서도 동작하도록 `reset_sar` 같은 신규 옵션 대신
표준 `scale`/`setsar`로 픽셀 비율을 정규화한다.

## 유사 저장소와의 비교

아래 비교는 명시한 커밋의 공개 파일을 읽은 결과다. 저장소의 설치기·스크립트나
원격 지침을 실행하지 않았다.

| 비교 대상 | 확인한 패턴 | 이 저장소의 적용/차이 |
|---|---|---|
| [github/awesome-copilot](https://github.com/github/awesome-copilot/blob/7b1ebe6333397841ca918dec904d24d4695fe953/.github/workflows/check-plugin-structure.yml) | 게시할 때 실제 파일을 materialize하고 심볼릭 링크를 금지. 별도 [manifest 검증 CI](https://github.com/github/awesome-copilot/blob/7b1ebe6333397841ca918dec904d24d4695fe953/.github/workflows/validate-plugins.yml) 운영 | 정적 허용 목록 번들·회귀 테스트·CI를 도입. 그 저장소 전용 Open Plugin Spec 확장 namespace를 일반 Copilot 필수 규격으로 오인해 복사하지 않음 |
| [anthropics/skills](https://github.com/anthropics/skills/blob/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/.claude-plugin/marketplace.json) | marketplace가 실제 skill 디렉터리를 묶어 배포 | Claude/Copilot 공유 카탈로그와 호스트별 manifest를 유지. 스킬 내용은 복제하지 않음 |
| [openai/skills](https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/references/openai_yaml.md) | UI용 `agents/openai.yaml`, 25~64자 짧은 설명, `$skill-name` 기본 프롬프트 | 해당 UI 계약을 패키지 테스트에 포함. 이 메타데이터만으로 플러그인 설치가 완료된다고 주장하지 않음 |
| [remotion-dev/skills](https://github.com/remotion-dev/skills/blob/f54682712abc4a68cdc7c41513bd3b3298829873/skills/remotion-captions/SKILL.md) | 자막을 startMs/endMs 포함 JSON으로 다루고 작업별 참고 문서를 분리 | cue JSON과 단일 타임라인 접근 유지. Remotion/React 렌더러를 추가하지 않고 원본 영상 컷·취합용 FFmpeg 경로에 집중 |

표준 형식은 [Agent Skills specification](https://agentskills.io/specification)을
따른다. 현재 비교에서 핵심 격차는 편집 알고리즘의 교체가 아니라
**재현 가능한 배포·회귀 검증과 호스트별 설치 절차의 유지보수**였다.

## 배포 전 확인

세 클라이언트의 실제 확인은 원래 사용자 설정을 바꾸지 않는 임시 환경에서 했다.
Copilot/Claude는 로컬 marketplace 설치, Codex는 로컬 카탈로그 등록·설치를
수행했다. 호스트 모델 호출이나 실제 사용자 전역 설치는 포함하지 않았다.
Copilot/Codex는 같은 카탈로그를 다른 경로로 단순 `add`하면 실제로 실패하므로,
설치 안내에 대상 플러그인 해제 → 기존 카탈로그 제거 → 새 경로 등록 순서를 명시했다.
Copilot의 비대화형 목록은 live/`--plugin-dir` 스킬을 누락할 수 있으므로
실제 대화 세션의 `/skills list`와 구분한다.

이 저장소는 [MIT License](../LICENSE)를 적용한다. MIT는 수신자의 재사용·재배포
권한을 정하며 저장소 접근 권한을 바꾸지 않는다.
외부 도구와 사용자 입력 미디어에는 각자의 라이선스/권리가 적용된다.

배포는 검증된 커밋의 허용 파일과 LICENSE만 ZIP으로 묶어 GitHub Release에
올린다. ZIP의 SHA256과 CI 성공 커밋을 함께 기록한다. 소스 전체 자동 압축 파일은
최소 플러그인 번들과 다르므로 설치 안내는 별도 ZIP 자산을 우선한다.
공개 마켓플레이스 제출이나 저장소 공개 범위 변경은 배포 절차에 포함하지 않는다.
