// FastAPI 백엔드 호출 래퍼.
// next.config.mjs 의 rewrites 를 통해 /api/* → http://127.0.0.1:8000/* 로 프록시된다.
// (백엔드에 CORS 미들웨어가 없으므로 브라우저에서 직접 호출하지 않는다)

const BASE = "/api";
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
    throw new ApiError(
      0,
      "백엔드에 연결할 수 없습니다. FastAPI 서버가 실행 중인지 확인해 주세요.",
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

  chat: (message: string) =>
    request<ChatRecord>("/chats", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ message }),
    }),
};
