# test-web

기업 자금관리 Text-to-SQL 챗봇의 웹 UI. Next.js(App Router) + TypeScript + Tailwind CSS v4.

## 실행

백엔드를 먼저 띄운 뒤:

```bash
cd text-to-sql
python seed.py                      # 최초 1회 — 데모 계정과 샘플 데이터 생성
uvicorn app.main:app --reload
```

웹을 실행한다:

```bash
cd test-web
npm install
npm run dev
```

http://localhost:3000 접속 후 `admin` / `asd159!@` 로 로그인.

## 백엔드 연결 방식

`app/main.py` 에 CORS 미들웨어가 없기 때문에 브라우저에서 `localhost:8000` 을 직접 호출하면
차단된다. 그래서 **백엔드를 수정하는 대신** Next.js 서버가 프록시한다:

```
브라우저 → /api/*  →  (Next 서버 rewrites)  →  http://127.0.0.1:8000/*
```

설정은 [`next.config.mjs`](./next.config.mjs) 한 곳에 있다. 백엔드 주소를 바꾸려면
`.env.local.example` 을 `.env.local` 로 복사하고 `API_ORIGIN` 을 수정한다.

## 사용하는 API

| 엔드포인트 | 용도 |
| --- | --- |
| `POST /members/login` | 아이디/비밀번호 로그인 → `access_token` |
| `GET /members/me` | 토큰 검증 |
| `POST /chats` | 채팅 (Query / Action / General 라우팅) |

회원가입 화면은 제공하지 않는다. 계정은 백엔드 `seed.py` 로 생성한다.
JWT는 `localStorage` 의 `t2s.token` 에 저장하고 `Authorization: Bearer` 로 전송한다.

## 스타일링

Tailwind CSS v4 (CSS-first 설정 — `tailwind.config.js` 없음).
디자인 토큰은 전부 [`app/globals.css`](./app/globals.css) 한 파일에 있다.

```
:root / [data-theme="dark"]   원본 CSS 변수 (--c-canvas, --c-ink …)
@theme inline                 위 변수를 참조하는 Tailwind 토큰
                              → bg-canvas, text-ink-2, border-line, max-w-measure …
@layer base                   본문 타이포그래피, 스크롤바
@layer components             유틸리티로 표현하기 번거로운 2개 (prose-reply, line-bullet)
```

`@theme inline` 이라 토큰이 CSS 변수를 **참조**하므로, `<html data-theme>` 만 바꾸면
빌드된 유틸리티가 그대로 다크 테마를 따라간다.

색상 토큰: `canvas` `sidebar` `inset` `elevated` / `ink` `ink-2` `ink-3` /
`line` `line-2` `hover` `active` / `accent` `accent-soft` `danger` `ok`

## 대화 목록에 관하여

백엔드에 대화 이력 **조회** API가 없다(`POST /chats` 만 존재). 사이드바의 대화 목록은
브라우저 `localStorage`(`t2s.threads`)에 보관하므로 다른 기기에서는 보이지 않는다.
백엔드에 `GET /chats` 가 생기면 [`lib/threads.ts`](./lib/threads.ts) 만 교체하면 된다.

## 구조

```
app/
  layout.tsx      루트 레이아웃 + 테마 부트스트랩(FOUC 방지)
  page.tsx        인증 게이트 + 워크스페이스 전체 상태
  globals.css     Tailwind 진입점 + 디자인 토큰
components/
  AuthScreen.tsx  아이디/비밀번호 로그인
  Sidebar.tsx     대화 목록, 계정
  Composer.tsx    입력창 (Enter 전송, 한글 조합 처리)
  RichText.tsx    응답의 최소 마크다운 렌더링
  icons.tsx       인라인 SVG 아이콘 (이모지 미사용)
lib/
  api.ts          백엔드 호출 래퍼
  threads.ts      대화 로컬 저장소
```

## 참고

- 라이트/다크 테마를 지원하며 최초 진입 시 OS 설정을 따른다. 선택값은 `t2s.theme` 에 저장된다.
- 아이콘은 전부 인라인 SVG이며 이모지를 쓰지 않는다.
