interface MarkdownMessageProps {
  content: string
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function parseInline(text: string): string {
  let result = escapeHtml(text)
  // bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
  result = result.replace(/__(.+?)__/g, '<strong class="font-semibold">$1</strong>')
  // italic
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>")
  result = result.replace(/_(.+?)_/g, "<em>$1</em>")
  // inline code
  result = result.replace(
    /`(.+?)`/g,
    '<code class="bg-black/5 rounded px-1 py-0.5 text-xs font-mono">$1</code>'
  )
  // links
  result = result.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sandisk-red underline">$1</a>'
  )
  return result
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n")
  const html: string[] = []
  let inList: "ul" | "ol" | null = null
  let inCode = false
  let codeBlock: string[] = []

  function closeList() {
    if (inList) {
      html.push(inList === "ul" ? "</ul>" : "</ol>")
      inList = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // fenced code block
    if (line.trimStart().startsWith("```")) {
      if (!inCode) {
        closeList()
        inCode = true
        codeBlock = []
      } else {
        inCode = false
        html.push(
          '<pre class="bg-black/5 rounded p-2 overflow-x-auto my-1.5"><code class="text-xs font-mono">' +
            escapeHtml(codeBlock.join("\n")) +
            "</code></pre>"
        )
      }
      continue
    }
    if (inCode) {
      codeBlock.push(line)
      continue
    }

    // blank line
    if (line.trim() === "") {
      closeList()
      continue
    }

    // headings
    const h3 = line.match(/^###\s+(.+)/)
    if (h3) { closeList(); html.push(`<div class="font-semibold text-xs mb-0.5">${parseInline(h3[1])}</div>`); continue }
    const h2 = line.match(/^##\s+(.+)/)
    if (h2) { closeList(); html.push(`<div class="font-semibold text-sm mb-1">${parseInline(h2[1])}</div>`); continue }
    const h1 = line.match(/^#\s+(.+)/)
    if (h1) { closeList(); html.push(`<div class="font-bold text-sm mb-1">${parseInline(h1[1])}</div>`); continue }

    // unordered list
    const ul = line.match(/^[\s]*[-*]\s+(.+)/)
    if (ul) {
      if (inList !== "ul") { closeList(); html.push('<ul class="list-disc pl-4 mb-1.5 space-y-0.5">'); inList = "ul" }
      html.push(`<li class="leading-snug">${parseInline(ul[1])}</li>`)
      continue
    }

    // ordered list
    const ol = line.match(/^[\s]*\d+[.)]\s+(.+)/)
    if (ol) {
      if (inList !== "ol") { closeList(); html.push('<ol class="list-decimal pl-4 mb-1.5 space-y-0.5">'); inList = "ol" }
      html.push(`<li class="leading-snug">${parseInline(ol[1])}</li>`)
      continue
    }

    // paragraph
    closeList()
    html.push(`<p class="mb-1.5 last:mb-0 leading-relaxed">${parseInline(line)}</p>`)
  }

  closeList()
  if (inCode) {
    html.push(
      '<pre class="bg-black/5 rounded p-2 overflow-x-auto my-1.5"><code class="text-xs font-mono">' +
        escapeHtml(codeBlock.join("\n")) +
        "</code></pre>"
    )
  }

  return html.join("")
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return <div dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
}
