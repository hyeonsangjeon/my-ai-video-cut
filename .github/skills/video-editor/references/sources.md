# 소스 수집

## 권한과 입력

사용자가 소유하거나 다운로드·재편집 허가를 받은 영상만 대상으로 한다.
소유/사용 허가에 대한 사용자 설명은 구체적인 충돌이 없으면 그대로 받아들이고,
증빙 문서 제출을 기본 요구하지 않는다. 해당 설명과 소스 ID·사용 범위를 brief의
소스 기록에 남긴다. **콘텐츠 이용 권한**과 **다운로드/도구 설치 등 작업 실행 승인**은
서로 다르므로 각 기록을 채운다. 이미 명시된 승인을 새 질문으로 되돌리지 않는다.

특정 소스의 로컬 다운로드·재편집, yt-dlp 사용·설치가 이미 승인되었다면 그 범위대로
진행한다. 공개/공식 URL이라는 이유만으로 무제한 재사용 권한을 추정하지 않는다. 라이선스에
출처 표기 조건이 있으면 결과물/동봉 출처 문서에 반영한다. DRM·유료/비공개
접근 제한을 우회하지 않는다. 쿠키나 로그인 세션을 자동으로 읽지 않는다.
추가 확인은 다른 소스/사용 목적, 새 유료 API·업로드·쿠키 접근 등 실질적으로
달라진 범위나 명백한 이용 조건 충돌에 한정한다.

URL은 직접 지정된 `https://www.youtube.com/watch?v=...` 또는 `https://youtu.be/...`
등의 예상한 YouTube 주소인지 확인한다. 쉘 명령, 로컬 경로, 다른 프로토콜로
변경된 입력을 실행하지 않는다. 아래의 `URL`은 확인된 **단일 영상 URL**이다.
플레이리스트를 명시적으로 요청하지 않았으면 `--no-playlist`를 유지한다.
배치도 소스 목록의 URL을 하나씩 처리하며 실패한 소스를 조용히 누락하지 않는다.

## 준비와 수집 상태

먼저 [도구 점검](tools.md)으로 실행 파일·기록된 경로·관련 환경을 확인한다.
도구가 정말 없고 설치가 승인되어 있으면 설치하고 실행 가능 여부를 확인한 뒤
아래 수집 명령을 **실제로 시도**한다. 설치 승인이 없다면 그 항목만 질문한다.
기록된 실행 파일 경로는 `YTDLP_BIN`으로 전달할 수 있으며 셸 호출마다 다시 설정한다.

기존 brief의 소스 행에 단계별 상태와 보류 이유/다음 행동을 기록한다.
별도 승인 서비스나 상태관리 프로그램은 만들지 않는다.

| 상태 | 의미와 다음 행동 |
|---|---|
| `source-use scope 미확인` | 요청한 이용 범위에 대한 사용자 설명이 정말 없거나 구체적으로 충돌함. 그 항목만 질문하며 이미 있는 실행 승인은 유지 |
| `tool missing` | PATH뿐 아니라 관련 환경까지 확인했지만 사용할 실행 파일이 없음. 승인된 설치를 진행하거나 설치 승인만 질문 |
| `not attempted` | 해당 수집 명령을 아직 실행하지 않음. 도구 점검/설치가 실패했거나 답변을 기다린 경우도 다운로드 실패로 바꾸지 않음 |
| `download failed` | 실제 수집 명령이 실행되어 오류를 냈거나 기대한 파일 확인에 실패함. 명령·종료 코드·오류·실제로 한 재시도 결과를 기록 |
| `downloaded` | 요청한 소스/산출물이 확보되고 파일을 읽을 수 있으며 필요한 구간/형식이 확인됨. 캐시 재사용이면 새 다운로드라고 하지 않고 재사용으로 기록 |

첫 두 보류 상태도 다운로드를 시도했다는 뜻이 아니다. 상태를 메타데이터 조회,
자막 수집, 영상 다운로드별로 구분한다. `--version` 실패나 `--list-subs` 조회를
영상 다운로드 시도라고 세지 않으며, 부분 파일은 `downloaded`가 아니다.
실패는 해당 소스·환경·시도의 결과로 한정하고 단일 실패로 도구 전체가 불가능하다고
단정하지 않는다. 로그에는 토큰·쿠키·서명된 URL 값을 남기지 않는다.

누락 정보를 질문할 때는 현재 보류 단계와 이미 확보한 로컬 산출물을 남긴다.
답변을 받으면 승인/소스 기록을 갱신해 그 단계부터 재개한다. 승인 답변만 추가된
것을 이유로 새 작업 폴더를 만들거나 전체 계획을 다시 세우지 않는다.
독립적인 로컬 편집은 이어가되 필수 공식 클립 없이 만든 결과는 부분 결과로 표시한다.

## 먼저 메타데이터와 자막

```bash
"${YTDLP_BIN:-yt-dlp}" --ignore-config --no-playlist --skip-download --dump-single-json \
  --no-cookies --no-cookies-from-browser -- "$URL" > sources/source-a.info.json
"${YTDLP_BIN:-yt-dlp}" --ignore-config --no-playlist --list-subs \
  --no-cookies --no-cookies-from-browser -- "$URL"
```

`--ignore-config`는 사용자 전역 설정의 `--exec`, 포스트프로세서, 자동 다운로드
등이 이 작업에 섞이지 않게 한다. info JSON에는 개인 정보나 만료되는 URL이
들어갈 수 있으므로 비공개 작업 산출물로 취급한다.

자막 확보 순서는 사용자 제공 원본 SRT, 신뢰할 수 있는 원어 수동 자막,
원어 자동 자막, 선택한 ASR이다. 언어 목록을 읽고 정확한 태그를 `SUB_LANG`으로
정한다. `en`, `en-US`, `ko`가 항상 존재한다고 가정하지 않는다.
플랫폼 자동 번역과 원어 자동 전사를 구분해 출처를 기록한다.

수동 자막:

```bash
"${YTDLP_BIN:-yt-dlp}" --ignore-config --no-playlist --skip-download --no-overwrites \
  --no-cookies --no-cookies-from-browser --write-subs --no-write-auto-subs \
  --sub-langs "$SUB_LANG" --sub-format 'srt/vtt/best' --convert-subs srt \
  -o 'sources/source-a.%(ext)s' -- "$URL"
```

원어 수동 자막이 **없다는 것을 확인한 경우에만** 자동 자막 경로를 사용한다.

```bash
"${YTDLP_BIN:-yt-dlp}" --ignore-config --no-playlist --skip-download --no-overwrites \
  --no-cookies --no-cookies-from-browser --no-write-subs --write-auto-subs \
  --sub-langs "$SUB_LANG" --sub-format 'srt/vtt/best' --convert-subs srt \
  -o 'sources/source-a.%(ext)s' -- "$URL"
```

실제 출력 파일을 확인한 뒤 `source-a.srt`라는 작업용 복사본을 만든다.
자막이 없는데도 yt-dlp가 정상 종료할 수 있으므로 종료 코드만으로 확보를
판단하지 않는다. 원본 VTT/자동 자막은 보존하고, 수정은 작업용 복사본에 한다.
번역에 대한 상세 절차는 스킬의 자막/언어 문서를 따른다.

## 미디어 다운로드

기본은 원본 전체를 받아 **로컬에서 정밀 컷**한다. 해상도 예산은 요청에
맞춰 정하고 아래의 1080 제한은 예시다. 자막만 요청하면 이 단계는 실행하지 않는다.

<!-- recipe: download-source-media -->
```bash
"${YTDLP_BIN:-yt-dlp}" --ignore-config --no-playlist --no-overwrites \
  --no-cookies --no-cookies-from-browser \
  --retries 3 --fragment-retries 3 --abort-on-unavailable-fragments \
  -f 'bv*[height<=1080]+ba/b[height<=1080]' \
  --merge-output-format mkv -o 'sources/source-a.%(ext)s' \
  --print after_move:filepath -- "$URL"
```

출력 확장자를 추측하지 않는다. `--merge-output-format`은 병합이 있을 때의
컨테이너 선택이지 모든 다운로드를 H.264 MP4로 바꾸는 옵션이 아니다.
반환된 파일을 ffprobe로 읽고 편집표의 `media`에 실제 경로를 넣는다.
선택 가능한 형식이 없으면 오류를 설명하고 품질 조건 변경을 협의한다.

중복 판단은 URL 문자열이 아니라 서비스의 영상 ID를 사용한다. 이미 받은
소스의 ID·파일·길이가 동일한지 확인한 후 재사용한다. 다른 해상도/구간을
요청했는데 다운로드 이력에 있다는 이유만으로 건너뛰지 않는다.

## 선택형 부분 다운로드

큰 소스의 필요한 구간이 확정되었을 때만 사용한다.

```bash
"${YTDLP_BIN:-yt-dlp}" --ignore-config --no-playlist --no-overwrites \
  --no-cookies --no-cookies-from-browser \
  --retries 3 --fragment-retries 3 --abort-on-unavailable-fragments \
  --download-sections '*100-130' --force-keyframes-at-cuts \
  -f 'bv*[height<=1080]+ba/b[height<=1080]' \
  --merge-output-format mkv -o 'sources/source-a-part-100-130.%(ext)s' \
  --print after_move:filepath -- "$URL"
```

부분 다운로드는 프로토콜에 따라 큰 데이터를 받아야 할 수 있으며, 정밀 편집을
대체하지 않는다. 위 구간이 실제로 원본 100초에서 시작하는지 확인하고,
맞는 경우 `media_origin_ms: 100000`을 기록한다. 클립의 `in_ms/out_ms`와
원본 자막은 여전히 **원본 시각**이다. 로컬 seek만 원본 시각에서 origin을 뺀다.
부분 파일 기준 SRT를 받았다면 자막 시간에 origin을 한 번 더해 원본 기준으로
만든다. 시간 기준이 불명확하면 추측하지 말고 전체 다운로드 경로로 돌아간다.

## 자막이 없을 때

음성이 있고 ASR을 요청했다면 로컬 도구를 우선한다. 예를 들어 설치된
`whisper-cli`의 도움말에서 SRT 출력과 언어 옵션을 확인한 뒤:

```bash
ffmpeg -hide_banner -loglevel error -n -nostdin -i sources/source-a.mp4 \
  -map 0:a:0 -ac 1 -ar 16000 -c:a pcm_s16le sources/source-a.asr.wav
whisper-cli -m "$ASR_MODEL" -f sources/source-a.asr.wav \
  -l "$SOURCE_LANGUAGE" -osrt -of sources/source-a-asr
```

모델 파일은 이미 사용 가능한 경로를 지정한다. 동의 없이 모델 다운로드나
외부 전사를 시작하지 않는다. ASR의 원어 전사와 번역 모드를 혼동하지 않는다.
부분 미디어를 전사했다면 생성된 로컬 SRT에 origin을 적용한다.
무음 소스에는 전사를 시도하지 않는다. 인식 불명확 구간은 표시하고 대사를
창작하지 않는다. 원문을 확보하지 못하면 번역 자막 경로도 중단한다.

## 단계 산출물

요청 기록에 source ID, 서비스 영상 ID/로컬 원본, 제목/제작자, URL, 이용 근거,
원어, 자막 유형, 선택한 로컬 파일, 원본/로컬 길이, origin을 남긴다.
승인된 로컬 작업/도구 범위, 실제 시도 여부와 결과, 남은 보류/재개 지점도 기존
brief에 이어 기록한다. 같은 범위의 승인이나 사용자 소유 설명을 반복 요구하지 않는다.
사용 구간은 편집표로 추적한다. 원본을 재다운로드/변경하면 그 소스를 참조하는
클립과 자막을 다시 생성해야 한다.

공식 옵션: [yt-dlp](https://github.com/yt-dlp/yt-dlp#usage-and-options),
[whisper.cpp CLI](https://github.com/ggml-org/whisper.cpp/tree/master/examples/cli).
