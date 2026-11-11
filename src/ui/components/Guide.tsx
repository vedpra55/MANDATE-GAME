import { Fragment, type ReactNode } from 'react';
import guide from '../../../docs/GUIDE.md?raw';
import { strings as S } from '../strings.ts';
import { Stamp } from './Stamp.tsx';

/**
 * The player's guide, in the game. It renders docs/GUIDE.md itself (one source of truth) with a
 * tiny Markdown reader: headings, paragraphs, lists, tables, bold, italics. No HTML is injected.
 */
type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'hr' };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      blocks.push({ kind: 'h', level: h[1]!.length, text: h[2]! });
      i++;
    } else if (t === '---') {
      blocks.push({ kind: 'hr' });
      i++;
    } else if (t.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const cells = lines[i]!.trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push({ kind: 'table', rows });
    } else if (/^(-|\d+\.)\s/.test(t)) {
      const ordered = /^\d+\./.test(t);
      const items: string[] = [];
      while (i < lines.length && lines[i]!.trim()) {
        const l = lines[i]!;
        const m = /^\s*(-|\d+\.)\s+(.*)$/.exec(l);
        if (m) items.push(m[2]!);
        else items[items.length - 1] += ` ${l.trim()}`;
        i++;
      }
      blocks.push({ kind: ordered ? 'ol' : 'ul', items });
    } else {
      const text: string[] = [];
      while (
        i < lines.length &&
        lines[i]!.trim() &&
        !/^(#|\||-\s|\d+\.\s|---)/.test(lines[i]!.trim())
      ) {
        text.push(lines[i]!.trim());
        i++;
      }
      blocks.push({ kind: 'p', text: text.join(' ') });
    }
  }
  return blocks;
}

/** **bold**, _italic_ and `code`, as React nodes. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const s = m[0];
    if (s.startsWith('**')) out.push(<strong key={k++}>{inline(s.slice(2, -2))}</strong>);
    else if (s.startsWith('_')) out.push(<em key={k++}>{inline(s.slice(1, -1))}</em>);
    else out.push(<code key={k++}>{s.slice(1, -1)}</code>);
    last = m.index! + s.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BLOCKS = parse(guide);

export function Guide({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay guide-overlay" onClick={onClose}>
      <div className="overlay-body" onClick={(e) => e.stopPropagation()}>
        <article className="paper guide" aria-label={S.guide.title}>
          {BLOCKS.map((b, i) => {
            switch (b.kind) {
              case 'h':
                return b.level === 1 ? (
                  <h1 key={i}>{inline(b.text)}</h1>
                ) : b.level === 2 ? (
                  <h2 key={i}>{inline(b.text)}</h2>
                ) : (
                  <h3 key={i}>{inline(b.text)}</h3>
                );
              case 'p':
                return <p key={i}>{inline(b.text)}</p>;
              case 'hr':
                return <hr key={i} />;
              case 'ul':
              case 'ol': {
                const Tag = b.kind;
                return (
                  <Tag key={i}>
                    {b.items.map((it, j) => (
                      <li key={j}>{inline(it)}</li>
                    ))}
                  </Tag>
                );
              }
              case 'table':
                return (
                  <table key={i}>
                    <thead>
                      <tr>
                        {b.rows[0]!.map((c, j) => (
                          <th key={j}>{inline(c)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.slice(1).map((r, j) => (
                        <tr key={j}>
                          {r.map((c, n) => (
                            <td key={n}>{inline(c)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
            }
            return <Fragment key={i} />;
          })}
        </article>
        <div className="guide-close">
          <Stamp onClick={onClose}>{S.guide.close}</Stamp>
        </div>
      </div>
    </div>
  );
}
