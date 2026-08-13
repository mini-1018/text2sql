import { Fragment, type ReactNode } from "react";

// 모델 응답에 자주 섞이는 최소한의 마크다운만 처리한다.
// (**굵게**, `코드`, "- " 목록) — 무거운 마크다운 파서를 쓰지 않기 위한 의도적 축소.
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export default function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const bullet = /^\s*[-•*]\s+/.test(line);
        const body = bullet ? line.replace(/^\s*[-•*]\s+/, "· ") : line;
        return (
          <Fragment key={i}>
            {bullet ? (
              <span className="line-bullet">{renderInline(body, `l${i}`)}</span>
            ) : (
              renderInline(body, `l${i}`)
            )}
            {i < lines.length - 1 && !bullet && "\n"}
          </Fragment>
        );
      })}
    </>
  );
}
