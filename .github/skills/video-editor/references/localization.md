# 다국어 자막과 언어 프롬프트

## 언어는 코드 분기가 아니라 작업 데이터

스킬의 언어 양식으로 원어, 출력 언어, 독자, 문체, 용어집, 읽기 속도를 정한다.
`ko/en`만 허용하는 고정 목록을 만들지 않는다. 자막 언어 태그(예: `ko`, `en-US`),
TTS 음성 ID(예: `ko-KR-SunHiNeural`), 컨테이너 언어 코드(예: `kor`)는 서로
다른 값이므로 용도에 맞게 구분한다.

한국어는 자연스러운 존댓말, 영어는 간결한 구어체, 일본어는 필요하면
「です・ます」체 등을 프로필로 선택할 수 있다. 언어만으로 존댓말이나 말투를
강제하지 않는다. 수치·단위·부정·불확실성·발언 주체를 보존한다.

| 모드 | 입력/출력 | 시간 기준 |
|---|---|---|
| `original` | 원문 cue → 원어 SRT | 편집된 원본 발화 |
| `translate` | 원문 cue → 언어별 번역문 | 원어 cue ID와 시간 유지 |
| `bilingual` | 원문+번역문 → 하나의 cue | 동일 cue에 두 언어 |
| `explanatory` | 선택 장면 근거 → 새 설명문 | 해당 클립/설명 구간 |
| 새 나레이션 | 승인된 새 대본 → TTS+자막 | 실제 새 음성의 시간 |

번역 자막을 설명/요약문으로 대체하지 않는다. 화면 설명은 원발화의 인용처럼
표시하지 않는다. 새 나레이션에는 원본 SRT 시간을 재사용하지 않는다.

## cue ID로 번역하고 CLI로 결합

`captions/timeline.cues.json`이 읽기 전용 기준이다. 장면/문단 경계로 묶어
약 30~60개 cue와 앞뒤 문맥을 읽는다. 문맥용 cue는 출력 대상으로 표시하지 않는다.
번역문만 ID→문자열 JSON으로 파일 도구를 사용해 작성한다.

```json
{
  "c01/source-a:1": "첫 번째 발화의 번역문",
  "c01/source-a:2": "두 번째 발화의 번역문"
}
```

위 ID는 예시다. 실제 기준 파일의 **모든 ID를 정확히 한 번씩** 사용한다.
외부 번역 API를 임의로 호출하지 않는다. 제공자/전송 범위/비용 승인이 있는
경우에만 사용하며 번역 품질과 누락 판단 기준은 동일하게 적용한다.

`TRANSLATIONS=captions/translations.ko.json`,
`LOCALIZED_CUES=captions/final.ko.cues.json` 같은 경로를 지정하고 실행한다.

<!-- recipe: merge-translations -->
```bash
test ! -e "$LOCALIZED_CUES"
jq -e --slurpfile base captions/timeline.cues.json '
  . as $translations
  | if type == "object" then . else error("Translations must be an ID-to-text object") end
  | if (keys | sort) == ([$base[0][].id] | sort) then .
    else error("Missing or unexpected translation IDs") end
  | if all(.[]; type == "string" and test("\\S")) then .
    else error("Blank or invalid translation") end
  | $base[0] | map(. + {text: $translations[.id]})
' "$TRANSLATIONS" > "$LOCALIZED_CUES"
```

시간·ID·원문·출처는 에이전트가 복사해서 재작성하지 않고 이 명령이 그대로
보존한다. 출력 언어마다 번역 파일만 분기한다. 편집표를 바꿨다면 기존 번역을
무조건 다시 연결하지 말고 ID와 원문/문맥이 유지되는지 확인한다.

## 이중 언어

기본은 원문 1줄 + 번역 1줄이다. 각 언어 내부의 줄바꿈은 공백으로 합친다.
긴 문장은 화면에서 자동으로 더 줄바꿈될 수 있으므로 실제 렌더링을 확인한다.
별도의 원어 SRT와 번역 SRT도 유지할 수 있다.

<!-- recipe: bilingual-cues -->
```bash
test ! -e captions/bilingual.ko.cues.json
jq 'map(.text = ((.source_text | gsub("\n"; " "))
                   + "\n" + (.text | gsub("\n"; " "))))' \
  captions/final.ko.cues.json > captions/bilingual.ko.cues.json
```

`FINAL_CUES`에 이 파일을 지정해 자막 문서의 SRT 출력 명령을 사용한다.
두 개의 SRT를 연속 재생하거나 원문 시간을 다시 누적하지 않는다.

## 설명 자막

원본 cue 번역과 별도 파일에 clip ID→설명문을 작성한다. 간단한 장면 설명은
해당 클립 전체에 표시할 수 있으며, 대사가 길면 더 작은 설명 구간을 별도로
계획한다. 아래는 모든 클립에 짧은 설명을 붙이는 모드다.

<!-- recipe: explanatory-cues -->
```bash
test ! -e captions/explanatory.ko.cues.json
jq -e --slurpfile timeline timeline.json '
  . as $text
  | if type == "object" and (keys | sort) == ([$timeline[0].clips[].id] | sort)
       and all(.[]; type == "string" and test("\\S"))
    then [$timeline[0].clips[] | {
      id: ("explain/" + .id), clip_id: .id, source_id: .source_id,
      start_ms: (.output_start_ms | round), end_ms: (.output_end_ms | round),
      text: $text[.id], kind: "explanatory"
    }]
    else error("Explanations must cover the clip IDs exactly") end
' captions/explanations.ko.json > captions/explanatory.ko.cues.json
```

독자가 번역으로 오인하지 않도록 출력 파일명/결과 설명에 `설명 자막`이라고
구분한다. 자막이 없는 영상에 이런 설명을 추가할 수 있지만 그것을 전사라고
부르지 않는다.

## 길이와 읽기 속도

언어 프로필에 정한 `MAX_CPS`로 긴 cue를 찾는 보조 명령이다. 문자 수는 Unicode
code point 기준의 근사치이며 실제 독해 속도를 판정하는 절대 기준이 아니다.

```bash
jq --argjson limit "$MAX_CPS" '
  [.[] | . + {cps: ((.text | gsub("\\s"; "") | length)
    / ((.end_ms - .start_ms) / 1000))} | select(.cps > $limit)]
' captions/final.ko.cues.json
```

길이를 맞추려고 숫자/부정/조건을 삭제하지 않는다. 문장 다듬기, 적절한 cue 분할,
편집표의 구간 연장 중 의미를 보존하는 방법을 선택한다. 시간을 바꾸는 조치는
번역 JSON의 임의 수정이 아니라 타임라인 변경으로 처리한다.
언어별 폰트와 글리프를 확인하며 이모지·복잡한 스타일을 기본값으로 넣지 않는다.
