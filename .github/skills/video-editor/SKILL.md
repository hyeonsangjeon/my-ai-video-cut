---
name: video-editor
description: "PPT 데모 영상 편집 스킬. Use when: raw 화면 녹화를 컷 편집, 자막, TTS 나레이션, FFmpeg 합성하여 1분 데모 영상 제작. OpenCV scene detection, edge-tts, SRT subtitle, FFmpeg composition, video trimming, demo video pipeline"
---

# Video Editor Skill — 데모 영상 자동 편집

> **역할:** 데모 영상 편집 전문가  
> **범위:** raw 화면 녹화 → 컷 편집 → 자막 → TTS → 합성

---

## 1. 에이전트 역할

당신은 데모 영상 편집 전문가입니다. 아래 5단계 파이프라인을 실행합니다:

| 단계 | 스크립트 | 입력 | 출력 |
|------|----------|------|------|
| 1. Scene 감지 | `./scripts/scene_detector.py` | raw 영상 (.mov/.mp4) | `scenes.json` |
| 2. 트리밍 | `./scripts/trimmer.py` | raw 영상 + scenes.json | 트리밍된 클립 + merged.mp4 |
| 3. 자막 생성 | `./scripts/subtitle_generator.py` | `config/demo_scenario.json` | SRT 파일 |
| 4. TTS 생성 | `./scripts/tts_generator.py` | `config/demo_scenario.json` | MP3 파일들 |
| 5. 합성 | `./scripts/composer.py` | merged.mp4 + TTS + SRT | 최종 MP4 |

---

## 2. 스크립트 입출력 명세

### scene_detector.py

화면 변화를 감지하여 컷 포인트를 식별합니다.

```
CLI: python ./scripts/scene_detector.py \
       --input video/raw/demo.mov \
       --threshold 30 \
       --output video/trimmed/scenes.json

입력: raw 영상 파일 (MOV, MP4)
출력: scenes.json — [{"timestamp": 5.2, "frame_number": 156}, ...]
파라미터:
  --threshold  프레임 차이 임계값 (기본: 30, 낮을수록 민감)
```

### trimmer.py

Scene 정보를 기반으로 영상을 구간별 트리밍하고 하나로 합칩니다.

```
CLI: python ./scripts/trimmer.py \
       --input video/raw/demo.mov \
       --scenes video/trimmed/scenes.json \
       --scenario config/demo_scenario.json \
       --output-dir video/trimmed/

입력: raw 영상 + scenes.json (또는 demo_scenario.json)
출력: video/trimmed/01_landing.mp4, ... + video/trimmed/merged.mp4
파라미터:
  --speed  속도 배율 (기본: 1.0, 1분 초과 시 1.2 권장)
```

### subtitle_generator.py

시나리오 JSON에서 SRT 자막 파일을 생성합니다.

```
CLI: python ./scripts/subtitle_generator.py \
       --scenario config/demo_scenario.json \
       --lang ko \
       --output video/subtitles/demo_ko.srt

입력: demo_scenario.json
출력: SRT 파일 (UTF-8)
파라미터:
  --lang  언어 코드 (ko | en)
```

### tts_generator.py

edge-tts로 씬별 나레이션 음성을 생성합니다.

```
CLI: python ./scripts/tts_generator.py \
       --scenario config/demo_scenario.json \
       --lang ko \
       --output-dir video/tts/

입력: demo_scenario.json
출력: video/tts/01_landing.mp3, video/tts/02_stats.mp3, ...
파라미터:
  --lang   언어 코드 (ko | en)
  --voice  음성 오버라이드 (기본: scenario JSON의 voice_ko/voice_en)
```

### composer.py

영상 + TTS 오디오 + 자막을 합성하여 최종 출력합니다.

```
CLI: python ./scripts/composer.py \
       --video video/trimmed/merged.mp4 \
       --tts-dir video/tts/ \
       --srt video/subtitles/demo_ko.srt \
       --output video/output/foundry_iq_demo_1min_ko.mp4

입력: 트리밍된 영상 + TTS MP3 디렉토리 + SRT 파일
출력: 최종 MP4 파일
```

---

## 3. FFmpeg 명령어 패턴

### 구간 트리밍
```bash
ffmpeg -y -i input.mov -ss 00:00:05 -to 00:00:13 -c copy clip_01.mp4
```

### 클립 concatenation
```bash
# concat.txt 파일 생성
file 'clip_01.mp4'
file 'clip_02.mp4'

ffmpeg -y -f concat -safe 0 -i concat.txt -c copy merged.mp4
```

### TTS 오디오 concatenation
```bash
ffmpeg -y \
  -i 01_landing.mp3 -i 02_stats.mp3 -i 03_search.mp3 \
  -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1" \
  narration_full.mp3
```

### 자막 burn-in (한국어)
```bash
ffmpeg -y -i merged.mp4 \
  -vf "subtitles=demo_ko.srt:force_style='FontName=Apple SD Gothic Neo,FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,MarginV=30'" \
  -c:v libx264 -preset medium -crf 23 \
  output_subtitled.mp4
```

### 영상 + 오디오 + 자막 합성
```bash
ffmpeg -y \
  -i merged.mp4 \
  -i narration_full.mp3 \
  -vf "subtitles=demo_ko.srt:force_style='FontName=Apple SD Gothic Neo,FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,MarginV=30'" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 192k \
  -shortest \
  final_output.mp4
```

### Mac Retina 스케일 다운
```bash
ffmpeg -i input.mov -vf "scale=1920:1080" -c:v libx264 -crf 23 output.mp4
```

### 재생 속도 조절 (1.2x)
```bash
ffmpeg -i input.mp4 \
  -filter_complex "[0:v]setpts=PTS/1.2[v];[0:a]atempo=1.2[a]" \
  -map "[v]" -map "[a]" output_fast.mp4
```

---

## 4. edge-tts 음성 옵션

| 언어 | 음성 ID | 성별 | 특징 |
|------|---------|------|------|
| 한국어 | `ko-KR-SunHiNeural` | 여성 | 자연스러움 ★ 추천 |
| 한국어 | `ko-KR-InJoonNeural` | 남성 | 차분함 |
| 영어 | `en-US-AriaNeural` | 여성 | 프로페셔널 ★ 추천 |
| 영어 | `en-US-GuyNeural` | 남성 | 캐주얼 |
| 중국어 | `zh-CN-XiaoxiaoNeural` | 여성 | |
| 일본어 | `ja-JP-NanamiNeural` | 여성 | |

### 사용 패턴
```python
import edge_tts, asyncio

async def generate(text: str, voice: str, output: str):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output)

asyncio.run(generate("안녕하세요", "ko-KR-SunHiNeural", "out.mp3"))
```

---

## 5. 트러블슈팅 가이드

### Mac Retina 해상도
- 화면 녹화가 2880x1800 등 2x 해상도로 저장될 수 있음
- `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 input.mov`로 확인
- 1920x1080 초과 시 자동 스케일 다운: `ffmpeg -i input.mov -vf "scale=1920:1080" output.mp4`

### 한글 자막 폰트
- macOS 기본: "Apple SD Gothic Neo" 사용
- 없을 경우: `brew install --cask font-noto-sans-cjk-kr` 후 "Noto Sans KR" 사용
- FFmpeg force_style 예: `FontName=Apple SD Gothic Neo`

### edge-tts 인터넷 필요
- Microsoft Edge TTS 서버를 호출하므로 인터넷 연결 필수
- VPN/프록시 환경에서 timeout 발생 시 재시도
- 오프라인 대안: `pyttsx3` (품질 낮음)

### 영상 길이 관리
- 목표 1분 (60초)
- 초과 시 해결 방법:
  1. 로딩 대기 구간 더 짧게 트리밍
  2. 1.2x 속도 조절 (audio도 `atempo=1.2` 필요)
  3. 덜 중요한 scene 제거

### FFmpeg subtitles 필터 경로 주의
- 경로에 공백/특수문자가 있으면 에러:
  ```bash
  # 잘못됨
  -vf "subtitles=/path/to/my file.srt"
  # 올바름 — 이스케이프 또는 상대경로 사용
  -vf "subtitles=video/subtitles/demo_ko.srt"
  ```

### FFmpeg codec 호환성
- macOS QuickTime으로 재생하려면 `libx264` + `aac` 사용
- `-pix_fmt yuv420p` 추가하면 호환성 향상

---

## 6. 파이프라인 실행

### 전체 자동 실행
```bash
python scripts/run_pipeline.py --input video/raw/demo.mov --lang ko
# → video/output/foundry_iq_demo_1min_ko.mp4

python scripts/run_pipeline.py --input video/raw/demo.mov --lang en
# → video/output/foundry_iq_demo_1min_en.mp4
```

### 개별 단계 실행
```bash
# 1. Scene 감지
python .github/skills/video-editor/scripts/scene_detector.py \
  --input video/raw/demo.mov --output video/trimmed/scenes.json

# 2. 트리밍
python .github/skills/video-editor/scripts/trimmer.py \
  --input video/raw/demo.mov --scenes video/trimmed/scenes.json \
  --output-dir video/trimmed/

# 3. 자막
python .github/skills/video-editor/scripts/subtitle_generator.py \
  --scenario config/demo_scenario.json --lang ko \
  --output video/subtitles/demo_ko.srt

# 4. TTS
python .github/skills/video-editor/scripts/tts_generator.py \
  --scenario config/demo_scenario.json --lang ko \
  --output-dir video/tts/

# 5. 합성
python .github/skills/video-editor/scripts/composer.py \
  --video video/trimmed/merged.mp4 \
  --tts-dir video/tts/ \
  --srt video/subtitles/demo_ko.srt \
  --output video/output/foundry_iq_demo_1min_ko.mp4
```
