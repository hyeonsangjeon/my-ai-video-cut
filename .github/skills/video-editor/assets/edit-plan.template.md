# 편집표

아래 JSON 블록 하나를 실제 입력으로 바꾼다. 이것이 타임라인의 유일한 원본이다.
별도 표에 시작 시각을 중복 작성하지 않는다. `timeline.json`은 CLI로 생성한다.

시간은 원본 기준 정수 밀리초, FPS는 분수, 배속은 0.5~2.0이다.
구간은 `[in_ms, out_ms)`이며 클립 배열의 순서대로 하드컷 연결한다.
`captions: null`은 자막이 없거나 이 작업에서 사용하지 않는다고 명시한 경우다.
미디어/자막 경로는 작업 디렉터리의 안전한 상대 경로만 사용한다.

```json
{
  "version": 1,
  "fps_num": 30,
  "fps_den": 1,
  "width": 1920,
  "height": 1080,
  "sources": [
    {
      "id": "source-a",
      "media": "sources/source-a.mp4",
      "source_duration_ms": 180000,
      "media_origin_ms": 0,
      "media_duration_ms": 180000,
      "captions": "sources/source-a.srt"
    },
    {
      "id": "source-b",
      "media": "sources/source-b.mkv",
      "source_duration_ms": 90000,
      "media_origin_ms": 0,
      "media_duration_ms": 90000,
      "captions": null
    }
  ],
  "clips": [
    {
      "id": "c01",
      "source_id": "source-a",
      "in_ms": 100000,
      "out_ms": 110000,
      "speed": 1,
      "reason": "Core explanation"
    },
    {
      "id": "c02",
      "source_id": "source-b",
      "in_ms": 20000,
      "out_ms": 26000,
      "speed": 1,
      "reason": "Supporting example"
    }
  ]
}
```

## 편집 판단

각 클립의 화면/대사 근거, 연결 이유, 잘리는 문장 여부와 확인하지 못한 내용을
기록한다. 장면 변화 점수만으로 중요한 부분이라고 판단하지 않는다.
다른 출처를 연결해 원래 없던 인과관계나 발언을 만들지 않는다.

## 입력 확인

각 소스의 ffprobe 결과와 자막 시간 기준을 확인한다. 부분 다운로드이면
원본 길이와 로컬 파일 길이를 구분한다. 클립이 로컬 다운로드 범위 안에 있어야 한다.
파일은 메타데이터에 적힌 것만으로 존재한다고 가정하지 않는다.

## 변경 이력

편집표를 변경하면 새 버전에 대해 plan/timeline, 클립, 자막, 음성, 출력을 다시
생성한다. 기존 결과물의 일부를 파일명순으로 합쳐서 재사용하지 않는다.
