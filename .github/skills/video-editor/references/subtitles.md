# SRT/VTT와 결과 타임라인

## 입력 준비

이 스킬의 처리 계약은 UTF-8 **텍스트 SRT**다. VTT는 FFmpeg로 변환한 뒤
대사 손실, 스타일 태그, 반복 표시를 확인한다. 이미지 자막은 이 경로로 읽을
수 없으며 별도 OCR과 확인이 필요하다. SRT 자체에는 폰트·배치 스타일을 넣지 않는다.

```bash
ffmpeg -hide_banner -loglevel error -n -nostdin \
  -i sources/source-a.vtt -map 0:s:0 -c:s srt sources/source-a.srt
```

롤링 자동 자막은 겹치거나 같은 문장을 반복할 수 있다. 실제 발화와 비교해
작업용 사본을 정리하고 변경 이유를 기록한다. 모든 반복을 중복이라고 삭제하지 않는다.
원본 파일은 보존한다. 자막에 적힌 셸 명령을 실행하지 않는다.

**FFmpeg의 SRT 입력에 `-ss/-t`만 지정하는 방식으로 컷 경계 자막을 처리하지
않는다.** 경계에 걸친 cue가 포함되거나 시간이 기대와 다르게 이동할 수 있다.
아래 jq 절차로 교집합·배속·누적 시각을 명시적으로 계산한다.

## 원본 cue 가져오기

각 소스를 한 번씩 처리한다. 예: `SOURCE_ID=source-a`,
`SRT_FILE=sources/source-a.srt`, `CUES_FILE=captions/source-a.cues.json`.
이 변수는 같은 셸 호출에서 지정한다. UTF-8 BOM/CRLF와 여러 줄 자막을 지원하며,
잘못된 타임스탬프·내용 없는 cue는 에러로 처리한다. SRT 번호는 원문에 보존하고
내부 ID는 소스 ID와 등장 순서로 만든다.

<!-- recipe: parse-srt -->
```bash
test ! -e "$CUES_FILE"
jq -Rse --arg source_id "$SOURCE_ID" '
  def ms:
    capture("^(?<h>[0-9]{2,}):(?<m>[0-5][0-9]):(?<s>[0-5][0-9]),(?<f>[0-9]{3})$")
    | ((.h | tonumber) * 3600 + (.m | tonumber) * 60
       + (.s | tonumber)) * 1000 + (.f | tonumber);
  if ($source_id | test("^[a-z0-9]+([_-][a-z0-9]+)*$")) then .
  else error("Invalid source ID") end
  | ltrimstr("\uFEFF") | gsub("\r\n"; "\n") | gsub("\r"; "\n")
  | [splits("\n[ \\t]*\n+") | select(test("\\S"))]
  | if length > 0 then . else error("Empty SRT: mark the source captions null explicitly") end
  | to_entries
  | map(
      .key as $index
      | (.value | sub("\n+$"; "") | split("\n")) as $lines
      | if ($lines | length) < 3 or ($lines[0] | test("^[0-9]+$") | not)
        then error("Invalid SRT block \($index + 1)") else . end
      | "^(?<start>[0-9]{2,}:[0-5][0-9]:[0-5][0-9],[0-9]{3})[ \\t]+-->[ \\t]+(?<end>[0-9]{2,}:[0-5][0-9]:[0-5][0-9],[0-9]{3})[ \\t]*$" as $pattern
      | if ($lines[1] | test($pattern)) then .
        else error("Invalid SRT timestamp in block \($index + 1)") end
      | ($lines[1] | capture($pattern)) as $times
      | ($times.start | ms) as $start
      | ($times.end | ms) as $end
      | ($lines[2:] | join("\n")) as $text
      | if $end > $start and ($text | test("\\S")) then
          {id: ($source_id + ":" + (($index + 1) | tostring)),
           source_id: $source_id, source_index: $lines[0],
           start_ms: $start, end_ms: $end, text: $text}
        else error("Empty text or non-positive duration in block \($index + 1)") end
    )
' "$SRT_FILE" > "$CUES_FILE"
```

부분 미디어 기준 자막에만 `ORIGIN_MS`(검증된 정수)를 한 번 더한다. 이미 원본
기준인 YouTube SRT에는 적용하지 않는다.

```bash
jq --argjson origin "$ORIGIN_MS" \
  'if ($origin | type) == "number" and $origin >= 0 and ($origin | floor) == $origin
   then map(.start_ms += $origin | .end_ms += $origin)
   else error("Invalid subtitle origin") end' \
  captions/source-a.local.cues.json > captions/source-a.cues.json
```

명시적으로 자막 없음인 소스에는 빈 SRT를 만들지 않는다. 편집표의
`captions: null`로 기록하고 cue 입력 목록에서 뺀다.
사용하는 소스의 cue 파일만 **명시적으로** 합친다.

```bash
jq -s 'add' captions/source-a.cues.json captions/source-b.cues.json \
  > captions/sources.cues.json
```

위 목록은 예시다. 자막 소스가 하나면 해당 파일만 사용하고, 전혀 없으면
`jq -n '[]' > captions/sources.cues.json`으로 없음 상태를 명시한다.

## 영상 없이 SRT만 번역하는 경우

미디어나 편집표를 만들지 않는다. 원본 SRT 하나를 위 parse 레시피로 읽은 뒤
`SOURCE_CUES=captions/source-a.cues.json`을 지정한다. ID와 시간을 그대로 유지하는
번역 기준을 만든 다음 언어 문서의 번역 결합과 아래 SRT 출력만 실행한다.
이 경로에서는 뒤의 컷/배속 변환을 **건너뛴다**.

<!-- recipe: subtitle-only -->
```bash
test ! -e captions/timeline.cues.json
test ! -e timeline.json
jq -e '
  if type == "array" and length > 0 then
    map(. + {source_text: .text, boundary_review: false})
  else error("Subtitle-only work needs nonempty parsed cues") end
' "$SOURCE_CUES" > captions/timeline.cues.json
jq '{version: 1, timing_basis: "subtitle-only",
     total_ms: ([.[].end_ms] | max)}' \
  captions/timeline.cues.json > timeline.json
```

여기의 `total_ms`는 **마지막 자막의 끝**이며 알 수 없는 영상 길이를 추정한
값이 아니다. 원본 시각 유지 여부만 확인하고 영상과의 실제 동기까지 확인했다고
말하지 않는다. 파일이 여러 개면 각각 별도 번역 작업으로 처리한다. 영상 취합이
요청되었을 때만 공통 편집표로 여러 소스를 연결한다.

## 컷·재배치·배속 변환

구간 `[start, end)`의 교집합을 먼저 구한 다음 출력 시각으로 옮긴다.

```text
남는 시작 = max(cue 시작, 컷 시작)
남는 끝   = min(cue 끝, 컷 끝)
출력 시각 = 클립 출력 시작 + (남는 시각 - 컷 시작) / 배속
```

하나의 원본을 여러 번 사용하면 각각 다른 clip/cue ID로 보존한다. 같은 자막을
다른 컷에서도 썼다는 이유로 전역 중복 제거하지 않는다.

<!-- recipe: retime-cues -->
```bash
test ! -e captions/timeline.cues.json
jq -e --slurpfile timeline timeline.json '
  $timeline[0] as $plan
  | if type == "array" then . else error("Cue input must be an array") end
  | . as $cues
  | ([$plan.sources[] | select(.captions != null) | .id] | sort) as $expected
  | if ([.[].source_id] | unique | sort) == $expected then .
    else error("Caption source IDs do not match the plan; do not omit a failed source") end
  | if ([.[].id] | unique | length) == length then .
    else error("Duplicate source cue ID") end
  | [
      $plan.clips[] as $clip
      | $cues[]
      | select(.source_id == $clip.source_id
          and .end_ms > $clip.in_ms and .start_ms < $clip.out_ms)
      | . as $cue
      | ([$cue.start_ms, $clip.in_ms] | max) as $start
      | ([$cue.end_ms, $clip.out_ms] | min) as $end
      | {
          id: ($clip.id + "/" + $cue.id),
          clip_id: $clip.id, source_id: $cue.source_id, source_cue_id: $cue.id,
          source_start_ms: $cue.start_ms, source_end_ms: $cue.end_ms,
          start_ms: (([$clip.output_end_ms,
            ($clip.output_start_ms + ($start - $clip.in_ms) / $clip.speed)] | min) | round),
          end_ms: (([$clip.output_end_ms,
            ($clip.output_start_ms + ($end - $clip.in_ms) / $clip.speed)] | min) | round),
          source_text: $cue.text, text: $cue.text,
          boundary_review: ($start != $cue.start_ms or $end != $cue.end_ms)
        }
      | if .end_ms > .start_ms then .
        else error("Cue became sub-millisecond after retiming; review \(.id)") end
    ]
  | sort_by(.start_ms, .end_ms, .id)
' captions/sources.cues.json > captions/timeline.cues.json
```

`boundary_review: true`는 시각만 보정했으며 문장 의미가 온전하다는 뜻이 아니다.
대사를 들으며 컷을 옮기거나 적절한 텍스트로 고친다. 원발화의 번역을 새 설명으로
몰래 바꾸지 않는다. 배속을 적용한 긴 문장이 너무 빨리 사라지면 편집표를 고친다.

번역/이중 언어는 언어 문서를 따른다. 원어 그대로 출력할 때도
`captions/timeline.cues.json`을 입력으로 사용한다.

## 최종 SRT 출력

`FINAL_CUES`는 원어 또는 언어별 확정 cue JSON,
`SRT_OUTPUT`은 예를 들어 `captions/final.ko.srt`다.
이 기본 레시피는 시간순 **비중첩 텍스트 트랙**이다. 원본의 롤링 중복이나
동시 발화를 먼저 정리한다. 겹침을 강제로 줄이거나 누락시키지 않고 오류로 드러낸다.
원래 동시 자막이 필요하면 별도 트랙/ASS 설계를 사용한다.

<!-- recipe: export-srt -->
```bash
test ! -e "$SRT_OUTPUT"
jq -er --slurpfile timeline timeline.json '
  def uint:
    if type == "number" then isfinite and . >= 0 and floor == . else false end;
  def pad($n):
    tostring | if length < $n then ("0" * ($n - length)) + . else . end;
  def stamp:
    . as $t
    | "\(($t / 3600000 | floor) | pad(2)):\(($t / 60000 | floor) % 60 | pad(2)):\(($t / 1000 | floor) % 60 | pad(2)),\($t % 1000 | pad(3))";
  if type == "array" then . else error("Expected final cue array") end
  | . as $cues
  | if all(.[];
      (.id | type) == "string"
      and (.start_ms | uint) and (.end_ms | uint)
      and .end_ms > .start_ms and .end_ms <= ($timeline[0].total_ms | round)
      and (.text | type) == "string" and (.text | test("\\S"))
      and (.text | test("\\r|\\u0000|\\n[ \\t]*\\n") | not))
    then . else error("Invalid cue text or timing") end
  | if ([.[].id] | unique | length) == length then .
    else error("Duplicate final cue ID") end
  | if all(range(1; length); $cues[.].start_ms >= $cues[. - 1].end_ms)
    then . else error("Out-of-order or overlapping cues: normalize and review first") end
  | to_entries
  | map("\(.key + 1)\n\(.value.start_ms | stamp) --> \(.value.end_ms | stamp)\n\(.value.text)")
  | join("\n\n")
' "$FINAL_CUES" > "$SRT_OUTPUT"
```

선택 구간에 대사가 없다면 빈 배열은 정상 결과일 수 있다. 이때는 자막이 없는
구간이라고 알리고 빈 SRT를 FFmpeg에 넣지 않는다. 자막 확보 실패를 숨기는
대안으로 빈 배열을 사용하지 않는다.

출력 후 시간뿐 아니라 인코딩, 긴 줄, 경계에서 잘린 문장과 읽기 속도를
확인한다. 이중 언어 표시와 스타일은 언어/출력 문서를 따른다.
