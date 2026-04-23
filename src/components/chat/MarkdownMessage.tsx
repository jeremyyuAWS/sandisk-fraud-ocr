import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownMessageProps {
  content: string
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <div className="font-bold text-sm mb-1">{children}</div>,
        h2: ({ children }) => <div className="font-semibold text-sm mb-1">{children}</div>,
        h3: ({ children }) => <div className="font-semibold text-xs mb-0.5">{children}</div>,
        p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-snug">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sandisk-red underline">
            {children}
          </a>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-")
          if (isBlock) {
            return (
              <pre className="bg-black/5 rounded p-2 overflow-x-auto my-1.5">
                <code className="text-xs font-mono">{children}</code>
              </pre>
            )
          }
          return <code className="bg-black/5 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-1.5">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-border px-2 py-1 bg-secondary font-semibold text-left">{children}</th>,
        td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
