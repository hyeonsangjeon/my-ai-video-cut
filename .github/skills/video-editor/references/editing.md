# 내용 선별, 정밀 컷, 연결

## 편집 판단

먼저 요청 목적에 맞는 구간을 고른다. 대사·챕터·화면·오디오를 근거로 선택 이유를
기록하고 문장 중간, 클릭 결과 직전, 인용의 조건절을 자르지 않는다. 같은 장면의
반복을 줄이되 다른 소스를 연결해 원래 없던 발언이나 인과관계를 만들지 않는다.

장면/무음 후보를 찾는 보조 명령:

```bash
ffmpeg -hide_banner -nostdin -i sources/source-a.mp4 \
  -vf "select='gt(scene,0.3)',showinfo" -an -f null -
ffmpeg -hide_banner -nostdin -i sources/source-a.mp4 \
  -af silencedetect=noise=-35dB:d=0.7 -vn -f null -
```

두 번째 명령은 오디오가 있을 때만 쓴다. 임계값을 모든 영상에 고정하지 않는다.
무음/화면 변화가 곧 삭제 구간은 아니다. 후보 근처의 프레임과 발화를 확인한다.

## 편집표를 실행 데이터로 변환

스킬의 편집표 양식을 작업의 `edit-plan.md`로 채운다. 아래 레시피는 Bash에서
`set -euo pipefail`을 사용하고 작업 디렉터리로 `cd`한 후 실행한다.
이미 있는 산출물을 수정하려면 새 버전 디렉터리를 사용한다.

<!-- recipe: extract-plan -->
```bash
test ! -e plan.json
jq -Rse '
  [match("(?ms)^```json[ \\t]*\\n(?<body>.*?)^```[ \\t]*$"; "g")
   | .captures[] | select(.name == "body") | .string | fromjson]
  | if length == 1 then .[0]
    else error("edit-plan.md must contain exactly one JSON block") end
' edit-plan.md > plan.json
```

원본과 출력은 다른 시계다. 클립 길이를 출력 프레임 수로 반올림하고, 누적 시각은
**누적 프레임 수/FPS**로 계산한다. 초/밀리초를 매번 반올림해 누적하지 않는다.
마지막 SRT 출력에서만 밀리초로 반올림한다.

<!-- recipe: resolve-timeline -->
```bash
test ! -e timeline.json
jq -e '
  def require($ok; $message):
    if $ok then . else error($message) end;
  def uint:
    if type == "number" then isfinite and . >= 0 and floor == . else false end;
  def ident:
    if type == "string" then test("^[a-z0-9]+([_-][a-z0-9]+)*$") else false end;
  def localpath:
    if type == "string" then
      test("^[A-Za-z0-9_][A-Za-z0-9_./-]*$")
      and (split("/") | all(. != "." and . != ".." and . != ""))
    else false end;
  require(.version == 1; "Unsupported plan version")
  | require((.fps_num | uint) and .fps_num > 0
            and (.fps_den | uint) and .fps_den > 0; "Invalid FPS")
  | require(.fps_num / .fps_den >= 1 and .fps_num / .fps_den <= 120;
            "FPS must be between 1 and 120")
  | require((.width | uint) and .width > 0 and .width % 2 == 0
            and (.height | uint) and .height > 0 and .height % 2 == 0;
            "Output dimensions must be positive even integers")
  | require((.sources | type) == "array" and (.sources | length) > 0;
            "Sources must be a nonempty array")
  | require(all(.sources[];
      (.id | ident) and (.media | localpath)
      and (.source_duration_ms | uint) and .source_duration_ms > 0
      and (.media_origin_ms | uint)
      and (.media_duration_ms | uint) and .media_duration_ms > 0
      and .media_origin_ms < .source_duration_ms
      and has("captions") and (.captions == null or (.captions | localpath)));
      "Invalid source metadata or unsafe job-relative path")
  | require(([.sources[].id] | length) == ([.sources[].id] | unique | length);
            "Duplicate source ID")
  | require((.clips | type) == "array" and (.clips | length) > 0;
            "Clips must be a nonempty array")
  | require(all(.clips[];
      (.id | ident) and (.source_id | ident)
      and (.in_ms | uint) and (.out_ms | uint) and .out_ms > .in_ms
      and (.speed | type) == "number" and (.speed | isfinite)
      and .speed >= 0.5 and .speed <= 2
      and (.reason | type) == "string" and (.reason | length) > 0);
      "Invalid clip; use positive intervals and speed 0.5..2")
  | require(([.clips[].id] | length) == ([.clips[].id] | unique | length);
            "Duplicate clip ID")
  | . as $plan
  | (reduce .clips[] as $clip (
      {next_frame: 0, clips: []};
      [$plan.sources[] | select(.id == $clip.source_id)] as $matches
      | require(($matches | length) == 1; "Unknown source: \($clip.source_id)")
      | $matches[0] as $source
      | require($clip.in_ms >= $source.media_origin_ms
          and $clip.out_ms <= $source.source_duration_ms
          and $clip.out_ms <= ($source.media_origin_ms + $source.media_duration_ms);
          "Clip outside available source interval: \($clip.id)")
      | (($clip.out_ms - $clip.in_ms) / $clip.speed
          * $plan.fps_num / $plan.fps_den / 1000 | round) as $frames
      | require($frames > 0; "Clip is shorter than one output frame")
      | .next_frame as $start_frame
      | .clips += [$clip + {
          media: $source.media,
          input_start_ms: ($clip.in_ms - $source.media_origin_ms),
          input_duration_ms: ($clip.out_ms - $clip.in_ms),
          frames: $frames,
          output_start_frame: $start_frame,
          output_start_ms: ($start_frame * 1000 * $plan.fps_den / $plan.fps_num),
          output_end_ms: (($start_frame + $frames) * 1000 * $plan.fps_den / $plan.fps_num),
          duration_ms: ($frames * 1000 * $plan.fps_den / $plan.fps_num)
        }]
      | .next_frame += $frames
    )) as $resolved
  | $plan + {
      clips: $resolved.clips,
      total_frames: $resolved.next_frame,
      total_ms: ($resolved.next_frame * 1000 * $plan.fps_den / $plan.fps_num)
    }
' plan.json > timeline.json
```

`jq` 실패 시 출력 파일이 남을 수 있다. 실패한 `plan.json/timeline.json`을
다음 단계에 넘기지 않는다. 아래 명령으로 사람이 읽을 편집표도 생성할 수 있다.

```bash
jq -r '.clips[] | [.id, .source_id, .in_ms, .out_ms, .speed,
  .output_start_ms, .output_end_ms, .reason] | @tsv' timeline.json
```

## 클립 렌더링

입력은 길이와 스트림 상태를 확인한 일반 SDR 영상으로 제한한다. 파일 시작의
A/V 오프셋·회전·HDR 문제는 도구 문서의 사전 점검에서 처리한다.
픽셀 종횡비(SAR)를 먼저 정사각형 픽셀로 정규화하고, 출력 캔버스 안에 비율을
유지해 배치한다. SAR이 지정되지 않은 영상은 정사각형 픽셀로 취급한다.
표준 `scale`/`setsar` 필터를 사용하며 최신 FFmpeg의 `reset_sar` 옵션에 의존하지 않는다.

정확한 임의 시점 컷은 재인코딩한다. 무조건 `-c copy`로 잘라서 정밀 컷이라고
보고하지 않는다. 아래는 일반 인코딩용 원본 음성과 무음 소스를 모두 처리한다.
TTS는 아직 넣지 않는다. 클립은 H.264 + PCM 오디오의 NUT 중간 파일로 만들어
클립마다 AAC 인코더 지연이 누적되는 것을 피한다.

<!-- recipe: render-clips -->
```bash
fps=$(jq -r '"\(.fps_num)/\(.fps_den)"' timeline.json)
frame_duration=$(jq -r '.fps_den / .fps_num' timeline.json)
width=$(jq -r '.width' timeline.json)
height=$(jq -r '.height' timeline.json)
test ! -e clips/queue.jsonl
jq -c '.clips[]' timeline.json > clips/queue.jsonl
while IFS= read -r clip; do
  id=$(jq -r '.id' <<< "$clip")
  media=$(jq -r '.media' <<< "$clip")
  start=$(jq -r '.input_start_ms / 1000' <<< "$clip")
  input_duration=$(jq -r '.input_duration_ms / 1000' <<< "$clip")
  duration=$(jq -r '.duration_ms / 1000' <<< "$clip")
  frames=$(jq -r '.frames' <<< "$clip")
  speed=$(jq -r '.speed' <<< "$clip")
  if [ ! -f "$media" ]; then
    printf 'Missing media for %s: %s\n' "$id" "$media" >&2
    exit 1
  fi
  audio_stream=$(ffprobe -v error -select_streams a:0 \
    -show_entries stream=index -of csv=p=0 "$media")
  geometry_filter="scale=w='max(1,round(iw*if(gt(sar,0),sar,1)))':h=ih,setsar=1,scale=w='min(iw,$width)':h='min(ih,$height)':force_original_aspect_ratio=decrease:force_divisible_by=2,pad=$width:$height:(ow-iw)/2:(oh-ih)/2,setsar=1"
  video_filter="[0:v:0]trim=duration=$input_duration,setpts=(PTS-STARTPTS)/$speed,fps=$fps,$geometry_filter,tpad=stop_mode=clone:stop_duration=$frame_duration,trim=end_frame=$frames,setpts=N/(($fps)*TB)[v]"
  if [ -n "$audio_stream" ]; then
    audio_filter="[0:a:0]atrim=duration=$input_duration,asetpts=PTS-STARTPTS,atempo=$speed,aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo,apad,atrim=duration=$duration,asetpts=N/SR/TB[a]"
  else
    audio_filter="[1:a:0]atrim=duration=$duration,asetpts=N/SR/TB[a]"
  fi
  ffmpeg -hide_banner -loglevel error -n -nostdin -ss "$start" -i "$media" \
    -f lavfi -i "anullsrc=r=48000:cl=stereo" \
    -filter_complex "$video_filter;$audio_filter" \
    -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 18 \
    -pix_fmt yuv420p -c:a pcm_s16le "clips/$id.nut"
  actual_frames=$(ffprobe -v error -select_streams v:0 -count_frames \
    -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "clips/$id.nut")
  if [ "$actual_frames" != "$frames" ]; then
    printf 'Frame count mismatch for %s: wanted %s, got %s\n' \
      "$id" "$frames" "$actual_frames" >&2
    exit 1
  fi
done < clips/queue.jsonl
```

프레임 반올림 보정용 정지 화면은 최대 약 1프레임만 추가한다. 원본 부족을
긴 정지 화면으로 숨기지 않는다. 실제 프레임 수/길이가 계획과 다르면 소스
길이와 컷 구간을 수정해 다시 생성한다.

## 연결

파일명순/디렉터리 검색이 아니라 편집표 순서만 사용한다. `duration`은 영상의
정확한 프레임 길이로 지정한다. NUT 중간 파일은 작업 내부 자료이지 배포 영상이 아니다.

<!-- recipe: assemble -->
```bash
test ! -e clips/concat.txt
jq -r '.clips[] | "file \u0027\(.id).nut\u0027\nduration \(.duration_ms / 1000)"' \
  timeline.json > clips/concat.txt
ffmpeg -hide_banner -loglevel error -n -nostdin -f concat -safe 1 \
  -i clips/concat.txt -map 0:v:0 -map 0:a:0 -c copy assembled.nut
```

실제 프레임 수·길이·컷 경계가 계획과 맞는지 출력 문서의 절차로 확인한다.
맞지 않으면 자막을 먼저 만들지 않는다. 자막 변환은 원본 SRT를 대상으로 하며,
NUT 파일의 오디오나 결과 영상을 다시 전사하는 작업과 구분한다.
