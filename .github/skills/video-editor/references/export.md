# 출력과 완료 조건

## 원음 MP4와 무음 버전

중간 클립은 이미 같은 규격의 H.264 영상이다. 최종 MP4에서는 영상을 복사하고
PCM 오디오를 AAC로 한 번 인코딩한다. `+faststart`로 재생 시작을 돕는다.

<!-- recipe: export-video -->
```bash
ffmpeg -hide_banner -loglevel error -n -nostdin -i assembled.nut \
  -map 0:v:0 -map 0:a:0 -c:v copy -c:a aac -b:a 192k \
  -movflags +faststart exports/final.mp4
```

무음을 요청한 경우:

```bash
ffmpeg -hide_banner -loglevel error -n -nostdin -i assembled.nut \
  -map 0:v:0 -an -c:v copy -movflags +faststart exports/final-muted.mp4
```

모든 출력은 명시적인 입력 파일을 지정한다. 나레이션을 요청했다면 오디오 문서의
교체/혼합 결과를 번인/내장 자막의 입력으로 선택한다.

## 자막 출력 모드

| 모드 | 장점/제약 |
|---|---|
| 별도 `final.ko.srt` 등 | 재번역·업로드·편집에 적합. 영상과 같은 시간 기준. 폰트는 없음 |
| Burn-in | 모든 플레이어에 보이지만 끌 수 없음. 영상 재인코딩과 libass/폰트 필요 |
| Soft subtitle | 켜고 끌 수 있음. MP4는 `mov_text`로 변환. 원본 SRT도 보존 |

### 번인

예시 변수: `VIDEO_INPUT=exports/final.mp4`,
`SUBTITLE_FILE=captions/final.ko.srt`, `VIDEO_OUTPUT=exports/final-ko-burned.mp4`.
필터에 넣는 SRT는 작업 내 안전한 상대 경로여야 한다. 원본의 공백/특수문자
절대 경로를 이 필터에 직접 넣지 않는다.
`SUBTITLE_STYLE`에는 확인된 폰트와 허용한 스타일 값만 지정한다.

```bash
SUBTITLE_STYLE='FontName=Noto Sans CJK KR,FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,MarginV=24'
```

<!-- recipe: burn-subtitles -->
```bash
test -s "$SUBTITLE_FILE"
ffmpeg -hide_banner -loglevel error -n -nostdin -i "$VIDEO_INPUT" \
  -map 0:v:0 -map '0:a:0?' \
  -vf "subtitles=filename=$SUBTITLE_FILE:force_style='$SUBTITLE_STYLE'" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart "$VIDEO_OUTPUT"
```

세로 영상/화면 녹화는 UI나 플랫폼 버튼을 가리지 않는 여백을 정한다.
ASS의 `FontSize/MarginV`는 스크립트 해상도와 렌더링에 영향을 받으므로
출력 픽셀과 일대일이라고 가정하지 않는다. 첫/중간/마지막 cue와 긴 문장을
직접 확인한다. 한글/일본어/아랍어 등 실제 문자와 선택한 폰트의 조합을 본다.

### 선택 가능한 다국어 트랙

한국어·영어 예시다. 실제 출력 언어에 따라 입력과 `-map`, 메타데이터를 명시한다.
언어 이름만 바꾸고 엉뚱한 SRT를 재사용하지 않는다.

<!-- recipe: mux-subtitles -->
```bash
ffmpeg -hide_banner -loglevel error -n -nostdin \
  -i exports/final.mp4 -i captions/final.ko.srt -i captions/final.en.srt \
  -map 0:v:0 -map '0:a:0?' -map 1:0 -map 2:0 \
  -c:v copy -c:a copy -c:s mov_text \
  -metadata:s:s:0 language=kor -metadata:s:s:0 title=Korean \
  -metadata:s:s:1 language=eng -metadata:s:s:1 title=English \
  -disposition:s:0 default -disposition:s:1 0 \
  -movflags +faststart exports/final-multilingual.mp4
```

빈 자막 파일을 이 명령에 전달하지 않는다. 자막이 먼저 끝나더라도 `-shortest`로
영상 끝을 자르지 않는다. 플레이어별 자막 표시/트랙 전환 지원은 사용처에서 확인한다.

## 완료 조건

각 항목을 만족해야 완료다. 단순히 FFmpeg가 0으로 종료했다고 완성으로 보고하지 않는다.

| 범위 | 확인 항목 |
|---|---|
| 소스 | 요청한 모든 소스의 상태/이용 근거/사용 구간이 기록되어 있음 |
| 타임라인 | 중복 ID/잘못된 구간 없음, 실제 프레임 수가 계획과 일치, 컷 순서 정확 |
| 영상 | 재생/디코딩 가능, 시작/끝과 컷 경계에 검은 화면·플리커·긴 정지 화면 없음 |
| 길이 | 영상 길이와 계획의 차이가 최대 1프레임 이내; 목표 길이/범위 충족 |
| 오디오 | 요청 모드/언어/트랙이 맞고 나레이션이 장면보다 앞서거나 누적해서 밀리지 않음 |
| 자막 | UTF-8, 연속 번호, 양의 길이, 시간순, 범위 안, 번역 ID 누락 없음 |
| 의미/표시 | 잘린 문장·잘못된 번역·글리프 누락 없음, 읽을 시간/여백 충분 |
| 산출물 | 요청한 영상/SRT/언어별 파일과 출처 기록이 실제 경로에 존재 |

클립 프레임 수는 편집 레시피에서 확인한다. 결과물에서도 확인한다.
`VIDEO_OUTPUT`은 검사 대상의 실제 경로다.

<!-- recipe: inspect-export -->
```bash
ffprobe -v error -count_frames -show_streams -show_format \
  -of json "$VIDEO_OUTPUT" > logs/export-probe.json
jq -e --slurpfile timeline timeline.json '
  [.streams[] | select(.codec_type == "video")][0] as $video
  | ($video.nb_read_frames | tonumber) == $timeline[0].total_frames
' logs/export-probe.json
ffmpeg -hide_banner -loglevel error -xerror -nostdin -i "$VIDEO_OUTPUT" \
  -map 0:v:0 -map '0:a:0?' -f null -
```

프레임 수 외에 영상 시작/끝 PTS와 길이를 본다. CFR 여부를
`r_frame_rate == avg_frame_rate` 한 가지 조건만으로 단정하지 않는다.
필요하면 프레임 타임스탬프 간격을 검사한다. AAC 패킷 패딩으로 컨테이너/오디오
길이가 조금 늘어날 수 있으므로 영상 트랙의 길이와 구분한다.

컷 시작은 `timeline.json`의 `output_start_ms`다. 해당 시점 앞뒤를 재생하거나
프레임을 추출해 확인한다. 오디오를 듣지 못하는 환경에서는 청취했다고 말하지
않고 그 한계를 결과에 남긴다.

```bash
ffmpeg -hide_banner -loglevel error -n -nostdin -ss "$CHECK_SECONDS" \
  -i "$VIDEO_OUTPUT" -frames:v 1 logs/boundary-preview.png
```

## 레시피 변경 시 회귀 사례

새 테스트 프레임워크 대신 작은 합성 소스와 설치된 CLI로 아래 사례를 확인한다.
공개 영상 다운로드나 외부 ASR/TTS 호출을 자동 테스트에 넣지 않는다.

| 사례 | 기대 결과 |
|---|---|
| 24fps 가로/음성 영상 + 30fps 세로/무음 영상 | 같은 규격·프레임 수로 연결, 무음 슬롯 보존 |
| 컷 시작/끝을 걸치는 cue | 교집합으로 줄이고 boundary_review 표시 |
| 여러 원본의 순서 변경/동일 소스 반복 | 배열 순서와 clip별 별도 cue ID |
| 0.5배/2배 재생 | 영상/원음/자막 모두 같은 배속과 출력 시작 |
| 부분 다운로드 origin | 영상 로컬 seek만 origin을 빼고 자막은 원본 시간 유지 |
| UTF-8 BOM/CRLF, 여러 줄, 1시간 이상 SRT | 내용 보존과 정확한 시간 포맷 |
| 없는 자막/모든 cue가 컷 밖 | 명시적 없음 상태, 빈 SRT를 합성에 전달하지 않음 |
| 잘못된 구간/중복 ID/번역 누락/겹친 cue | 오류로 중단, 성공 출력으로 취급하지 않음 |
| TTS가 클립보다 짧음/길음 | 짧으면 뒤 무음, 길면 조정 전 합성 중단 |
| 번인/내장 한국어·영어 | 실제 파일, 언어 메타데이터, 영상 끝 보존 |

정리는 이번 작업의 확인된 임시 경로에 한정한다. 원본·다른 작업·플러그인
설치 경로를 삭제하지 않는다. 업로드/게시/커밋은 별도의 요청이 있을 때만 한다.
