"use client";

import { useEffect, useRef } from "react";
import { IconArrowUp } from "./icons";

const KBD =
  "rounded-sm border border-line-2 bg-inset px-[5px] py-px text-[11px] text-ink-2";

export default function Composer({
  value,
  onChange,
  onSend,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // 입력 길이에 따라 높이 자동 조절
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !busy;

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 전송, Shift+Enter 줄바꿈. 한글 조합 중에는 전송하지 않는다.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className="shrink-0 bg-linear-to-t from-canvas from-62% to-transparent px-14 pb-5.5 max-md:px-4">
      <div className="mx-auto max-w-measure rounded-[10px] border border-line-2 bg-elevated shadow-card transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="자금 현황을 묻거나 이체를 요청하세요"
          aria-label="메시지 입력"
          className="block max-h-55 w-full resize-none overflow-y-auto border-none bg-transparent px-3.75 pt-3.25 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-ink-3"
        />
        <div className="flex items-center gap-2 pt-1.5 pr-2 pb-2 pl-3.5">
          {/* 물리 키보드가 없는 모바일에서는 단축키 안내를 숨긴다 */}
          <span className="flex-1 text-[12px] text-ink-3 max-sm:hidden">
            <kbd className={KBD}>Enter</kbd> 전송 ·{" "}
            <kbd className={KBD}>Shift</kbd> + <kbd className={KBD}>Enter</kbd>{" "}
            줄바꿈
          </span>
          <span className="hidden flex-1 max-sm:block" aria-hidden />
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="전송"
            title="전송"
            className="grid size-7 cursor-pointer place-items-center rounded-md bg-ink text-canvas transition hover:opacity-85 active:scale-95 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-inset disabled:text-ink-3 disabled:hover:opacity-100"
          >
            <IconArrowUp />
          </button>
        </div>
      </div>
    </div>
  );
}
