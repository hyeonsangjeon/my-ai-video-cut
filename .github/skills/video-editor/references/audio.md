# 원음, TTS, 음성 혼합

## 기본값은 원음 유지

자막 번역 요청은 음성 번역 요청이 아니다. `original`에서는 나레이션을 생성하지
않는다. 여러 영상의 소리가 다르면 같은 샘플레이트/채널로 맞추되 큰 음량 차이가
있는지 듣고 확인한다. loudness 목표는 용도에 맞춰 정하며 무조건 크게 만들지 않는다.
`mute`는 영상만 출력한다.

`replace`는 원음 대신 새 음성을 사용하고, `mix`는 원음을 낮추고 음성을 얹는다.
동시에 두 발화가 들려 이해를 방해하면 단순 혼합 대신 교체/덕킹을 선택한다.
음원 이용 권한과 외부 서비스에 대본을 전송할 수 있는지도 확인한다.

## 선택형 TTS 어댑터

`edge-tts --help`와 `edge-tts --list-voices`에서 현재 지원 음성을 확인한다.
한국어 `ko-KR-SunHiNeural`, 영어 `en-US-AriaNeural`, 일본어 `ja-JP-NanamiNeural`은
선택 예시다. 요청 언어를 지원하지 않으면 한국어 음성으로 대체하지 않는다.
온라인 서비스이므로 대본 전송 허가가 없거나 오프라인이면 실행하지 않는다.

파일 도구로 `audio/ko/c01.txt`에 대본을 쓴 뒤 실행한다.

```bash
edge-tts --voice "$VOICE" --file audio/ko/c01.txt \
  --write-media audio/ko/c01.raw.mp3 --write-subtitles audio/ko/c01.local.srt
```

다른 TTS 도구도 사용할 수 있지만 `클립 ID → 음성 파일 + 로컬 시간 자막`이라는
계약은 같아야 한다. 자막을 출력하지 않는 도구라면 실제 음성 정렬 수단이 필요하다.
문장별 예상 시간을 계산해서 단어 단위 동기화가 된 것처럼 보고하지 않는다.

## 각 클립의 음성을 해당 길이에 배치

`CLIP_ID=c01`, `AUDIO_INPUT=audio/ko/c01.raw.mp3`,
`AUDIO_OUTPUT=audio/ko/c01.wav` 같은 값을 같은 셸 호출에서 지정한다.
음성이 클립보다 길면 먼저 대본 축약, 지원되는 발화 속도 조정, 컷 연장 중
적절한 방법으로 해결한다. 발화 속도를 바꾸면 음성과 자막을 함께 재생성한다.
영상 끝을 `-shortest`로 잘라서 맞추지 않는다.

<!-- recipe: pad-narration -->
```bash
duration=$(jq -er --arg id "$CLIP_ID" \
  '[.clips[] | select(.id == $id)] |
   if length == 1 then .[0].duration_ms / 1000 else error("Unknown clip") end' timeline.json)
spoken=$(ffprobe -v error -show_entries format=duration \
  -of default=nw=1:nk=1 "$AUDIO_INPUT")
if ! jq -en --argjson spoken "$spoken" --argjson duration "$duration" \
  '$spoken > 0 and $spoken <= $duration' > /dev/null; then
  printf 'Narration does not fit clip %s; revise before rendering\n' "$CLIP_ID" >&2
  exit 1
fi
ffmpeg -hide_banner -loglevel error -n -nostdin -i "$AUDIO_INPUT" \
  -map 0:a:0 -af "aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo,apad,atrim=duration=$duration,asetpts=N/SR/TB" \
  -c:a pcm_s16le "$AUDIO_OUTPUT"
```

나레이션이 없는 클립도 배열에서 빼지 말고 해당 길이의 무음 슬롯을 만든다.
`DURATION`은 그 클립의 `duration_ms / 1000`이다.

```bash
ffmpeg -hide_banner -loglevel error -n -nostdin \
  -f lavfi -i anullsrc=r=48000:cl=stereo -t "$DURATION" \
  -c:a pcm_s16le "audio/ko/$CLIP_ID.wav"
```

모든 클립의 WAV가 준비되고 길이/순서를 확인한 뒤 연결한다.

<!-- recipe: assemble-narration -->
```bash
test ! -e audio/ko/concat.txt
jq -r '.clips[] | "file \u0027\(.id).wav\u0027"' timeline.json > audio/ko/concat.txt
ffmpeg -hide_banner -loglevel error -n -nostdin -f concat -safe 1 \
  -i audio/ko/concat.txt -map 0:a:0 -c:a pcm_s16le audio/ko/narration.wav
```

## 새 음성의 SRT 시간

자막 문서의 parse 레시피로 각 `c01.local.srt`를 읽는다.
여기서는 `SOURCE_ID`를 원본 영상 ID가 아니라 **클립 ID(c01)**로 지정한다.
대사가 있는 클립의 cue JSON만 명시적으로 합쳐 `audio/ko/local.cues.json`을 만든다.
다음 명령은 로컬 TTS 시각을 해당 클립의 결과 시작으로 이동한다.
영상 배속을 다시 적용하지 않는다.

<!-- recipe: retime-narration -->
```bash
test ! -e captions/narration.ko.cues.json
jq -e --slurpfile timeline timeline.json '
  [.[] as $cue
   | [$timeline[0].clips[] | select(.id == $cue.source_id)] as $clips
   | if ($clips | length) == 1 then $clips[0] else error("Unknown TTS clip ID") end
   | . as $clip
   | if $cue.start_ms >= 0 and $cue.end_ms > $cue.start_ms
        and $cue.end_ms <= ($clip.duration_ms | round) then
       $cue + {
         id: ("tts/" + $cue.id), clip_id: $clip.id, kind: "narration",
         source_text: $cue.text,
         start_ms: (($clip.output_start_ms + $cue.start_ms) | round),
         end_ms: (($clip.output_start_ms + $cue.end_ms) | round)
       }
     else error("TTS cue exceeds its clip") end]
  | sort_by(.start_ms, .end_ms, .id)
' audio/ko/local.cues.json > captions/narration.ko.cues.json
```

이 파일을 SRT 출력의 입력으로 지정한다. 원발화의 번역 자막과 새 나레이션의
자막을 혼합하지 않는다.

## 교체와 혼합

새 음성만 사용:

<!-- recipe: replace-audio -->
```bash
ffmpeg -hide_banner -loglevel error -n -nostdin \
  -i assembled.nut -i audio/ko/narration.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k \
  -movflags +faststart exports/final-ko-voice.mp4
```

원음을 낮추고 혼합(0.15는 예시이며 청취 후 조정):

<!-- recipe: mix-audio -->
```bash
ffmpeg -hide_banner -loglevel error -n -nostdin \
  -i assembled.nut -i audio/ko/narration.wav \
  -filter_complex "[0:a:0]volume=0.15[bed];[bed][1:a:0]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95:latency=1[a]" \
  -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 192k \
  -movflags +faststart exports/final-ko-mix.mp4
```

원본이 무음이어도 기본 편집 레시피는 무음 오디오 트랙을 만들어 이 계약을
유지한다. 사용할 스트림은 반드시 `-map`으로 지정한다. `-shortest`로
문제를 숨기지 않는다. 최종 길이가 타임라인과 맞지 않으면 출력을 중단하고
각 음성 슬롯/연결 순서를 고친다.
