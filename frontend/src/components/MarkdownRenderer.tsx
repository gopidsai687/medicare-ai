import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Parse simple markdown lines: headers (###, ##), bullets (•, -, *), bold (**text**), italics (_text_)
  const lines = content.split('\n')

  return (
    <div className={`space-y-1.5 text-xs leading-relaxed ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="h-1" />
        }

        // Headings
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-outfit font-bold text-sm text-cyan-400 mt-2 mb-1">
              {renderInline(trimmed.slice(4))}
            </h4>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-outfit font-bold text-base text-white mt-2.5 mb-1.5">
              {renderInline(trimmed.slice(3))}
            </h3>
          )
        }

        // Bullet points
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.slice(2)
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="text-cyan-400 text-sm leading-none mt-0.5">•</span>
              <span className="flex-1">{renderInline(bulletText)}</span>
            </div>
          )
        }

        // Standard paragraph line
        return (
          <p key={idx} className="leading-relaxed">
            {renderInline(line)}
          </p>
        )
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode[] {
  // Regex split on **bold** and _italic_
  const parts: React.ReactNode[] = []
  // Matches **bold** or _italic_
  const regex = /(\*\*[^*]+\*\*|_[^_]+_)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('_') && token.endsWith('_')) {
      parts.push(
        <em key={match.index} className="italic text-slate-300">
          {token.slice(1, -1)}
        </em>
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts
}
