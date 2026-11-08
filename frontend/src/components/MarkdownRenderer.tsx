import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
  onSourceClick?: (sourceTitle: string) => void
}

export function MarkdownRenderer({ content, className = '', onSourceClick }: MarkdownRendererProps) {
  if (!content) return null

  // Normalize newlines
  const rawLines = content.replace(/\r\n/g, '\n').split('\n')

  // Parse lines into structured blocks
  const blocks: React.ReactNode[] = []
  let tableBuffer: string[] = []
  let inTable = false

  const flushTable = (key: string) => {
    if (tableBuffer.length > 0) {
      blocks.push(renderTable(tableBuffer, key))
      tableBuffer = []
      inTable = false
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // Table check
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true
      tableBuffer.push(trimmed)
      continue
    } else if (inTable) {
      flushTable(`table-${i}`)
    }

    if (!trimmed) {
      blocks.push(<div key={`spacer-${i}`} className="h-1" />)
      continue
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push(<hr key={`hr-${i}`} className="border-white/10 my-2.5" />)
      continue
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      blocks.push(
        <h5 key={`h4-${i}`} className="font-semibold text-xs text-teal-300 mt-2.5 mb-1 tracking-wide">
          {renderInline(trimmed.slice(5), onSourceClick)}
        </h5>
      )
      continue
    }
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={`h3-${i}`} className="font-bold text-xs uppercase tracking-wider text-cyan-400 mt-2.5 mb-1">
          {renderInline(trimmed.slice(4), onSourceClick)}
        </h4>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3 key={`h2-${i}`} className="font-bold text-sm text-white mt-3 mb-1.5 flex items-center gap-2">
          {renderInline(trimmed.slice(3), onSourceClick)}
        </h3>
      )
      continue
    }
    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h2 key={`h1-${i}`} className="font-bold text-base text-white mt-3.5 mb-2">
          {renderInline(trimmed.slice(2), onSourceClick)}
        </h2>
      )
      continue
    }

    // Blockquote / Emergency Warning / Callout
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '')
      const isEmergency = quoteText.includes('911') || quoteText.toLowerCase().includes('emergency') || quoteText.includes('🚨')
      const isWarning = quoteText.toLowerCase().includes('warning') || quoteText.includes('⚠️')
      
      blocks.push(
        <div
          key={`quote-${i}`}
          className={`p-2.5 rounded-xl border text-xs my-2 leading-relaxed ${
            isEmergency
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-200'
              : isWarning
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
              : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          {renderInline(quoteText, onSourceClick)}
        </div>
      )
      continue
    }

    // Numbered List (e.g. "1. ", "2. ")
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (numMatch) {
      const num = numMatch[1]
      const text = numMatch[2]
      blocks.push(
        <div key={`num-${i}`} className="flex items-start gap-2 pl-1 py-0.5">
          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
            {num}
          </span>
          <div className="flex-1 text-slate-200">{renderInline(text, onSourceClick)}</div>
        </div>
      )
      continue
    }

    // Bullet points (•, -, *)
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletText = trimmed.slice(2)
      blocks.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 pl-1 py-0.5">
          <span className="text-cyan-400 text-sm leading-none mt-0.5">•</span>
          <div className="flex-1 text-slate-200">{renderInline(bulletText, onSourceClick)}</div>
        </div>
      )
      continue
    }

    // Standard paragraph line
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed text-slate-200">
        {renderInline(line, onSourceClick)}
      </p>
    )
  }

  // If table was at the end of content
  if (inTable && tableBuffer.length > 0) {
    flushTable('table-end')
  }

  return <div className={`space-y-1.5 text-xs leading-relaxed ${className}`}>{blocks}</div>
}

function renderTable(lines: string[], key: string): React.ReactNode {
  // Parse markdown table: header row, separator row (|---|---|), data rows
  if (lines.length < 2) return null

  const parseRow = (line: string) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

  const headerCells = parseRow(lines[0])
  const dataRows = lines
    .slice(1)
    .filter((l) => !l.includes('---'))
    .map(parseRow)

  return (
    <div key={key} className="overflow-x-auto my-2.5 rounded-xl border border-white/10 bg-white/5">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-slate-300 font-semibold">
            {headerCells.map((th, i) => (
              <th key={i} className="px-3 py-2 text-cyan-300">
                {renderInline(th)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-200">
          {dataRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-white/5 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-1.5">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderInline(text: string, onSourceClick?: (sourceTitle: string) => void): React.ReactNode[] {
  if (!text) return []

  // Tokenize bold (**...**), italics (_..._ or *...*), markdown links [label](url), and inline code (`...`)
  const nodes: React.ReactNode[] = []
  
  // Comprehensive regex matching:
  // 1. `code`
  // 2. **bold**
  // 3. *italic* or _italic_
  // 4. [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const rawPlain = cleanRawMarkdown(text.substring(lastIndex, match.index))
      if (rawPlain) nodes.push(rawPlain)
    }

    const token = match[0]

    if (token.startsWith('`') && token.endsWith('`')) {
      // Inline code
      nodes.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**') && token.endsWith('**')) {
      // Bold
      const inner = cleanRawMarkdown(token.slice(2, -2))
      nodes.push(
        <strong key={match.index} className="font-semibold text-white">
          {inner}
        </strong>
      )
    } else if (
      (token.startsWith('*') && token.endsWith('*') && token.length > 2) ||
      (token.startsWith('_') && token.endsWith('_') && token.length > 2)
    ) {
      // Italic
      const inner = cleanRawMarkdown(token.slice(1, -1))
      nodes.push(
        <em key={match.index} className="italic text-slate-300">
          {inner}
        </em>
      )
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      // Markdown link
      const labelMatch = token.match(/\[(.*?)\]\((.*?)\)/)
      if (labelMatch) {
        const label = labelMatch[1]
        const url = labelMatch[2]
        if (url.startsWith('source:') && onSourceClick) {
          nodes.push(
            <button
              key={match.index}
              onClick={() => onSourceClick(url.replace('source:', ''))}
              className="text-cyan-400 hover:text-cyan-300 underline font-medium inline-flex items-center gap-0.5"
            >
              {label}
            </button>
          )
        } else {
          nodes.push(
            <a
              key={match.index}
              href={url}
              className="text-cyan-400 hover:text-cyan-300 underline font-medium"
              target={url.startsWith('http') ? '_blank' : undefined}
              rel={url.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {label}
            </a>
          )
        }
      } else {
        nodes.push(token)
      }
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    const rawPlain = cleanRawMarkdown(text.substring(lastIndex))
    if (rawPlain) nodes.push(rawPlain)
  }

  return nodes
}

/**
 * Strips any leftover un-paired raw markdown symbols like rogue `**` or stray `*`
 * to guarantee no raw asterisks or markdown syntax leak into the UI.
 */
function cleanRawMarkdown(str: string): string {
  return str
    .replace(/\*\*/g, '')
    .replace(/(^|\s)\*(?!\S)/g, '$1') // remove standalone asterisks
    .replace(/(?!\S)\*($|\s)/g, '$1')
}
