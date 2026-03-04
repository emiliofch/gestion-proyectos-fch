import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const DIRECTORIES = ['src', 'api']
const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.css', '.md', '.html',
])

const SUSPICIOUS_PATTERNS = [
  { label: 'utf8-latin1 Ã', regex: /Ã[\x80-\xBF]/g },
  { label: 'stray Â', regex: /Â/g },
  { label: 'utf8-latin1 â', regex: /â[\x80-\xBF]/g },
  { label: 'emoji-mojibake ðŸ', regex: /ðŸ[\x80-\xBF]*/g },
  { label: 'replacement-char', regex: /\uFFFD/g },
]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const info = statSync(fullPath)
    if (info.isDirectory()) {
      walk(fullPath, files)
      continue
    }
    const extension = extname(fullPath).toLowerCase()
    if (TEXT_EXTENSIONS.has(extension)) files.push(fullPath)
  }
  return files
}

function findLineColumn(content, index) {
  const slice = content.slice(0, index)
  const lines = slice.split('\n')
  const line = lines.length
  const column = lines.at(-1).length + 1
  return { line, column }
}

const offenders = []
for (const dir of DIRECTORIES) {
  let files = []
  try {
    files = walk(dir)
  } catch {
    continue
  }

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const { label, regex } of SUSPICIOUS_PATTERNS) {
      const matches = [...content.matchAll(regex)]
      for (const match of matches) {
        const index = match.index ?? 0
        const { line, column } = findLineColumn(content, index)
        offenders.push({
          file,
          line,
          column,
          label,
          sample: String(match[0]).replace(/\n/g, '\\n'),
        })
      }
    }
  }
}

if (offenders.length > 0) {
  console.error('Mojibake detectado. Corrige estos textos antes de continuar:\n')
  for (const issue of offenders) {
    console.error(`- ${issue.file}:${issue.line}:${issue.column} [${issue.label}] "${issue.sample}"`)
  }
  process.exit(1)
}

console.log('OK: no se detecto mojibake en src/ ni api/.')
