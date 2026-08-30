import type { ReactNode } from "react";

export function MarkdownBody({ source }: { source: string }) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;
  const flushParagraph = () => {
    if (paragraph.length) nodes.push(<p key={`p-${nodes.length}`}>{paragraph.join(" ")}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) nodes.push(<ul key={`ul-${nodes.length}`}>{list.map((item, index) => <li key={index}>{item}</li>)}</ul>);
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph(); flushList();
      if (code) { nodes.push(<pre key={`pre-${nodes.length}`}><code>{code.join("\n")}</code></pre>); code = null; }
      else code = [];
      continue;
    }
    if (code) { code.push(line); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      nodes.push(level === 1 ? <h2 key={`h-${nodes.length}`}>{heading[2]}</h2> : level === 2 ? <h3 key={`h-${nodes.length}`}>{heading[2]}</h3> : <h4 key={`h-${nodes.length}`}>{heading[2]}</h4>);
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph(); list.push(line.replace(/^[-*]\s+/, ""));
    } else if (!line.trim()) {
      flushParagraph(); flushList();
    } else paragraph.push(line.trim());
  }
  flushParagraph(); flushList();
  return <div className="markdown-body">{nodes}</div>;
}
