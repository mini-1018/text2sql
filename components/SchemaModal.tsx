"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type SchemaInfo, type SchemaTable } from "@/lib/api";
import { IconClose, IconKey, IconLink, IconLock } from "./icons";

const BADGE =
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] font-semibold tracking-[0.02em]";

function TableCard({ table }: { table: SchemaTable }) {
  return (
    <section className="rounded-md border border-line bg-elevated">
      <header className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-mono text-[14px] font-semibold">{table.name}</h3>
          {table.row_level_secured && (
            <span
              className={`${BADGE} border-accent/30 bg-accent-soft text-accent`}
              title="조회 시 본인(:current_member_id) 필터가 강제되는 테이블"
            >
              <IconLock size={10} />
              RLS
            </span>
          )}
          {table.row_count !== null && (
            <span className="ml-auto text-[12px] text-ink-3">
              {table.row_count.toLocaleString("ko-KR")}행
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-ink-2">{table.description}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] border-collapse text-left">
          <thead>
            <tr className="text-[11px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
              <th className="px-4 py-2 font-semibold">컬럼</th>
              <th className="px-3 py-2 font-semibold">타입</th>
              <th className="px-3 py-2 font-semibold">설명</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((c) => (
              <tr key={c.name} className="border-t border-line align-top">
                <td className="px-4 py-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <code className="font-mono text-[13px]">{c.name}</code>
                    {c.primary_key && (
                      <span
                        className={`${BADGE} border-line bg-inset text-ink-3`}
                        title="기본키"
                      >
                        <IconKey size={9} />
                        PK
                      </span>
                    )}
                    {c.references && (
                      <span
                        className={`${BADGE} border-line bg-inset text-ink-3`}
                        title={`참조: ${c.references}`}
                      >
                        <IconLink size={9} />
                        {c.references}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap text-ink-3">
                  {c.type}
                  {!c.nullable && (
                    <span className="ml-1 text-ink-3/70">NOT NULL</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[13px] text-ink-2">
                  {c.comment || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SchemaModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<SchemaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .schema()
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "스키마를 불러오지 못했습니다.",
        ),
      );
  }, []);

  // ESC 로 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 md:p-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="데이터베이스 구조"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[52rem] rounded-lg border border-line bg-canvas shadow-pop max-sm:rounded-md"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 rounded-t-lg border-b border-line bg-canvas px-6 py-4 max-sm:px-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[20px] font-bold tracking-[-0.01em]">
              데이터베이스 구조
            </h2>
            <p className="mt-1 text-[13px] text-ink-2">
              챗봇이 질문에 답할 때 조회하는 테이블입니다. 아래 구조가 그대로
              LLM 프롬프트에 전달되어 SQL이 생성됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-ink-2 transition-colors hover:bg-hover hover:text-ink"
          >
            <IconClose />
          </button>
        </header>

        <div className="px-6 py-5 max-sm:px-4">
          {error && (
            <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger">
              {error}
            </div>
          )}

          {!data && !error && (
            <p className="py-8 text-center text-[14px] text-ink-3">
              불러오는 중…
            </p>
          )}

          {data && (
            <>
              <div className="mb-5 rounded-md border border-line bg-inset px-4 py-3 text-[13px] text-ink-2">
                <span className="font-semibold text-ink">RLS</span> 표시가 붙은
                테이블은 조회 SQL에{" "}
                <code className="font-mono text-[12px]">
                  member_id = :current_member_id
                </code>{" "}
                필터가 없으면 검증 단계에서 거부됩니다. 담당자는 본인이 관리하는
                상품과 입출고 이력만 조회할 수 있습니다.
              </div>

              <div className="flex flex-col gap-5">
                {data.tables.map((t) => (
                  <TableCard key={t.name} table={t} />
                ))}
              </div>

              {data.relationships.length > 0 && (
                <section className="mt-6">
                  <h3 className="mb-2 text-[11px] font-semibold tracking-[0.05em] text-ink-3 uppercase">
                    테이블 관계
                  </h3>
                  <ul className="rounded-md border border-line">
                    {data.relationships.map((r, i) => (
                      <li
                        key={`${r.parent}-${r.child}-${i}`}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-line px-4 py-2.5 text-[13px] not-last:border-b"
                      >
                        <code className="font-mono text-[12.5px]">
                          {r.parent}
                        </code>
                        <span className="text-ink-3">→</span>
                        <code className="font-mono text-[12.5px]">
                          {r.child}
                        </code>
                        <span className="text-ink-2">{r.note}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
