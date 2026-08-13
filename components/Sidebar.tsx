"use client";

import type { Member } from "@/lib/api";
import { groupOf, type Thread } from "@/lib/threads";
import {
  IconDatabase,
  IconLogout,
  IconMessage,
  IconPlus,
  IconTrash,
} from "./icons";

const NAV =
  "flex w-full items-center gap-2 rounded-sm px-2 py-[5px] text-left text-[14px] font-medium text-ink-2 transition-colors hover:bg-hover";

export default function Sidebar({
  collapsed,
  member,
  threads,
  activeId,
  onNew,
  onPick,
  onDelete,
  onSignOut,
}: {
  collapsed: boolean;
  member: Member | null;
  threads: Thread[];
  activeId: string | null;
  onNew: () => void;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
}) {
  // 최신순 정렬 후 날짜 그룹으로 묶는다.
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
  const groups: { label: string; items: Thread[] }[] = [];
  for (const t of sorted) {
    const label = groupOf(t.updatedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(t);
    else groups.push({ label, items: [t] });
  }

  const account = member?.login_id ?? "사용자";
  const initial = account.charAt(0).toUpperCase();

  return (
    <aside
      className={`flex w-[268px] shrink-0 flex-col border-r border-line bg-sidebar transition-[margin] duration-200 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:shadow-pop ${
        collapsed ? "-ml-[268px]" : "ml-0"
      }`}
    >
      <div className="px-2 pt-2.5 pb-1.5">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-[7px] text-left transition-colors hover:bg-hover"
        >
          <span className="grid size-[22px] shrink-0 place-items-center rounded-sm bg-ink text-[11px] font-semibold text-canvas">
            T
          </span>
          <span className="truncate text-[14px] font-semibold tracking-[-0.005em]">
            기업 자금관리 봇
          </span>
        </button>
      </div>

      <nav className="flex flex-col gap-px px-2 pt-0.5 pb-2">
        <button type="button" onClick={onNew} className={`${NAV} cursor-pointer`}>
          <span className="shrink-0 text-ink-3">
            <IconPlus />
          </span>
          새 대화
        </button>
        <div className={NAV}>
          <span className="shrink-0 text-ink-3">
            <IconDatabase />
          </span>
          연결된 데이터베이스
        </div>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2.5 pb-2">
        {threads.length === 0 ? (
          <p className="px-[9px] py-2 text-[13px] leading-normal text-ink-3">
            아직 대화가 없습니다. 첫 질문을 남기면 여기에 기록됩니다.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <div className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
                {g.label}
              </div>
              {g.items.map((t) => (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPick(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(t.id);
                    }
                  }}
                  className={`group flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-[5px] text-left text-[14px] transition-colors hover:bg-hover ${
                    t.id === activeId
                      ? "bg-active font-medium text-ink"
                      : "text-ink-2"
                  }`}
                >
                  <span className="shrink-0">
                    <IconMessage size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <button
                    type="button"
                    aria-label="대화 삭제"
                    title="대화 삭제"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(t.id);
                    }}
                    className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm text-ink-3 opacity-0 transition group-hover:opacity-100 hover:bg-active hover:text-ink"
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={onSignOut}
          title="로그아웃"
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-hover"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-2 text-[11px] font-semibold text-canvas">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">
              {account}
            </span>
            <span className="block truncate text-[12px] text-ink-3">
              로그아웃
            </span>
          </span>
          <span className="shrink-0 text-ink-3">
            <IconLogout />
          </span>
        </button>
      </div>
    </aside>
  );
}
