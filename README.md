# by_100

레트로 CRT 터미널 톤의 정적 웹앱. 검정 바탕 + 그린 포스포 + 스캔라인.

- **루트 (`/`)** — "100" ASCII 아트 스플래시. 아무 키나 탭/클릭하면 number 페이지로 진입.
- **number lookup (`/number/`)** — 1~100 숫자를 입력하면 매핑된 메시지를 타이프라이터 효과로 출력. 진입 시 부팅 시퀀스 + 로딩 바.

## 로컬에서 실행

`index.html`을 더블클릭하면 `fetch()`가 CORS로 막힙니다. 정적 서버로 띄우세요.

```bash
python3 -m http.server 8000
# → http://localhost:8000/
```

## GitHub Pages 배포

1. 이 폴더 내용을 GitHub 저장소 `by_100`에 push.
2. Repository → Settings → Pages → Source를 `main` / `/` (root).
3. `https://<username>.github.io/by_100/` 접속.

모든 경로는 상대 경로로 작성되어 있어 저장소명이 바뀌어도 동작.

## 데이터 수정 — `data/numbers/<n>.txt`

각 숫자에 해당하는 텍스트를 개별 파일에 저장합니다.

```
data/numbers/
├── 1.txt
├── 2.txt
├── 42.txt
├── ...
└── 100.txt
```

- 파일명은 `<숫자>.txt` (예: `7.txt`, `42.txt`). 1~100 범위.
- 파일 내용은 그대로 본문이 됩니다. 짧은 한 줄부터 500~1000자 장문까지 자유.
- 빈 줄로 단락 구분 가능 — `white-space: pre-wrap` 으로 그대로 보존됨.
- 사용자가 숫자를 입력하면 그 순간 해당 파일만 fetch (lazy). 100개를 미리 다 불러오지 않음.
- 파일이 없거나(404) 비어있으면 fallback 문구 표시.
- 결과 박스는 스크롤되고, 타이프라이터 속도는 본문 길이에 따라 자동 조정. 출력 중 화면을 탭/클릭하면 즉시 완성.

#### 인라인 HTML 지원

`.txt` 파일에 HTML을 그대로 써도 됩니다. 타이프라이터가 태그 구조를 유지한 채 **보이는 글자만** 한 자씩 출력합니다.

```html
<span style="color:#56821c">대사 텍스트는 진한 그린.</span>

*<span style="color:#999999">서술/지문은 회색.</span>*

<em>강조</em>나 <i>이탤릭</i>도 자유롭게.
```

- 색상은 인라인 `style="color:#xxxxxx"` 로 지정. 기본 그린 톤과 너무 동떨어진 색은 가독성이 떨어지니 주의.
- 보안: 파일은 본인이 직접 작성하는 로컬 콘텐츠이므로 HTML이 그대로 렌더됨. **외부에서 받은 텍스트를 그대로 넣지 마세요.**

### 빠르게 전체 채워 넣고 싶다면

쉘에서 한 번에 빈 파일 100개 생성:

```bash
for i in {1..100}; do [ -f "data/numbers/$i.txt" ] || echo "" > "data/numbers/$i.txt"; done
```

그 후 에디터에서 원하는 파일만 열어 내용을 채우면 됩니다.

## 디렉토리 구조

```
.
├── index.html              # 루트 스플래시 (ASCII 아트)
├── number/index.html       # number lookup
├── assets/
│   ├── css/
│   │   ├── common.css      # 팔레트, 베이스, 스캔라인/글로우
│   │   └── terminal.css    # 컴포넌트 스타일 (스플래시, 입력, 결과 등)
│   └── js/
│       ├── terminal.js     # 공통 유틸 (typewriter, toast)
│       └── number.js
├── data/
│   └── numbers/            # 1.txt, 2.txt, ..., 100.txt
├── PLAN.md
└── README.md
```

## 사용 외부 자원

- [Galmuri](https://github.com/quiple/galmuri) — 한글 도트 폰트 (SIL OFL, jsdelivr CDN)
- Google Fonts — `Press Start 2P` (ASCII 도트 보조)

## UX 디테일

- 스플래시에서는 **아무 키/탭/클릭** 으로 number 페이지 진입. 인트로 타이핑 중에 누르면 먼저 타이핑이 즉시 완성됨.
- number 페이지의 부팅 시퀀스/타이프라이터 출력은 **아무 곳이나 탭/클릭 또는 Space/Enter/Esc** 로 즉시 스킵.
- `prefers-reduced-motion: reduce` 설정 시 깜빡이는 커서가 멈춥니다.
