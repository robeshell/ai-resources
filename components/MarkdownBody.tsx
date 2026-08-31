import type { ReactNode } from "react";

/** Inline spans, longest delimiter first so `**bold**` wins over `*em*`.
 *  Kept as a source string: `inline` recurses into its own matches, so each
 *  call needs its own regex object rather than a shared `lastIndex`. */
const INLINE_SOURCE = "(`[^`\\n]+`)|(\\[[^\\]\\n]+\\]\\([^)\\s]+\\))|(\\*\\*[^*\\n]+\\*\\*)|(__[^_\\n]+__)|(\\*[^*\\n]+\\*)|(_[^_\\n]+_)";

/** Only schemes that cannot execute script; anything else renders as text. */
function safeHref(url: string): string | null {
  const value = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
  if (value.startsWith("/") || value.startsWith("#")) return value;
  return null;
}

function inline(source: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE_SOURCE, "g");
  let cursor = 0;
  let index = 0;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const href = link ? safeHref(link[2]) : null;
      if (link && href) {
        const external = /^https?:\/\//i.test(href);
        nodes.push(
          <a key={key} href={href} {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
            {inline(link[1], key)}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{inline(token.slice(2, -2), key)}</strong>);
    } else {
      nodes.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    }
    cursor = match.index + token.length;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

const HEADING = /^(#{1,4})\s+(.+)$/;
const BULLET = /^\s*[-*+]\s+(.+)$/;
const ORDERED = /^\s*\d+[.)]\s+(.+)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function tableCells(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

/**
 * Markdown rendered straight to React elements — no HTML string is ever built,
 * so Agent-written bodies cannot inject markup. Nested lists are flattened.
 */
export function MarkdownBody({ source }: { source: string }) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const nodes: ReactNode[] = [];
  let cursor = 0;

  // The page owns the <h1>, so the shallowest heading in the body becomes <h2>
  // whether the author started at `#` or at `##`. Without this, a body that
  // starts at `##` would skip a heading level.
  let inFence = false;
  let shallowest = 6;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    else if (!inFence) {
      const heading = line.match(HEADING);
      if (heading) shallowest = Math.min(shallowest, heading[1].length);
    }
  }

  const push = (node: ReactNode) => nodes.push(node);

  while (cursor < lines.length) {
    const line = lines[cursor];
    const key = `md-${nodes.length}`;

    if (line.trimStart().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const body: string[] = [];
      cursor += 1;
      while (cursor < lines.length && !lines[cursor].trimStart().startsWith("```")) {
        body.push(lines[cursor]);
        cursor += 1;
      }
      cursor += 1;
      push(<div className="markdown-code-block" key={key}>
        <div className="markdown-code-header"><span>{language || "code"}</span></div>
        <pre><code {...(language ? { className: `language-${language}` } : {})}>{body.join("\n")}</code></pre>
      </div>);
      continue;
    }

    if (!line.trim()) {
      cursor += 1;
      continue;
    }

    if (RULE.test(line)) {
      push(<hr key={key} />);
      cursor += 1;
      continue;
    }

    if (cursor + 1 < lines.length && line.includes("|") && TABLE_DIVIDER.test(lines[cursor + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      cursor += 2;
      while (cursor < lines.length && lines[cursor].includes("|") && lines[cursor].trim()) {
        rows.push(tableCells(lines[cursor]));
        cursor += 1;
      }
      push(<div className="markdown-table-wrap" key={key}><table>
        <thead><tr>{headers.map((cell, index) => <th key={index}>{inline(cell, `${key}-head-${index}`)}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{inline(row[cellIndex] || "", `${key}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
      </table></div>);
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const Tag = (["h2", "h3", "h4", "h5", "h6"] as const)[Math.min(4, heading[1].length - shallowest)];
      push(<Tag key={key}>{inline(heading[2].trim(), key)}</Tag>);
      cursor += 1;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = !BULLET.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items: string[] = [];
      while (cursor < lines.length) {
        const item = lines[cursor].match(pattern);
        if (!item) break;
        items.push(item[1].trim());
        cursor += 1;
      }
      const children = items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `${key}-${itemIndex}`)}</li>);
      push(ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>);
      continue;
    }

    const quote = line.match(QUOTE);
    if (quote) {
      const quoted: string[] = [];
      while (cursor < lines.length) {
        const next = lines[cursor].match(QUOTE);
        if (!next) break;
        quoted.push(next[1].trim());
        cursor += 1;
      }
      push(<blockquote key={key}><p>{inline(quoted.join(" ").trim(), key)}</p></blockquote>);
      continue;
    }

    const paragraph: string[] = [];
    while (cursor < lines.length) {
      const next = lines[cursor];
      if (!next.trim() || HEADING.test(next) || BULLET.test(next) || ORDERED.test(next) || QUOTE.test(next) || RULE.test(next) || next.trimStart().startsWith("```") || (cursor + 1 < lines.length && next.includes("|") && TABLE_DIVIDER.test(lines[cursor + 1]))) break;
      paragraph.push(next.trim());
      cursor += 1;
    }
    push(<p key={key}>{inline(paragraph.join(" "), key)}</p>);
  }

  return <div className="markdown-body">{nodes}</div>;
}
