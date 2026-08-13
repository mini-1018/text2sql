// FastAPI 백엔드 호출 래퍼.
//
// NEXT_PUBLIC_API_ORIGIN 이 있으면 브라우저가 백엔드를 직접 호출한다 (프로덕션).
//   → 백엔드의 CORS_ORIGINS 에 이 사이트 오리진이 등록돼 있어야 한다.
//   → Vercel 프록시를 거치지 않으므로 긴 LLM 응답에서 게이트웨이 타임아웃이 나지 않는다.
//
// 없으면 Next.js 서버의 rewrites 프록시(/api)를 쓴다 (로컬 개발 기본값).
//   → next.config.mjs 의 API_ORIGIN 이 대상이 된다.
//
// NEXT_PUBLIC_* 는 빌드 시점에 문자열로 치환되므로, Vercel 에서는 값을 등록한 뒤
// 반드시 재배포해야 반영된다.
const ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN;
const BASE = ORIGIN ? ORIGIN.replace(/\/+$/, "") : "/api";

const TOKEN_KEY = "t2s.token";

export type Member = {
  id: number;
  login_id: string;
  name: string | null;
  dept: string | null;
  company_id: number | null;
  created_at: string;
};

export type ChatRecord = {
  id: number;
  member_id: number;
  request: string;
  response: string;
  created_at: string;
};

export type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
  references: string | null;
  comment: string;
};

export type SchemaTable = {
  name: string;
  description: string;
  row_count: number | null;
  /** 조회 시 :current_member_id 필터가 강제되는 테이블 */
  row_level_secured: boolean;
  columns: SchemaColumn[];
  ddl: string;
};

export type SchemaInfo = {
  tables: SchemaTable[];
  relationships: { parent: string; child: string; note: string }[];
  notes: { allowed_tables: string[]; personal_tables: string[] };
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = false, headers, ...rest } = init;
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");

  if (auth) {
    const token = getToken();
    if (!token) throw new ApiError(401, "로그인이 필요합니다.");
    h.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...rest, headers: h });
  } catch {
    // fetch 가 던지는 경우: 서버 다운, DNS/TLS 실패, 그리고 CORS 차단.
    // 브라우저 보안상 CORS 실패는 일반 네트워크 오류와 구분되지 않는다.
    throw new ApiError(
      0,
      ORIGIN
        ? `백엔드(${ORIGIN})에 연결할 수 없습니다. 서버 상태와 CORS 허용 오리진 설정을 확인해 주세요.`
        : "백엔드에 연결할 수 없습니다. FastAPI 서버가 실행 중인지 확인해 주세요.",
    );
  }

  if (!res.ok) {
    let detail = `요청이 실패했습니다 (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail) && body.detail[0]?.msg)
        detail = body.detail[0].msg;
    } catch {
      /* 본문이 JSON이 아니면 기본 메시지 사용 */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // 회원가입은 제공하지 않는다. 계정은 백엔드 seed.py 로 미리 생성한다.
  login: (body: { login_id: string; password: string }) =>
    request<{ access_token: string }>("/members/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => request<Member>("/members/me", { auth: true }),

  schema: () => request<SchemaInfo>("/schema", { auth: true }),

  chat: (message: string) =>
    request<ChatRecord>("/chats", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ message }),
    }),
};
