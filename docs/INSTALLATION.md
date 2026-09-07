# Video Editor 설치

동일한 스킬을 Codex CLI, GitHub Copilot CLI, Claude Code에서 사용한다.
플러그인 이름은 `video-editor`, marketplace 이름은 `my-ai-video-cut`이다.
스킬 본문은 [.github/skills/video-editor/SKILL.md](../.github/skills/video-editor/SKILL.md)
한 곳에만 있다. 복제본이나 심볼릭 링크를 만들 필요가 없다.
최초 사용자 전역 설치는 [README의 한 줄 명령](../README.md#플러그인-한-줄-설치)을
사용한다. 아래에서는 로컬 번들, 프로젝트 범위, 업데이트/제거 절차를 설명한다.

## 패키지 구조와 지원 범위

| 호스트 | 등록 파일 | 스킬 경로 |
|---|---|---|
| GitHub Copilot CLI | [`plugin.json`](../plugin.json) | `./.github/skills/` |
| Claude Code | [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) | `./.github/skills/` |
| Codex CLI | [`.codex-plugin/plugin.json`](../.codex-plugin/plugin.json) | `./.github/skills/` |

`skills`는 `SKILL.md` 자체가 아니라 **스킬 폴더들을 담은 디렉터리**다.
모든 manifest 경로는 manifest 파일의 위치가 아닌 **플러그인 루트** 기준이다.
Copilot과 Claude가 공유하는 [marketplace](../.claude-plugin/marketplace.json)와
Codex의 [marketplace](../.agents/plugins/marketplace.json)는 `./`로 이 저장소
루트의 플러그인을 가리킨다. Codex의 `source.path` 역시
`.agents/plugins/`가 아닌 marketplace 루트 기준이다.

등록하는 구성 요소는 스킬 하나뿐이다. hooks, MCP 서버, 자동 실행 서비스,
의존성 설치 명령은 포함하지 않는다. 저장소의 `.github/agents/` 안내문은
플러그인 에이전트로 등록하지 않는다. 미디어 실행 절차는 Markdown의 CLI 레시피로
구성되며, 유지보수 도구와 사용자 데이터는 실행 패키지 밖에 둔다.

**저장소 탐색과 플러그인 설치는 다르다.**

- Copilot은 지원 버전에서 이 저장소의 `.github/skills/video-editor/`를
  프로젝트 스킬로 발견한다. 이 저장소 안에서만 쓴다면 별도 설치가 필요 없다.
- Codex의 독립 스킬 탐색 경로는 `.agents/skills/`, Claude Code의 경로는
  `.claude/skills/`다. 이 저장소를 clone했다는 이유만으로 두 호스트가
  `.github/skills/`를 독립 스킬로 발견한다고 가정하지 않는다.
- Codex의 repo marketplace가 목록에 보이는 것과 그 플러그인이 설치된 것은
  다르다. 아래 등록·설치를 마쳐야 다른 작업 공간에서도 사용할 수 있다.
- 아래 명령은 **CLI 기준**이다. GitHub Copilot을 뜻하는 `ghcp`라는 표현을
  쓰더라도 실행 파일은 `copilot`이다. `gh copilot` 명령이 아니다.
  Copilot IDE의 프로젝트 스킬 지원과 CLI 플러그인 설치는 별개다.
  Codex IDE 확장은 현재 플러그인을 지원하지 않으므로 Codex CLI를 사용한다.

## 공통 준비

아래는 Bash 기준이다. 이미 받은 **이 변경 사항이 포함된 로컬 checkout**과
실제 편집할 작업 공간을 지정한다. 경로에 공백이 있어도 따옴표를 유지한다.

```bash
SOURCE_ROOT="/absolute/path/to/my-ai-video-cut"
PLUGIN_ROOT="$SOURCE_ROOT"
WORKSPACE="/absolute/path/to/editing-workspace"
test -f "$PLUGIN_ROOT/.github/skills/video-editor/SKILL.md"
test -d "$WORKSPACE"
```

새 터미널에서는 변수를 다시 설정한다. 스킬은 `$PLUGIN_ROOT`에서 읽지만,
미디어와 출력은 `$WORKSPACE/video/jobs/<job-id>/` 또는 사용자가 지정한
작업 디렉터리에 둔다. **설치된 스킬/캐시 디렉터리에 결과를 쓰지 않는다.**

호스트 CLI는 별도로 설치·인증되어 있어야 한다. 아래 도움말에 필요한
하위 명령이 없으면 해당 CLI의 공식 업데이트 절차를 따른다.
이 저장소는 호스트 CLI를 자동 설치하거나 홈 설정을 변경하지 않는다.
사용자가 아래 `install`, `add`, `remove` 명령을 실행할 때만 설치 상태가 바뀐다.

```bash
codex --version
codex plugin --help
copilot --version
copilot plugin --help
claude --version
claude plugin --help
```

미디어 작업에는 Bash, `ffmpeg`, `ffprobe`, `jq` 1.6 이상이 필요하다.
YouTube 입력에만 `yt-dlp`, 나레이션 생성에만 선택한 TTS 도구가 필요하다.
번인 자막에는 libass와 출력 언어 폰트도 필요하다. 자세한 기능별 확인은
[도구와 실행 환경](../.github/skills/video-editor/references/tools.md)을 따른다.
플러그인 설치가 미디어 다운로드·업로드, 쿠키 접근, 유료 서비스 사용,
도구 설치를 승인하는 것은 아니다. 셸/파일 접근이 없는 호스트는 계획만
작성할 수 있으며 로컬 영상 렌더링까지 할 수 있다고 보장하지 않는다.

> 로컬 설치는 플러그인 루트 전체를 캐시에 복사할 수 있다.
> `.gitignore`가 설치 도구의 복사를 막는다고 가정하지 않는다.
> 대용량 영상·비공개 자료·자격증명이 없는 코드 전용 checkout에서 설치하고,
> 미디어는 별도 작업 공간에 둔다. 개발 중에는 지원되는 `--plugin-dir` 방식을
> 우선 사용한다. 호스트가 만드는 설치 캐시는 스킬 원본의 별도 관리본이 아니다.

## 미디어가 있는 checkout에서 안전하게 설치하기

`input/`, `output/`, `video/`, `__pycache__/` 등이 있는 checkout을 그대로
설치하지 않는다. [번들 생성기](../tools/package-plugin.mjs)는 **명시적으로 허용된
17개 파일**과 존재하는 루트 라이선스/NOTICE만 새 디렉터리에 복사한다.
미디어, 임의로 추가된 참고 메모, VS Code 어댑터와 개발 도구는
포함하지 않는다. 필수 파일 누락, 버전 불일치, 번들 밖 참조, 원본 경로의
심볼릭 링크와 기존 출력 디렉터리를 거부한다.

번들 생성기는 유지보수용 Node.js 22 이상을 사용하며 npm 패키지나 Python은
필요 없다. **설치된 영상 스킬은 이 생성기나 Node.js에 의존하지 않는다.**
Node.js가 없는 사용자는 이미 생성된 번들 또는 미디어 없는 코드 전용 clone을
각 호스트에 등록할 수 있다.

공통 준비의 변수를 설정한 뒤 실행한다. 번들 이름은 아직 존재하지 않는 이름을
선택한다. 원본 checkout은 `SOURCE_ROOT`에 유지하고, 성공한 경우에만
이후 설치에 사용할 `PLUGIN_ROOT`를 번들로 바꾼다.

```bash
set -euo pipefail
VERSION=$(jq -r '.version' "$SOURCE_ROOT/plugin.json")
BUNDLE_ROOT="$WORKSPACE/video-editor-plugin-$VERSION"
node "$SOURCE_ROOT/tools/package-plugin.mjs" \
  --source "$SOURCE_ROOT" --output "$BUNDLE_ROOT"
PLUGIN_ROOT="$BUNDLE_ROOT"
```

번들 안의 `.github/skills/video-editor/` 경로를 유지하므로 manifest를 고칠
필요가 없다. `tools/`, `tests/`, `.github/agents/`, 프로젝트 지침, `.git/`, 미디어,
캐시는 복사하지 않는다. 세 호스트 모두 아래 설치 명령을 그대로 실행하면
`PLUGIN_ROOT`가 가리키는 이 번들을 사용한다. **작업은 계속 `WORKSPACE`에서
시작하며 번들 안에 미디어나 결과를 만들지 않는다.**

이 절차는 설치가 아니라 파일 준비만 한다. 복사가 실패하면 부분 번들을
설치하지 않는다. 수정본을 배포할 때는 원본 `SOURCE_ROOT`에서 새 이름의 번들을
만들고, 해당 호스트의 캐시 갱신 절차도 수행한다. 기존 번들을 덮어쓰지 않는다.
번들 경로가 바뀌면 [경로 변경 절차](#번들-경로가-바뀐-경우)를 따른다.
Copilot/Codex는 같은 이름을 다른 경로로 단순 `add`하면 거부한다.
옛 경로에 대한 `update`나 재설치만으로는 새 번들이 반영되지 않는다.
변경 사항을 게시한 뒤라면 미디어나 생성 파일이 없는 새 clone을 사용하는 것도
가능하다. 원격 설치 시점의 조건은 [GitHub에서 설치](#github에서-설치--변경-사항을-게시한-뒤에만)를 참고한다.

## GitHub Copilot CLI

### 이 저장소 안에서 사용

```bash
cd "$SOURCE_ROOT"
copilot
```

Copilot 대화창에서 `/skills list`로 `video-editor`를 확인하고 다음처럼 요청한다.

```text
video-editor 스킬로 이용 권한이 있는 로컬 영상 두 개를 편집해 줘.
원음을 유지하고 한국어·영어 SRT를 따로 만들어 줘.
```

### 다른 작업 공간에서 로컬 플러그인 로드

설치 상태를 남기지 않는 세션 전용 로드:

```bash
cd "$WORKSPACE"
copilot --plugin-dir "$PLUGIN_ROOT"
```

대화창에서 `/skills list`를 확인한다. `--plugin-dir` 지원 여부는
`copilot --help`로 확인한다.

지속적으로 사용할 때는 **marketplace 방식**을 우선한다. Copilot은 이 저장소의
`.claude-plugin/marketplace.json`도 읽을 수 있어 별도 카탈로그 복제가 필요 없다.

```bash
copilot plugin marketplace add "$PLUGIN_ROOT"
copilot plugin install video-editor@my-ai-video-cut
copilot plugin list
cd "$WORKSPACE"
copilot
```

로컬 directory-source marketplace는 현재 CLI에서 소스 경로를 live로 읽을 수 있다.
수정 후 새 세션을 열고, 등록한 번들 디렉터리를 삭제하거나 이동하지 않는다.
Git marketplace의 배포본은 marketplace와 plugin을 함께 갱신한다.

```bash
copilot plugin marketplace update my-ai-video-cut
copilot plugin update video-editor@my-ai-video-cut
```

직접 설치인 `copilot plugin install "$PLUGIN_ROOT"` 또는 `owner/repo` 방식은
현재 작동하지만 CLI가 deprecated 경고를 내므로 장기 배포의 기본 경로로 쓰지 않는다.
기존 직접 설치본은 같은 명령으로 캐시를 갱신할 수 있다.
제거는 설치된 이름에 맞춰 `copilot plugin uninstall video-editor@my-ai-video-cut`
(marketplace) 또는 `copilot plugin uninstall video-editor`(직접 설치)를 사용한다.

`plugin list`에 패키지가 보이는 것과 스킬이 현재 세션에 로드된 것은 다르다.
특히 현재 CLI의 비대화형 `skill list` / `plugins list --kind skill`은
`--plugin-dir` 또는 live marketplace의 스킬을 누락할 수 있다.
이 경우 새 대화 세션의 `/skills list`로 확인한다. 빈 목록만 보고
manifest를 임의로 바꾸거나 중복 설치하지 않는다.

프로젝트 스킬로 이미 발견되는 저장소에서는 플러그인까지 중복 로드하지 않는
방식을 우선한다. 목록의 출처를 확인하고 사용할 한 등록 경로만 유지한다.

## Claude Code

### 세션 전용 로드 — 개발 시 권장

```bash
claude plugin validate "$PLUGIN_ROOT/.claude-plugin/plugin.json"
claude plugin validate "$PLUGIN_ROOT/.claude-plugin/marketplace.json"
cd "$WORKSPACE"
claude --plugin-dir "$PLUGIN_ROOT"
```

Claude Code 대화창에서 실행한다:

```text
/video-editor:video-editor 이용 권한이 있는 로컬 영상 두 개를 편집하고 한국어·영어 SRT를 만들어 줘.
```

플러그인 스킬 이름은 `/플러그인명:스킬명`이다.
여기서는 `/video-editor:video-editor`이며 독립 스킬의 `/video-editor`와 다르다.
내용 수정 후에는 `/reload-plugins`를 실행하거나 새 세션을 연다.

### 현재 작업 공간에 지속 설치

아래 `local` scope는 작업 공간의 `.claude/settings.local.json`에 설치 선언을
저장한다. README의 한 줄 명령은 `--scope user`로 모든 프로젝트에 적용한다.
프로젝트에 한정하려면 아래 `local` 명령을 선택한다. scope와 무관하게 플러그인
파일은 Claude의 사용자 캐시에 저장될 수 있다.

```bash
cd "$WORKSPACE"
claude plugin marketplace add "$PLUGIN_ROOT" --scope local
claude plugin install video-editor@my-ai-video-cut --scope local
claude plugin list
claude
```

설치 후 새 세션을 열거나 설치 안내에 따라 `/reload-plugins`를 실행한다.
이미 marketplace로 설치했다면 같은 세션에서 `--plugin-dir`로도 로드하지 않는다.
배포 업데이트는 marketplace와 설치본을 모두 갱신한다.
설치 때 선택한 scope를 갱신·제거에도 동일하게 사용한다:

```bash
cd "$WORKSPACE"
claude plugin marketplace update my-ai-video-cut
claude plugin update video-editor@my-ai-video-cut --scope local
```

버전이 같은 개발 중 변경은 캐시가 유지될 수 있으므로 `--plugin-dir`로 확인한다.
현재 작업 공간의 설치를 제거하려면 그 공간에서
`claude plugin uninstall video-editor@my-ai-video-cut --scope local`을 실행한다.

## Codex CLI

Codex는 `.codex-plugin/plugin.json`과 `.agents/plugins/marketplace.json`으로
플러그인을 지원한다. 이 저장소는 CLI의 로컬 marketplace 설치 경로를 제공하며
`.agents/skills/` 복제본이나 홈 설정 수동 편집을 요구하지 않는다.

```bash
codex plugin marketplace add "$PLUGIN_ROOT"
codex plugin list --marketplace my-ai-video-cut --available --json
codex plugin add video-editor@my-ai-video-cut
codex plugin list --marketplace my-ai-video-cut --json
codex -C "$WORKSPACE"
```

`marketplace add`는 소스를 등록하고, `plugin add`는 플러그인을 설치한다.
이 두 명령은 Codex의 사용자 설정/캐시에 지속된다. 현재 CLI의 설치 명령은
`codex plugin add`이며 `codex plugin install`이 아니다.
설치 전에는 목록의 `available`, 설치 후에는 `installed`를 확인한다.
새 세션을 연 다음 `/skills` 또는 `$` 선택기에서 `video-editor`를 선택한다.

```text
$video-editor 이용 권한이 있는 두 영상을 합치고 한국어·영어 SRT를 만들어 줘.
```

위 문장은 **Codex 입력창**에 넣는다. 셸에서 `$video-editor`를 실행하는 것이
아니다. `/plugins`는 설치/관리 화면이고 `/skills`는 스킬 선택 화면이다.
Claude의 `/video-editor:video-editor`를 Codex 명령으로 사용하지 않는다.
다른 출처의 같은 이름이 있으면 선택기에 표시된 출처도 확인한다.

`plugin add`가 없는 이전 CLI에서는 `codex plugin --help`를 확인해 업데이트하거나,
등록 후 Codex 대화창의 `/plugins`에서 설치한다. 해당 메뉴도 없다면 플러그인을
지원하는 CLI가 필요하다. 설치했다고 가정하고 진행하지 않는다.

로컬 스킬을 수정해도 이미 설치된 캐시는 자동으로 같아지지 않는다.
개발 중 로컬 설치본을 다시 만들려면 아래처럼 이 플러그인만 제거·재설치하고
새 세션을 연다:

```bash
codex plugin remove video-editor@my-ai-video-cut
codex plugin add video-editor@my-ai-video-cut
```

Git 소스의 배포 업데이트에는 먼저
`codex plugin marketplace upgrade my-ai-video-cut`을 실행한다.
설치 제거는 `codex plugin remove video-editor@my-ai-video-cut`,
더 이상 쓰지 않는 marketplace 등록 제거는
`codex plugin marketplace remove my-ai-video-cut`이다.

## 번들 경로가 바뀐 경우

버전별로 새 번들을 만들었다면 `PLUGIN_ROOT`를 새 경로로 설정한다.
이 카탈로그는 `video-editor` 하나만 포함한다. 같은 이름의 카탈로그에 다른
설치물이 있다면 아래 절차를 일괄 실행하지 말고 먼저 등록 상태를 확인한다.
강제 삭제 옵션이나 홈 캐시 전체 삭제는 사용하지 않는다.

Copilot은 기존 항목을 먼저 해제해야 같은 카탈로그 이름을 새 경로로 등록할 수 있다.

```bash
copilot plugin uninstall video-editor@my-ai-video-cut
copilot plugin marketplace remove my-ai-video-cut
copilot plugin marketplace add "$PLUGIN_ROOT"
copilot plugin install video-editor@my-ai-video-cut
```

Codex도 기존 등록을 제거한 후 새 경로를 추가한다.

```bash
codex plugin remove video-editor@my-ai-video-cut
codex plugin marketplace remove my-ai-video-cut
codex plugin marketplace add "$PLUGIN_ROOT"
codex plugin add video-editor@my-ai-video-cut
```

Claude는 같은 scope에서 재등록해 소스 경로를 갱신한 뒤 설치본을 업데이트한다.
실제 내용이 바뀐 배포본은 버전도 올려야 캐시의 같은 버전과 혼동하지 않는다.

```bash
cd "$WORKSPACE"
claude plugin marketplace add "$PLUGIN_ROOT" --scope local
claude plugin update video-editor@my-ai-video-cut --scope local
```

세 호스트 모두 새 세션에서 확인한다. 이 명령들은 설치 상태를 바꾸므로
개발 검증은 임시 설정 홈/작업 공간에서 하고, 실제 사용자 환경에서는 변경
대상과 scope를 확인한 뒤 실행한다.

## GitHub Release 번들

저장소가 private인 경우 읽기 권한이 있는 GitHub 계정으로 인증해야 한다.
MIT 라이선스는 저장소의 공개 범위나 접근 권한을 바꾸지 않는다.
개발 파일이 없는 ZIP 번들을 받는 방법을 우선하며, 다음 명령은 실제 게시된
최신 릴리스 태그를 조회한다. 작업 트리의 버전과 게시된 버전은 다를 수 있다.

```bash
set -euo pipefail
RELEASE_TAG=$(gh release view --repo hyeonsangjeon/my-ai-video-cut --json tagName --jq .tagName)
if [[ ! "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  printf 'Unsupported release tag: %s\n' "$RELEASE_TAG" >&2
  exit 1
fi
VERSION=${RELEASE_TAG#v}
ARCHIVE="video-editor-$VERSION.zip"
test ! -e "$DOWNLOAD_DIR"
mkdir -p "$DOWNLOAD_DIR"
gh release download "$RELEASE_TAG" --repo hyeonsangjeon/my-ai-video-cut \
  --pattern "$ARCHIVE" --pattern 'SHA256SUMS' --dir "$DOWNLOAD_DIR"
cd "$DOWNLOAD_DIR"
shasum -a 256 -c SHA256SUMS
test ! -e "$WORKSPACE/plugins/video-editor-$VERSION"
unzip -n "$ARCHIVE" -d "$WORKSPACE/plugins"
PLUGIN_ROOT="$WORKSPACE/plugins/video-editor-$VERSION"
```

`DOWNLOAD_DIR`과 압축 해제 대상은 기존 파일과 충돌하지 않는 새 경로로 선택한다.
Linux에서는 `sha256sum -c SHA256SUMS`도 사용할 수 있다. 압축을 푼
`PLUGIN_ROOT`를 앞 절의 Copilot/Claude/Codex 로컬 marketplace 명령에 사용한다.
ZIP은 기본 스킬/등록 파일 17개와 MIT LICENSE를 포함하며 Python·개발 도구·미디어는
포함하지 않는다. 릴리스와 배포물을 공개 디렉터리에 자동 제출하지 않는다.

## GitHub에서 설치 — 변경 사항을 게시한 뒤에만

**위 manifest와 스킬 변경이 원격 저장소에 포함된 이후에만** 다음 명령을 사용한다.
private 저장소라면 Git 접근 권한도 있어야 한다. CLI가 권한 오류를 내면
저장소를 public으로 바꾸지 말고 인증/접근 권한을 확인한다.
로컬에서 파일을 작성한 것만으로 GitHub나 공식 플러그인 디렉터리에 게시되지는
않는다. 이 문서는 push, 공개 marketplace 제출, 사용자 환경 설치를 수행하지 않는다.
현재 로컬 변경을 시험할 때는 앞 절의 `$PLUGIN_ROOT`를 사용한다.
아래 저장소 URL 방식은 원격 저장소의 파일을 받는 것이며, 생성기의 최소
17파일 번들과 같은 파일 집합을 보장하지 않는다. 개발 파일도 배포에서
완전히 제외하려면 생성된 번들을 별도 배포 소스로 게시한 뒤 그 소스를 등록한다.
설치된 스킬의 기본 실행 경로가 Python을 요구하지 않는다는 점은 동일하다.

```bash
# GitHub Copilot CLI
copilot plugin marketplace add hyeonsangjeon/my-ai-video-cut
copilot plugin install video-editor@my-ai-video-cut

# Claude Code: 선택한 작업 공간에 설치
cd "$WORKSPACE"
claude plugin marketplace add hyeonsangjeon/my-ai-video-cut --scope local
claude plugin install video-editor@my-ai-video-cut --scope local

# Codex CLI
codex plugin marketplace add hyeonsangjeon/my-ai-video-cut
codex plugin add video-editor@my-ai-video-cut
```

세 호스트 모두 새 세션에서 설치된 스킬을 확인한다. 같은 이름의 로컬
marketplace를 이미 등록했다면 로컬/Git 중 사용할 한 소스를 선택해 정리한 후
전환한다. marketplace 이름을 바꿔 중복 설치하지 않는다.
릴리스 때는 세 `plugin.json`과 `SKILL.md`의 `metadata.version`을 함께 올린다.
세 manifest와 스킬의 라이선스 표기는 MIT이며, 번들에 원문 LICENSE를 포함한다.

## 확인과 문제 해결

- **스킬이 보이지 않음:** CLI 버전, 신뢰한 작업 공간, 설치 상태, 실제 스킬 경로를
  확인하고 세션을 재시작한다. 조직 정책이 플러그인을 차단하면 우회하지 않는다.
- **이전 내용이 보임:** 원본이 아니라 캐시를 읽는지 확인한다. 위 호스트별 갱신
  절차를 따른다. 홈의 전체 캐시/설정을 삭제하지 않는다.
- **스킬이 두 번 보임:** 프로젝트 탐색, 독립 스킬 설치, 플러그인 설치,
  `--plugin-dir`를 혼용했는지 확인한다. 다른 출처의 사용자 파일을 덮어쓰지 않는다.
- **스킬은 보이지만 렌더링 불가:** 플러그인 등록 성공과 미디어 CLI 설치·권한은
  별개다. 설치 디렉터리에서 렌더링하거나 임의 Python 스크립트를 만들어
  실패를 숨기지 않는다.

최소 기능 확인은 권한 있는 짧은 로컬 영상으로 계획만 먼저 요청한다:

```text
video-editor를 사용해 로컬 영상의 컷 편집 계획만 작성해 줘.
다운로드·렌더링·외부 전송·도구 설치는 하지 마.
사용할 스킬 경로, 필요한 CLI와 결과를 저장할 작업 디렉터리를 먼저 알려 줘.
```

이후 파일 생성을 승인했다면 [완료 조건](../.github/skills/video-editor/references/export.md)으로
영상과 언어별 SRT를 확인한다. manifest 검증만 통과한 상태를 미디어 처리의
종단 간 검증 완료로 보고하지 않는다.

## 공식 규격과 명령 근거

- [Agent Skills 규격](https://agentskills.io/specification)
- [Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [Copilot 로컬 설치·캐시 갱신](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating)
- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
- [Codex plugin 패키징·marketplace 규격](https://developers.openai.com/plugins/build/plugins)
- [Codex 플러그인 지원 환경과 `/plugins`](https://learn.chatgpt.com/docs/plugins)
- [Codex 스킬 탐색과 `agents/openai.yaml`](https://learn.chatgpt.com/docs/build-skills)

명령 표면은 설치된 `codex-cli 0.147.0`, `GitHub Copilot CLI 1.0.83-5`,
`Claude Code 2.1.141`의 `--help`와 위 공식 문서로 확인했다.
더 오래된 버전까지 같은 명령이 제공된다는 보장은 없다.

반복 가능한 패키지/오프라인 미디어 검증은 [개발 안내](DEVELOPMENT.md)를 따른다.
명령 확인 시에는 원래 사용자 설정 대신 임시 `COPILOT_HOME`, `CODEX_HOME`,
`CLAUDE_CONFIG_DIR`와 임시 작업 공간을 사용했다. 세 호스트에서 로컬 설치/카탈로그
등록을 확인했지만, 실제 사용자 설정 변경이나 호스트 모델 호출은 하지 않았다.
플러그인 설치 성공과 영상 편집 품질은 별도로 확인해야 한다.
