export function normalizeMarkdown(input: string): string {
  let s = input || "";

  // Convert HTML headings to Markdown
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl: string, text: string) => {
    const hashes = "#".repeat(Number(lvl));
    return `\n${hashes} ${text.trim()}\n`;
  });

  // Strip simple divs/centers
  s = s.replace(/<div[^>]*>\s*/gi, "\n").replace(/\s*<\/div>/gi, "\n");
  // <br> to newline
  s = s.replace(/<br\s*\/?>(\s*)/gi, "\n");

  // Ensure space after list markers
  s = s.replace(/^(\s*)([-*+])(\S)/gm, "$1$2 $3");

  // Blank lines before common blocks
  s = s
    .replace(/([^\n])\n(#{1,6} )/g, "$1\n\n$2")
    .replace(/([^\n])\n(\s*[-*+] )/g, "$1\n\n$2")
    .replace(/([^\n])\n(```)/g, "$1\n\n$2")
    .replace(/([^\n])\n(> )/g, "$1\n\n$2");

  // Collapse excessive blank lines
  s = s.replace(/\n{3,}/g, "\n\n");

  // Normalize code fences
  s = s
    .replace(/^[ \t]*```[ \t]*([a-zA-Z0-9_-]+)?[ \t]*$/gm, (_m, lang) => `\n\n\`\`\`${lang ? String(lang).trim() : ""}\n`)
    .replace(/^[ \t]*\`\`\`[ \t]*$/gm, "```")
    .replace(/\n\n\n+/g, "\n\n");

  // Ensure tables have header separator (simple heuristic)
  s = s.replace(/\n(\|[^\n]*\|)\n(?!\|?\s*-)/g, (_m, header) => {
    const cols = header.split("|").filter(Boolean).length;
    const sep = "|" + Array(cols).fill("---").join("|") + "|";
    return `\n${header}\n${sep}\n`;
  });

  // Trim trailing whitespace
  s = s.replace(/[ \t]+$/gm, "");
  return s.trim() + "\n";
}