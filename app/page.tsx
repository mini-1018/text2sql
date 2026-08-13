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
  IconMoon,
  IconSidebar,
  IconSun,
} from "@/components/icons";
import { api, ApiError, clearToken, getToken, type Member } from "@/lib/api";
import {
  clearThreads,
  loadThreads,
  newThread,
  saveThreads,
  titleFrom,
  uid,
  type Thread,
  type Turn,
} from "@/lib/threads";

const SUGGESTIONS = [
  {
    kind: "조회",
    text: "우리 회사 계좌 잔액을 전부 보여줘",
    note: "담당 계좌만 조회 (행 수준 접근 통제)",
  },
  {
    kind: "통계",
    text: "은행별 잔액 합계를 알려줘",
    note: "GROUP BY 집계",
  },
  {
    kind: "통계",
    text: "최근 3개월 동안 거래분류별 출금액을 알려줘",
    note: "기간 필터 + 분류별 집계",
  },
  {
    kind: "조회",
    text: "500만원 이상 출금된 거래 내역 보여줘",
    note: "조건 필터 + 계좌 조인",
  },
  {
    kind: "작업",
    text: "1번 계좌에서 국민은행 813502-01-338771 동양소재로 300만원 이체해줘",
    note: "기존 이체 API 호출",
  },
];

const ICON_BTN =
  "grid size-7 cursor-pointer place-items-center rounded-sm text-ink-2 transition-colors hover:bg-hover hover:text-ink";

type Status = "checking" | "ok" | "down";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [status, setStatus] = useState<Status>("checking");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);

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

    api
      .me()
      .then((m) => {
        setMember(m);
        setStatus("ok");
        const restored = loadThreads();
        setThreads(restored);
        setActiveId(
          restored.length
            ? [...restored].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
            : null,
        );
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

  /* ---------------- 스레드 변경 시 로컬 저장 ---------------- */
  useEffect(() => {
    if (ready && member) saveThreads(threads);
  }, [threads, ready, member]);

  /* ---------------- 새 메시지 도착 시 하단으로 스크롤 ---------------- */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.turns.length, busy]);

  /* ---------------- 모바일: 사이드바는 기본으로 접어 둔다 ---------------- */
  //  데스크톱은 사이드바가 레이아웃을 차지하지만, 모바일에서는 화면 전체를 덮는
  //  오버레이라 펼친 채로 두면 첫 진입 시 대화 화면이 가려진다.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setCollapsed(true);
  }, []);

  const isMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;

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
      .then((m) => {
        setMember(m);
        const restored = loadThreads();
        setThreads(restored);
        setActiveId(restored.length ? restored[0].id : null);
      })
      .catch(() => clearToken());
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    clearThreads();
    setMember(null);
    setThreads([]);
    setActiveId(null);
    setDraft("");
  }, []);

  const startNew = useCallback(() => {
    const t = newThread();
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
    setDraft("");
  }, []);

  const removeThread = useCallback(
    (id: string) => {
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (id === activeId) {
          const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
          setActiveId(sorted.length ? sorted[0].id : null);
        }
        return next;
      });
    },
    [activeId],
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

      // 활성 스레드가 없으면 새로 만든다.
      let threadId = activeId;
      if (!threadId) {
        const t = newThread();
        threadId = t.id;
        setThreads((prev) => [t, ...prev]);
        setActiveId(t.id);
      }

      const userTurn: Turn = {
        id: uid(),
        role: "user",
        text: message,
        at: Date.now(),
      };

      setDraft("");
      setBusy(true);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                title: t.turns.length === 0 ? titleFrom(message) : t.title,
                turns: [...t.turns, userTurn],
                updatedAt: Date.now(),
              }
            : t,
        ),
      );

      try {
        const record = await api.chat(message);
        setStatus("ok");
        const reply: Turn = {
          id: uid(),
          role: "assistant",
          text: record.response,
          at: new Date(record.created_at).getTime() || Date.now(),
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
    [draft, busy, activeId],
  );

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
                자금 관리를, 질문 하나로.
              </h1>
              <p className="mb-8 max-w-[34rem] text-[15px] text-ink-2">
                계좌 잔액과 입출금 내역에 대한 질문은 실시간으로 SQL로 변환되어
                조회되고, 이체·취소처럼 자금이 움직이는 작업은 검증된 기존 API를
                통해서만 처리됩니다.
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
                  </div>

                  <div
                    className={`prose-reply pl-7 text-[15.5px] leading-[1.72] wrap-break-word whitespace-pre-wrap ${
                      turn.error ? "text-danger" : ""
                    }`}
                  >
                    <RichText text={turn.text} />
                  </div>

                  {turn.role === "assistant" && !turn.error && (
                    <div className="mt-2 flex gap-0.5 pl-7 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => copyTurn(turn)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-[7px] py-[3px] text-[12px] text-ink-3 transition-colors hover:bg-hover hover:text-ink-2"
                      >
                        {copiedId === turn.id ? <IconCheck /> : <IconCopy />}
                        {copiedId === turn.id ? "복사됨" : "복사"}
                      </button>
                    </div>
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
