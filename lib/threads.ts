// 대화 스레드 로컬 저장소.
// 백엔드에 대화 목록 조회 API가 없으므로(POST /chats 만 존재) 브라우저에 보관한다.
// 백엔드에 GET /chats 가 생기면 이 모듈만 교체하면 된다.

export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  error?: boolean;
};

export type Thread = {
  id: string;
  title: string;
  turns: Turn[];
  updatedAt: number;
};

const KEY = "t2s.threads";

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Thread[];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(threads));
  } catch {
    /* 용량 초과 등은 무시 — 저장 실패가 대화를 막지 않도록 */
  }
}

export function clearThreads() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export function newThread(): Thread {
  return { id: uid(), title: "새 대화", turns: [], updatedAt: Date.now() };
}

/** 첫 사용자 메시지로 스레드 제목을 만든다. */
export function titleFrom(message: string): string {
  const flat = message.replace(/\s+/g, " ").trim();
  if (!flat) return "새 대화";
  return flat.length > 34 ? `${flat.slice(0, 34)}…` : flat;
}

/** 사이드바 그룹 라벨 */
export function groupOf(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  if (ts >= startOfToday) return "오늘";
  if (ts >= startOfToday - 86400000) return "어제";
  if (ts >= startOfToday - 86400000 * 7) return "지난 7일";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}
