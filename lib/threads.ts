// 대화 스레드 모델.
//
// 이력의 원본은 백엔드(chats 테이블)다 — 로그인하면 GET /chats 로 불러와
// "하루 = 스레드 하나"로 묶어 복원한다. 브라우저를 바꿔도 이력이 유지된다.
// (이전 버전은 localStorage 보관이라 휘발성이었다)

import type { ChatRecord } from "./api";

export type TurnMeta = {
  source: "catalog" | "generated" | "action" | "general";
  templateName: string | null;
  elapsedMs: number;
  sql: string | null;
};

export type TurnPending = {
  transferId: number;
  fromLabel: string; // "국민은행 123456-04-011234 (주거래 입출금)"
  toLabel: string; // "국민은행 813502-01-338771 (동양소재)"
  amount: number;
  balanceAfter: number;
  /** 확인/취소/만료 후 카드가 비활성 상태로 남는다 */
  resolved?: "confirmed" | "canceled" | "expired";
};

export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  /** 서버 chats.id — 스레드 삭제 시 이 id 로 DELETE /chats/{id} 를 부른다 */
  chatId?: number;
  error?: boolean;
  meta?: TurnMeta;
  pending?: TurnPending;
};

export type Thread = {
  id: string; // "day-2026-08-14" (브라우저 로컬 = KST 기준 날짜)
  title: string;
  turns: Turn[];
  updatedAt: number;
};

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * 백엔드 타임스탬프 → epoch(ms).
 * 서버는 naive UTC("2026-08-14T03:21:00.123")로 보낸다. 타임존 표기가 없으면
 * JS 가 로컬 시간으로 오해해 KST 에서 9시간 어긋나므로 'Z' 를 붙여 UTC 로 해석한다.
 * 이후 toLocaleTimeString("ko-KR") 등이 브라우저 타임존(KST)으로 변환해 표시한다.
 */
export function parseUtc(value: string): number {
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Date.now() : t;
}

/** 첫 사용자 메시지로 스레드 제목을 만든다. */
export function titleFrom(message: string): string {
  const flat = message.replace(/\s+/g, " ").trim();
  if (!flat) return "새 대화";
  return flat.length > 34 ? `${flat.slice(0, 34)}…` : flat;
}

/** epoch → 그 날짜(로컬 = KST)의 스레드 id */
export function dayIdOf(at: number): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `day-${y}-${m}-${day}`;
}

export const todayId = () => dayIdOf(Date.now());

/** 서버 이력(최신순 배열)을 일자별 스레드로 재구성한다. */
export function buildThreads(records: ChatRecord[]): Thread[] {
  const byDay = new Map<string, Thread>();

  // 오래된 것부터 넣어야 턴 순서가 시간순이 된다.
  for (const r of [...records].reverse()) {
    const at = parseUtc(r.created_at);
    const dayId = dayIdOf(at);

    let thread = byDay.get(dayId);
    if (!thread) {
      thread = { id: dayId, title: titleFrom(r.request), turns: [], updatedAt: at };
      byDay.set(dayId, thread);
    }

    thread.turns.push({
      id: `c${r.id}u`,
      chatId: r.id,
      role: "user",
      text: r.request,
      at,
    });
    thread.turns.push({
      id: `c${r.id}a`,
      chatId: r.id,
      role: "assistant",
      text: r.response,
      at,
      meta: r.meta
        ? {
            source: r.meta.source,
            templateName: r.meta.template_name,
            elapsedMs: r.meta.elapsed_ms,
            sql: r.meta.sql,
          }
        : undefined,
      // PENDING 이체 카드는 복원하지 않는다 — 유효시간 5분이라 이력 시점에는 만료됐다.
    });
    thread.updatedAt = Math.max(thread.updatedAt, at);
  }

  return [...byDay.values()].sort((a, b) => b.updatedAt - a.updatedAt);
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
