"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import Composer from "@/components/Composer";
import RichText from "@/components/RichText";
import SchemaModal from "@/components/SchemaModal";
import Sidebar from "@/components/Sidebar";
import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconDatabase,
  IconMoon,
  IconSidebar,
  IconSun,
} from "@/components/icons";
import { api, ApiError, clearToken, getToken, type Member } from "@/lib/api";
import {
  buildThreads,
  parseUtc,
  titleFrom,
  todayId,
  uid,
  type Thread,
  type Turn,
} from "@/lib/threads";

const SUGGESTIONS = [
  {
    kind: "조회",
    text: "재고가 부족해서 발주해야 할 상품 알려줘",
    note: "안전재고 미달 판정 (담당 상품만 조회)",
  },
  {
    kind: "통계",
    text: "카테고리별 재고 금액 합계를 알려줘",
    note: "GROUP BY 집계 + 수량×단가 계산",
  },
  {
    kind: "통계",
    text: "최근 3개월 사유별 출고량 알려줘",
    note: "기간 필터 + 사유분류별 집계",
  },
  {
    kind: "조회",
    text: "90일 동안 안 나간 상품 있어?",
    note: "NOT EXISTS 로 장기 미출고 탐지",
  },
  {
    kind: "작업",
    text: "3번 상품 200개 발주해줘",
    note: "확인 카드 → 버튼으로만 확정 (LLM 실행 권한 없음)",
  },
];

/** 응답 경로 배지 라벨 */
const SOURCE_LABEL: Record<string, string> = {
  catalog: "카탈로그 매칭",
  generated: "SQL 생성",
  action: "작업",
  general: "대화",
};

const ICON_BTN =
  "grid size-7 cursor-pointer place-items-center rounded-sm text-ink-2 transition-colors hover:bg-hover hover:text-ink";

//  Tailwind 의 md 브레이크포인트(48rem = 768px)와 맞춘다.
//  이 폭 미만에서 사이드바는 레이아웃을 차지하지 않고 화면을 덮는 오버레이가 된다.
const MOBILE_QUERY = "(max-width: 767px)";

const isMobile = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;

type Status = "checking" | "ok" | "down";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [status, setStatus] = useState<Status>("checking");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  //  초기값부터 모바일이면 접힌 상태로 시작한다.
  //  (사이드바는 ready && member 이후에만 렌더되므로 하이드레이션 불일치가 없다)
  const [collapsed, setCollapsed] = useState(isMobile);
  const [dark, setDark] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  //  'SQL 보기'가 열려 있는 턴 id 집합
  const [sqlOpen, setSqlOpen] = useState<Set<string>>(new Set());
  //  확인/취소 요청이 진행 중인 발주 id (버튼 중복 클릭 방지)
  const [pendingBusy, setPendingBusy] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );

  /* ---------------- 초기화: 토큰 검증 + 로컬 스레드 복원 ---------------- */
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");

    const token = getToken();
    if (!token) {
      setStatus("ok");
      setReady(true);
      return;
    }

    //  프로필 확인 후 서버에서 대화 이력을 불러와 스레드를 복원한다.
    //  (이력의 원본은 서버 — 브라우저를 바꿔도 유지된다)
    api
      .me()
      .then(async (m) => {
        setMember(m);
        setStatus("ok");
        try {
          const restored = buildThreads(await api.chatHistory());
          setThreads(restored);
          setActiveId(restored.length ? restored[0].id : null);
        } catch {
          /* 이력 로드 실패는 치명적이지 않다 — 빈 상태로 시작 */
        }
      })
      .catch((err) => {
        // 토큰 만료/무효 → 로그인 화면으로. 네트워크 오류는 상태 배지로 표시.
        if (err instanceof ApiError && err.status === 0) setStatus("down");
        else {
          clearToken();
          setStatus("ok");
        }
      })
      .finally(() => setReady(true));
  }, []);

  /* ---------------- 새 메시지 도착 시 하단으로 스크롤 ---------------- */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.turns.length, busy]);

  /* ---------------- 모바일: 사이드바는 항상 접힌 채로 시작 ---------------- */
  //  로그인 화면 → 워크스페이스로 넘어오는 시점에도 다시 확인한다.
  //  (마운트 시 1회만 검사하면 그 사이 상태가 어긋났을 때 열린 채로 진입한다)
  useEffect(() => {
    if (member && isMobile()) setCollapsed(true);
  }, [member]);

  //  가로 → 세로 회전 등으로 모바일 폭이 되면 접는다.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setCollapsed(true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // 모바일에서 항목을 고르면 사이드바를 닫아 바로 대화가 보이게 한다.
  const closeSidebarOnMobile = useCallback(() => {
    if (isMobile()) setCollapsed(true);
  }, []);

  /* ---------------- 액션 ---------------- */
  const toggleTheme = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute(
      "data-theme",
      next ? "dark" : "light",
    );
    try {
      localStorage.setItem("t2s.theme", next ? "dark" : "light");
    } catch {
      /* noop */
    }
  }, [dark]);

  const afterAuth = useCallback(() => {
    api
      .me()
      .then(async (m) => {
        setMember(m);
        try {
          const restored = buildThreads(await api.chatHistory());
          setThreads(restored);
          setActiveId(restored.length ? restored[0].id : null);
        } catch {
          /* 이력 없이 시작 */
        }
      })
      .catch(() => clearToken());
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setMember(null);
    setThreads([]);
    setActiveId(null);
    setDraft("");
  }, []);

  //  스레드 = 하루 단위. "새 대화"는 오늘 스레드로 이동한다 (없으면 생성).
  const startNew = useCallback(() => {
    const id = todayId();
    setThreads((prev) =>
      prev.some((t) => t.id === id)
        ? prev
        : [{ id, title: "새 대화", turns: [], updatedAt: Date.now() }, ...prev],
    );
    setActiveId(id);
    setDraft("");
  }, []);

  //  스레드 삭제 = 그 날의 대화를 서버에서 소프트 삭제 (다시 로그인해도 안 보인다)
  const removeThread = useCallback(
    (id: string) => {
      const target = threads.find((t) => t.id === id);
      const chatIds = [
        ...new Set(
          (target?.turns ?? [])
            .map((x) => x.chatId)
            .filter((x): x is number => typeof x === "number"),
        ),
      ];
      void Promise.allSettled(chatIds.map((cid) => api.deleteChat(cid)));

      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (id === activeId) {
          const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
          setActiveId(sorted.length ? sorted[0].id : null);
        }
        return next;
      });
    },
    [activeId, threads],
  );

  const copyTurn = useCallback((turn: Turn) => {
    navigator.clipboard?.writeText(turn.text).then(
      () => {
        setCopiedId(turn.id);
        setTimeout(() => setCopiedId(null), 1400);
      },
      () => {
        /* 클립보드 권한 없음 — 무시 */
      },
    );
  }, []);

  const send = useCallback(
    async (raw?: string) => {
      const message = (raw ?? draft).trim();
      if (!message || busy) return;

      // 새 메시지는 항상 오늘 스레드에 쌓인다 (이력이 하루 단위이므로).
      const threadId = todayId();
      const userTurn: Turn = {
        id: uid(),
        role: "user",
        text: message,
        at: Date.now(),
      };

      setDraft("");
      setBusy(true);
      setActiveId(threadId);
      setThreads((prev) => {
        const exists = prev.some((t) => t.id === threadId);
        const base = exists
          ? prev
          : [
              { id: threadId, title: titleFrom(message), turns: [], updatedAt: Date.now() },
              ...prev,
            ];
        return base.map((t) =>
          t.id === threadId
            ? {
                ...t,
                title: t.turns.length === 0 ? titleFrom(message) : t.title,
                turns: [...t.turns, userTurn],
                updatedAt: Date.now(),
              }
            : t,
        );
      });

      try {
        const record = await api.chat(message);
        setStatus("ok");
        const p = record.pending_order;
        const reply: Turn = {
          id: uid(),
          chatId: record.id,
          role: "assistant",
          text: record.response,
          // 서버는 naive UTC 를 주므로 반드시 parseUtc 로 해석 (KST 표시가 어긋나지 않게)
          at: parseUtc(record.created_at),
          meta: record.meta
            ? {
                source: record.meta.source,
                templateName: record.meta.template_name,
                elapsedMs: record.meta.elapsed_ms,
                sql: record.meta.sql,
              }
            : undefined,
          pending: p
            ? {
                orderId: p.id,
                productLabel: `${p.product_sku} ${p.product_name}`,
                supplierLabel: p.expected_date
                  ? `${p.supplier_name} · 입고예정 ${p.expected_date}`
                  : p.supplier_name,
                quantity: p.quantity,
                unit: p.unit,
                totalAmount: Number(p.total_amount),
                stockBefore: p.stock_before,
                stockAfter: p.stock_after,
              }
            : undefined,
        };
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? { ...t, turns: [...t.turns, reply], updatedAt: Date.now() }
              : t,
          ),
        );
      } catch (err) {
        const isApi = err instanceof ApiError;
        if (isApi && (err as ApiError).status === 0) setStatus("down");

        // 토큰 만료면 로그인 화면으로 되돌린다.
        if (isApi && (err as ApiError).status === 401) {
          clearToken();
          setMember(null);
          setBusy(false);
          return;
        }

        const reply: Turn = {
          id: uid(),
          role: "assistant",
          text: isApi
            ? (err as ApiError).message
            : "응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.",
          at: Date.now(),
          error: true,
        };
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? { ...t, turns: [...t.turns, reply], updatedAt: Date.now() }
              : t,
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [draft, busy],
  );

  /* ---------------- 발주 확인 카드 ---------------- */
  //  스레드 안의 특정 턴을 부분 갱신한다 (확인/취소 후 카드 상태 고정용)
  const patchTurn = useCallback(
    (turnId: string, patch: (turn: Turn) => Turn) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.turns.some((x) => x.id === turnId)
            ? { ...t, turns: t.turns.map((x) => (x.id === turnId ? patch(x) : x)) }
            : t,
        ),
      );
    },
    [],
  );

  const appendAssistant = useCallback(
    (threadId: string, text: string, error = false) => {
      const turn: Turn = { id: uid(), role: "assistant", text, at: Date.now(), error };
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, turns: [...t.turns, turn], updatedAt: Date.now() }
            : t,
        ),
      );
    },
    [],
  );

  const resolvePending = useCallback(
    async (turn: Turn, action: "confirm" | "cancel") => {
      if (!turn.pending || turn.pending.resolved || !activeId) return;
      const orderId = turn.pending.orderId;
      const label = turn.pending.productLabel;
      setPendingBusy(orderId);
      try {
        if (action === "confirm") {
          const r = await api.confirmOrder(orderId);
          patchTurn(turn.id, (x) => ({
            ...x,
            pending: { ...x.pending!, resolved: "confirmed" },
          }));
          appendAssistant(
            activeId,
            [
              "발주가 확정되어 입고 처리되었습니다.",
              `- 발주번호: ${r.id}`,
              `- 상품: ${label}`,
              `- 수량: ${r.quantity.toLocaleString("ko-KR")}개`,
              `- 발주금액: ${Number(r.total_amount).toLocaleString("ko-KR")}원`,
            ].join("\n"),
          );
        } else {
          await api.cancelOrder(orderId);
          patchTurn(turn.id, (x) => ({
            ...x,
            pending: { ...x.pending!, resolved: "canceled" },
          }));
          appendAssistant(activeId, "발주가 취소되었습니다.");
        }
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "요청을 처리하지 못했습니다.";
        // 만료된 PENDING 은 백엔드가 자동 취소한다 — 카드도 만료로 고정
        if (msg.includes("유효시간")) {
          patchTurn(turn.id, (x) => ({
            ...x,
            pending: { ...x.pending!, resolved: "expired" },
          }));
        }
        appendAssistant(activeId, msg, true);
      } finally {
        setPendingBusy(null);
      }
    },
    [activeId, appendAssistant, patchTurn],
  );

  const toggleSql = useCallback((turnId: string) => {
    setSqlOpen((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  }, []);

  /* ---------------- 렌더 ---------------- */
  if (!ready) return <div className="min-h-dvh bg-canvas" />;
  if (!member) return <AuthScreen onDone={afterAuth} />;

  const turns = active?.turns ?? [];
  const account = member.login_id;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        member={member}
        threads={threads}
        activeId={activeId}
        onNew={() => {
          startNew();
          closeSidebarOnMobile();
        }}
        onPick={(id) => {
          setActiveId(id);
          closeSidebarOnMobile();
        }}
        onDelete={removeThread}
        onSignOut={signOut}
        onOpenSchema={() => {
          setSchemaOpen(true);
          closeSidebarOnMobile();
        }}
      />

      {/* 모바일에서 사이드바가 열려 있을 때만 배경을 덮는다 (탭하면 닫힘) */}
      {!collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          aria-hidden
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
        />
      )}

      {schemaOpen && <SchemaModal onClose={() => setSchemaOpen(false)} />}

      <main className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex h-[45px] shrink-0 items-center gap-1 border-b border-line px-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="사이드바 토글"
            title="사이드바 토글"
            className={ICON_BTN}
          >
            <IconSidebar />
          </button>
          <div className="min-w-0 flex-1 truncate rounded-sm px-1.75 py-0.75 text-[14px] font-medium">
            {active?.title ?? "새 대화"}
          </div>
          {/* 좁은 화면에서는 점만 남기고 문구는 숨긴다 */}
          <div
            title={status === "down" ? "서버 연결 끊김" : "서버 연결됨"}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line py-0.75 pr-2.25 pl-2 text-[12px] text-ink-2 max-sm:border-0 max-sm:px-1"
          >
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                status === "ok"
                  ? "bg-ok"
                  : status === "down"
                    ? "bg-danger"
                    : "bg-ink-3"
              }`}
            />
            <span className="max-sm:hidden">
              {status === "down" ? "서버 연결 끊김" : "서버 연결됨"}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="테마 전환"
            title="테마 전환"
            className={ICON_BTN}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
        </header>

        <div className="flex-1 scroll-smooth overflow-y-auto" ref={scrollRef}>
          {turns.length === 0 ? (
            <section className="mx-auto max-w-measure px-14 pt-24 pb-6 max-md:px-5.5">
              <h1 className="mb-2.5 font-serif text-[38px] leading-tight font-bold tracking-[-0.018em] max-md:text-[30px]">
                재고 관리를, 질문 하나로.
              </h1>
              <p className="mb-8 max-w-[34rem] text-[15px] text-ink-2">
                재고 현황과 입출고 이력에 대한 질문은 검수된 쿼리 카탈로그에서
                찾거나 실시간 SQL로 변환되어 조회되고, 발주처럼 재고가 움직이는
                작업은 확인 절차를 거쳐 검증된 API로만 처리됩니다.
              </p>

              <div className="mb-2 text-[11px] font-semibold tracking-[0.05em] text-ink-3 uppercase">
                이렇게 물어보세요
              </div>
              <div className="border-t border-line">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    onClick={() => send(s.text)}
                    className="group flex w-full cursor-pointer items-start gap-[11px] border-b border-line py-3.25 pr-2.5 pl-2 text-left transition-colors hover:bg-hover"
                  >
                    <span className="mt-0.5 min-w-[60px] shrink-0 rounded-sm border border-line bg-inset px-1.5 py-0.5 text-center text-[10px] font-semibold tracking-[0.05em] text-ink-3">
                      {s.kind}
                    </span>
                    <span className="min-w-0 flex-1 text-[14.5px]">
                      {s.text}
                      <span className="mt-0.5 block text-[12.5px] text-ink-3">
                        {s.note}
                      </span>
                    </span>
                    <span className="mt-[3px] shrink-0 -translate-x-[3px] text-ink-3 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                      <IconArrowRight />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="mx-auto max-w-measure px-14 pt-10 pb-6 max-md:px-5.5">
              {turns.map((turn) => (
                <article key={turn.id} className="group mb-7.5 animate-rise">
                  <div className="mb-[7px] flex items-center gap-2">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-sm text-[10px] font-semibold ${
                        turn.role === "user"
                          ? "border border-line bg-inset text-ink-2"
                          : "bg-ink text-canvas"
                      }`}
                    >
                      {turn.role === "user"
                        ? account.charAt(0).toUpperCase()
                        : "T"}
                    </span>
                    <span className="text-[13px] font-semibold">
                      {turn.role === "user" ? account : "Assistant"}
                    </span>
                    <span className="text-[12px] text-ink-3">
                      {new Date(turn.at).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {turn.meta && (
                      <span
                        className="text-[11px] text-ink-3"
                        title="응답 처리 경로 · 소요 시간"
                      >
                        · {SOURCE_LABEL[turn.meta.source] ?? turn.meta.source}
                        {turn.meta.templateName
                          ? ` — ${turn.meta.templateName}`
                          : ""}{" "}
                        · {(turn.meta.elapsedMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>

                  <div
                    className={`prose-reply pl-7 text-[15.5px] leading-[1.72] wrap-break-word whitespace-pre-wrap ${
                      turn.error ? "text-danger" : ""
                    }`}
                  >
                    <RichText text={turn.text} />
                  </div>

                  {turn.pending && (
                    <div className="mt-3 ml-7 max-w-104 rounded-lg border border-line-2 bg-elevated shadow-card">
                      <div className="border-b border-line px-4 py-2.5 text-[12px] font-semibold tracking-wider text-ink-3 uppercase">
                        발주 확인
                      </div>
                      <dl className="grid grid-cols-[68px_1fr] gap-x-3 gap-y-1.5 px-4 py-3 text-[13.5px]">
                        <dt className="text-ink-3">상품</dt>
                        <dd className="m-0">{turn.pending.productLabel}</dd>
                        <dt className="text-ink-3">공급업체</dt>
                        <dd className="m-0">{turn.pending.supplierLabel}</dd>
                        <dt className="text-ink-3">수량</dt>
                        <dd className="m-0 font-semibold">
                          {turn.pending.quantity.toLocaleString("ko-KR")}
                          {turn.pending.unit}
                        </dd>
                        <dt className="text-ink-3">발주금액</dt>
                        <dd className="m-0 font-semibold">
                          {turn.pending.totalAmount.toLocaleString("ko-KR")}원
                        </dd>
                        <dt className="text-ink-3">입고 후</dt>
                        <dd className="m-0 text-ink-2">
                          재고 {turn.pending.stockBefore.toLocaleString("ko-KR")}
                          {" → "}
                          {turn.pending.stockAfter.toLocaleString("ko-KR")}
                          {turn.pending.unit}
                        </dd>
                      </dl>
                      <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
                        {turn.pending.resolved ? (
                          <span
                            className={`text-[12.5px] font-medium ${
                              turn.pending.resolved === "confirmed"
                                ? "text-ok"
                                : "text-ink-3"
                            }`}
                          >
                            {turn.pending.resolved === "confirmed"
                              ? "확정 완료"
                              : turn.pending.resolved === "canceled"
                                ? "취소됨"
                                : "유효시간 만료"}
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={pendingBusy === turn.pending.orderId}
                              onClick={() => resolvePending(turn, "confirm")}
                              className="cursor-pointer rounded-md bg-ink px-3.5 py-1.5 text-[13px] font-medium text-canvas transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {pendingBusy === turn.pending.orderId
                                ? "처리 중…"
                                : "발주 확정"}
                            </button>
                            <button
                              type="button"
                              disabled={pendingBusy === turn.pending.orderId}
                              onClick={() => resolvePending(turn, "cancel")}
                              className="cursor-pointer rounded-md border border-line-2 px-3.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              취소
                            </button>
                            <span className="ml-auto text-[11.5px] text-ink-3">
                              5분 내 확인
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {turn.role === "assistant" && !turn.error && (
                    <div className="mt-2 flex gap-0.5 pl-7 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => copyTurn(turn)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1.75 py-0.75 text-[12px] text-ink-3 transition-colors hover:bg-hover hover:text-ink-2"
                      >
                        {copiedId === turn.id ? <IconCheck /> : <IconCopy />}
                        {copiedId === turn.id ? "복사됨" : "복사"}
                      </button>
                      {turn.meta?.sql && (
                        <button
                          type="button"
                          onClick={() => toggleSql(turn.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1.75 py-0.75 text-[12px] text-ink-3 transition-colors hover:bg-hover hover:text-ink-2"
                        >
                          <IconDatabase size={12} />
                          {sqlOpen.has(turn.id) ? "SQL 닫기" : "SQL 보기"}
                        </button>
                      )}
                    </div>
                  )}

                  {turn.meta?.sql && sqlOpen.has(turn.id) && (
                    <pre className="mt-2 ml-7 overflow-x-auto rounded-md border border-line bg-inset px-3.5 py-3 font-mono text-[12px] leading-relaxed text-ink-2">
                      {turn.meta.sql}
                    </pre>
                  )}
                </article>
              ))}

              {busy && (
                <div className="mb-7.5">
                  <div className="mb-[7px] flex items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-ink text-[10px] font-semibold text-canvas">
                      T
                    </span>
                    <span className="text-[13px] font-semibold">Assistant</span>
                  </div>
                  <div className="flex items-center gap-[7px] pl-7 text-[14px] text-ink-3">
                    <span className="inline-flex gap-[3px]">
                      <i className="size-1 animate-blink rounded-full bg-current" />
                      <i className="size-1 animate-blink rounded-full bg-current [animation-delay:0.16s]" />
                      <i className="size-1 animate-blink rounded-full bg-current [animation-delay:0.32s]" />
                    </span>
                    데이터를 조회하는 중
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Composer
          value={draft}
          onChange={setDraft}
          onSend={() => send()}
          busy={busy}
        />
      </main>
    </div>
  );
}
