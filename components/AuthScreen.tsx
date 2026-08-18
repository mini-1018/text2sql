"use client";

import { useState } from "react";
import { api, ApiError, setToken } from "@/lib/api";

const FIELD =
  "w-full rounded-md border border-line-2 bg-inset px-[11px] py-2 text-[14.5px] outline-none transition-colors placeholder:text-ink-3 focus:border-accent focus:bg-elevated focus:ring-2 focus:ring-accent-soft";

export default function AuthScreen({ onDone }: { onDone: () => void }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = loginId.trim().length > 0 && password.length > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const { access_token } = await api.login({
        login_id: loginId.trim(),
        password,
      });
      setToken(access_token);
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6 py-8">
      <div className="w-full max-w-[360px]">
        <h1 className="mb-1.5 font-serif text-[27px] font-bold tracking-[-0.015em]">
          상품 재고·발주 관리 챗봇
        </h1>
        <p className="mb-[26px] text-[14px] text-ink-2">
          상품 재고와 입출고 내역에 자연어로 질문하고, 발주까지 처리합니다.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-3.5 rounded-md border border-danger-line bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger"
          >
            {error}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <div className="mb-3">
            <label
              htmlFor="login-id"
              className="mb-1.5 block text-[12px] font-semibold text-ink-2"
            >
              아이디
            </label>
            <input
              id="login-id"
              autoComplete="username"
              autoFocus
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="아이디를 입력하세요"
              className={FIELD}
            />
          </div>

          <div className="mb-3">
            <label
              htmlFor="password"
              className="mb-1.5 block text-[12px] font-semibold text-ink-2"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className={FIELD}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 w-full cursor-pointer rounded-md bg-ink px-3.5 py-2.5 text-[14.5px] font-medium text-canvas transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "로그인 중…" : "로그인"}
          </button>
        </form>
        <div className="mt-5 border-t border-line pt-[18px] text-center text-[13.5px] text-ink-2"></div>
      </div>
    </div>
  );
}
