# PLAN.md — by_100

GitHub Pages(`<username>.github.io/by_100/`)로 배포되는 정적 웹앱.
빌드 도구 없이 순수 HTML + CSS + Vanilla JS.

## 컨셉

레트로 CRT 터미널. 검정 바탕 + 그린 포스포(`#33ff33`) + 스캔라인 + 글로우.
사용자가 1~100 사이 숫자를 입력하면 매핑된 메시지(짧은 한 줄 ~ 500-1000자 장문)를
타이프라이터 효과로 출력하는 단일 기능 앱.

## 페이지 구성

### `/` — 스플래시
- "100" ANSI Shadow 풍 ASCII 아트 + 위아래 별빛 장식
- 타이프라이터로 부제(`★ ONE HUNDRED NUMBERS, ONE HUNDRED STORIES ★`) → 보조 카피
- 인트로 완료 후 `> press any key to continue _` 가 깜빡임
- **아무 키/탭/클릭** → `./number/` 이동
- 인트로 타이핑 중 입력은 먼저 타이핑 스킵 (실수 방지)

### `/number/` — 숫자 입력 → 메시지
1. 부팅 시퀀스 (`> initializing system... OK` 외 4줄) + fake loading bar
2. 부팅과 JSON fetch 둘 다 완료되면 입력 화면 표시
3. `> ` 프롬프트 + number input + `[enter]` 버튼
4. 결과 박스에 헤더(`>>> NUMBER 042`) + 본문을 타이프라이터로 출력
5. `[retry]` 로 초기화, `[back to menu]` 로 스플래시로 복귀

## 데이터 — `data/numbers/<n>.txt`

각 숫자에 해당하는 텍스트를 개별 파일로 보관 (`1.txt` ~ `100.txt`).

- 파일명: `<숫자>.txt`. 1~100 범위.
- 내용: 자유 길이의 일반 텍스트 또는 인라인 HTML.
- 사용자가 숫자 입력 → 그 순간 해당 파일만 lazy fetch. 진입 시 일괄 로드 없음.
- 파일이 없거나(404) 비어 있으면 fallback 문구 표시.
- 빈 줄로 단락 구분 가능 (`white-space: pre-wrap`).

### 인라인 HTML

타이프라이터가 HTML 태그 구조는 유지하면서 보이는 글자만 한 자씩 출력함
(`Terminal.typewriterHTML` 유틸 사용). 색상이 다른 대사·서술 구분 등이 가능.

```html
<span style="color:#56821c">대사 색</span>
*<span style="color:#999999">서술 색</span>*
```

### 장문 대응

- 결과 박스: `max-height: 60vh` + `overflow-y: auto` (커스텀 스크롤바)
- 타이프라이터 속도 자동 조정:
  - `>600자`: 6ms/char (약 ~5s)
  - `>300자`: 10ms/char
  - 그 외: 14ms/char
- 출력 중 화면 탭/클릭/Space/Enter/Esc → 즉시 완성 (스킵)

## 디렉토리 구조

```
.
├── index.html              # 스플래시 (ASCII 아트)
├── number/index.html       # 숫자 입력 페이지
├── assets/
│   ├── css/
│   │   ├── common.css      # 토큰(--fg/--bg/--glow), 베이스, 스캔라인, 비네팅, 커서
│   │   └── terminal.css    # 컴포넌트 (스플래시 art, 입력, 결과, 토스트)
│   └── js/
│       ├── terminal.js     # Terminal.typewriter / typewriterLines / toast
│       └── number.js       # 부팅/로딩/입력/결과 로직
├── data/
│   └── numbers/            # 1.txt, 2.txt, ..., 100.txt
├── PLAN.md
└── README.md
```

## 외부 자원

- [Galmuri](https://github.com/quiple/galmuri) — 한글 도트 폰트 (jsdelivr CDN)
- Google Fonts — `Press Start 2P` (ASCII 도트 보조)
- 빌드 도구·프레임워크 없음. CDN 한두 개 + 정적 파일

## 배포

1. 저장소 `by_100`에 push (`main` 브랜치)
2. Settings → Pages → Source = `main` / `/` (root)
3. `https://<username>.github.io/by_100/` 접근
4. 모든 자원 경로는 상대 경로라 저장소명이 바뀌어도 동작

## UX/접근성 디테일

- 모바일 퍼스트, 브레이크포인트는 480px 단일 (그 이상은 자연스럽게)
- 타이포는 `clamp()` 로 모바일~데스크탑 사이 가변
- `prefers-reduced-motion: reduce` → 커서 깜빡임 중단
- 부팅 시퀀스와 결과 타이핑 모두 스킵 가능 (다양한 입력으로)
- 키보드만으로도 전부 진행 가능 (Enter로 제출, 1~100 입력)

## 변경 이력

- v0.1 — 초기 기획: Windows XP UI + 숫자 lookup + 선택지 퀴즈 (2 기능)
- v0.2 — UI 톤을 CRT 터미널로 전면 전환 (XP.css 제거)
- v1.0 — 퀴즈 기능 폐기. 단일 기능 앱으로 정리. 루트는 "100" ASCII 아트 스플래시
- v1.1 — 데이터 저장을 `numbers.json` 단일 파일에서 `data/numbers/<n>.txt` 개별 파일로 변경. 입력 시점에 lazy fetch. 인라인 HTML 지원 (`typewriterHTML`)
