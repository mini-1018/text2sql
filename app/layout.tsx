import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "상품 재고·발주 관리 챗봇",
  description:
    "상품 재고와 입출고 내역에 자연어로 질문하면 검수된 쿼리 카탈로그와 실시간 SQL로 조회하고, 발주는 확인 절차를 거쳐 검증된 API로 처리하는 Text-to-SQL 워크스페이스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191919" },
  ],
};

// 첫 페인트 전에 테마를 적용해 깜빡임(FOUC)을 막는다.
const themeBoot = `
(function () {
  try {
    var saved = localStorage.getItem("t2s.theme");
    var dark = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
