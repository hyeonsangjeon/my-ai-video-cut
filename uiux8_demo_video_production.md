# UIUX-8: 1분 데모 영상 제작 — 촬영 시나리오 + 자동 편집

> **실행:** Copilot Opus 4.6 1M (영상 편집 에이전트)
> **상태:** 🟢 4/6 Deep Dive 전까지
> **최종 산출물:** 1분 데모 영상 (자막 + TTS 나레이션)

---

## 전체 워크플로우

```
Step 1: 현상님이 Mac 화면 녹화 (타이밍 시나리오대로)
Step 2: raw 영상 파일을 프로젝트 폴더에 저장
Step 3: Copilot Opus가 영상 편집 에이전트로:
        - 컷 포인트 분석 + 트리밍
        - 자막 SRT 생성 (한국어 + 영어)
        - TTS 나레이션 생성
        - 최종 합성 (영상 + 자막 + TTS)
Step 4: 1분 최종 영상 출력
```

---

## Step 1: 촬영 타이밍 시나리오

Mac에서 `Cmd+Shift+5` → 화면 녹화 시작.
아래 시나리오를 **천천히 정확하게** 따라 클릭.
총 녹화 시간: 약 2~3분 (편집 후 1분으로 압축)

### Scene 1: 랜딩 (0:00-0:08)

```
[Action] localhost:3000 또는 Vercel URL 열기
[Wait]   2초 — 랜딩 페이지 로드 완료 대기
[Action] 마우스를 천천히 Phase 3 "시맨틱 조인 데모" 카드로 이동
[Wait]   1초 — 카드 hover 효과 보이게
[Action] "시맨틱 조인 체험 →" 버튼 클릭
[Wait]   2초 — Semantic JOIN 페이지 로드
```

### Scene 2: 데이터 소개 (0:08-0:15)

```
[Action] 상단 통계 카드 (5,819,079 / 14 / 9.0 / 89,884) 천천히 보여주기
[Wait]   3초 — 카메라가 통계를 읽을 시간
[Action] 탭 "Try Semantic JOIN" 이 활성 상태인지 확인
```

### Scene 3: Semantic JOIN 실행 (0:15-0:35) ★ 핵심 장면

```
[Action] 첫 번째 프리셋 "JFK delays + compensation" 클릭
[Wait]   1초 — input에 질문이 채워지는 것 확인
[Action] "Search" 버튼 클릭
[Wait]   8~15초 — API 응답 대기 (양쪽 패널 애니메이션 진행)
         ★ 이 대기 시간에 나레이션이 들어감
[Action] 결과 나오면 2초 대기 — Fabric 패널 + Foundry 패널 결과 보여주기
[Action] 천천히 UNIFIED ANSWER 영역으로 스크롤
[Wait]   3초 — 답변 + citation 배지 읽을 시간
```

### Scene 4: 라우터 다이어그램 (0:35-0:45)

```
[Action] "How does this work?" 또는 "Show explanation" 클릭
[Wait]   1초 — 다이어그램 펼침 애니메이션
[Action] 라우터 다이어그램 전체 보이도록 스크롤
[Wait]   3초 — 다이어그램 읽을 시간
[Action] 4단계 설명 (Single API call → AI Search routes → Fan-out → LLM synthesis) 보여주기
[Wait]   2초
```

### Scene 5: 언어 전환 (0:45-0:52)

```
[Action] 상단 Nav의 🌐 언어 토글 클릭
[Wait]   1초 — 드롭다운 열림
[Action] "EN" 클릭 (또는 현재 한국어면 영어로 전환)
[Wait]   2초 — 페이지 영어로 변환
[Action] 다시 🌐 클릭 → "한국어" 클릭
[Wait]   2초 — 한국어로 복귀
```

### Scene 6: 엔딩 (0:52-1:00)

```
[Action] 스크롤 올려서 "Data lives everywhere — Foundry IQ searches it as one." 보여주기
[Wait]   3초 — 핵심 메시지 읽을 시간
[Action] 화면 녹화 종료
```

---

## Step 2: raw 영상 저장

```bash
# Mac 화면 녹화 파일 위치 (기본값)
~/Desktop/Screen Recording YYYY-MM-DD at HH.MM.SS.mov

# 프로젝트 폴더로 복사
cp ~/Desktop/Screen\ Recording*.mov ~/git/foundry-iq-demos/video/raw_demo.mov
```

---

## Step 3: 영상 편집 에이전트 실행

### 3-1: 컷 포인트 분석 + 트리밍

```python
# Python + OpenCV로 화면 변화 감지
# 로딩 대기 시간 중 변화 없는 구간 자동 감지 → 5초로 압축
# API 응답 대기 중인 구간은 3초로 트리밍 (너무 길면 지루함)
```

### 3-2: 자막 SRT 생성

한국어 자막:
```srt
1
00:00:00,000 --> 00:00:05,000
Knowledge Retrieval Studio — Foundry IQ 데모 앱입니다.

2
00:00:05,000 --> 00:00:12,000
580만 건의 실제 미국 항공편 데이터가 Fabric OneLake에 있습니다.

3
00:00:12,000 --> 00:00:18,000
하나의 질문을 던지면,

4
00:00:18,000 --> 00:00:25,000
AI Search가 통계 데이터와 정책 문서를 동시에 검색합니다.

5
00:00:25,000 --> 00:00:33,000
숫자는 Fabric에서, 규정은 PDF에서 —
인용과 함께 하나의 답변으로 합성됩니다.

6
00:00:33,000 --> 00:00:42,000
AI Search가 라우터 역할을 합니다.
하나의 KB에 질문하면 자동으로 소스를 선택하고 병렬 검색합니다.

7
00:00:42,000 --> 00:00:50,000
5개 언어를 지원합니다.

8
00:00:50,000 --> 00:01:00,000
Data lives everywhere — Foundry IQ searches it as one.
```

영어 자막: (별도 SRT 파일로 동일 구조)

### 3-3: TTS 나레이션 생성

```python
import edge_tts
import asyncio

# 한국어 나레이션
VOICE_KO = "ko-KR-SunHiNeural"  # 여성, 자연스러운 한국어
# 또는 "ko-KR-InJoonNeural"     # 남성

# 영어 나레이션
VOICE_EN = "en-US-AriaNeural"   # 여성, 프로페셔널
# 또는 "en-US-GuyNeural"        # 남성

scripts = [
    {"text": "Knowledge Retrieval Studio — Foundry IQ 데모 앱입니다.", "start": 0, "duration": 5},
    {"text": "580만 건의 실제 미국 항공편 데이터가 Fabric OneLake에 있습니다.", "start": 5, "duration": 7},
    {"text": "하나의 질문을 던지면, AI Search가 통계 데이터와 정책 문서를 동시에 검색합니다.", "start": 12, "duration": 13},
    {"text": "숫자는 Fabric에서, 규정은 PDF에서. 인용과 함께 하나의 답변으로 합성됩니다.", "start": 25, "duration": 8},
    {"text": "AI Search가 라우터 역할을 합니다. 하나의 KB에 질문하면 자동으로 소스를 선택하고 병렬 검색합니다.", "start": 33, "duration": 9},
    {"text": "5개 언어를 지원합니다.", "start": 42, "duration": 8},
    {"text": "Data lives everywhere. Foundry IQ searches it as one.", "start": 50, "duration": 10},
]

async def generate_tts():
    for i, script in enumerate(scripts):
        communicate = edge_tts.Communicate(script["text"], VOICE_KO)
        await communicate.save(f"video/tts/narration_{i:02d}.mp3")
        print(f"✅ narration_{i:02d}.mp3 generated")

asyncio.run(generate_tts())
```

### 3-4: 최종 합성

```bash
# FFmpeg로 합성
# 1. raw 영상 트리밍
ffmpeg -i video/raw_demo.mov -ss 00:00:00 -to 00:02:30 -c copy video/trimmed.mp4

# 2. TTS 오디오 합치기
ffmpeg -i video/tts/narration_00.mp3 -i video/tts/narration_01.mp3 ... \
  -filter_complex "[0:a][1:a]...[6:a]concat=n=7:v=0:a=1" video/narration_full.mp3

# 3. 영상 + 나레이션 + 자막 합성
ffmpeg -i video/trimmed.mp4 \
  -i video/narration_full.mp3 \
  -vf "subtitles=video/subtitles_ko.srt:force_style='FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2'" \
  -c:v libx264 -c:a aac \
  video/foundry_iq_demo_1min_ko.mp4

# 4. 영어 버전도 동일하게
ffmpeg -i video/trimmed.mp4 \
  -i video/narration_en_full.mp3 \
  -vf "subtitles=video/subtitles_en.srt:force_style='FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2'" \
  -c:v libx264 -c:a aac \
  video/foundry_iq_demo_1min_en.mp4
```

---

## 산출물

```
video/
├── raw_demo.mov                        # 원본 화면 녹화 (2~3분)
├── trimmed.mp4                         # 트리밍된 영상 (1분)
├── tts/
│   ├── narration_00.mp3 ~ 06.mp3       # 개별 TTS 클립
│   ├── narration_ko_full.mp3           # 한국어 나레이션 합본
│   └── narration_en_full.mp3           # 영어 나레이션 합본
├── subtitles_ko.srt                    # 한국어 자막
├── subtitles_en.srt                    # 영어 자막
├── foundry_iq_demo_1min_ko.mp4         # ★ 최종 한국어 버전
└── foundry_iq_demo_1min_en.mp4         # ★ 최종 영어 버전
```

---

## 필요 패키지

```bash
# venv에 설치
pip install edge-tts opencv-python-headless numpy

# FFmpeg (Homebrew)
brew install ffmpeg

# 확인
ffmpeg -version
python -c "import edge_tts; print('edge-tts OK')"
python -c "import cv2; print('OpenCV OK')"
```

---

## 주의사항

- raw 영상은 **16:9 비율** 권장 (1920x1080 또는 2560x1440)
- Mac Retina 디스플레이면 실제 해상도가 2배 → FFmpeg에서 스케일 다운 필요할 수 있음
- TTS 생성 시 인터넷 필요 (edge-tts는 Microsoft Edge TTS API 사용)
- 자막 폰트: 한국어는 "Noto Sans KR" 또는 시스템 기본, 영어는 "Inter" 또는 "SF Pro"
- 영상 길이가 1분을 넘으면 Claude Code가 자동으로 속도 조절 (1.2x~1.5x)

---

*Hyeonsang Jeon | 2026.03.26*
