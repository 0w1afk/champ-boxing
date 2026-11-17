#!/usr/bin/env node
// Lighthouse рисует в standalone HTML-отчёте CSS-салют, когда все четыре категории набрали 100.
// Это опция рендера отчёта (`disableFireworks`), а не настройка прогона: LHCI её не передаёт,
// поэтому глушим салют в уже сгенерированных HTML — display: block → none.
// У display: none анимации не запускаются, остальной отчёт не меняется.
//
//   node metrics/disable-fireworks.mjs [dir]    по умолчанию metrics/lhci
//   node metrics/disable-fireworks.mjs --enable  вернуть салют (обратная опция)
//
// Повторный запуск безопасен: если правило уже поправлено, файл не перезаписывается.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const enable = args.includes('--enable')
const dir = args.find((a) => !a.startsWith('--')) || 'metrics/lhci'

const from = enable ? 'none' : 'block'
const to = enable ? 'block' : 'none'
// В отчёте правило лежит в минифицированном CSS, но с отступами внутри блока.
const rule = new RegExp(`(\\.lh-score100 \\.lh-pyro \\{\\s*display: )${from}(;)`)

async function reports(d) {
  const out = []
  for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) out.push(...(await reports(p)))
    else if (e.name.endsWith('.report.html')) out.push(p)
  }
  return out
}

let changed = 0
for (const f of await reports(dir)) {
  const html = await readFile(f, 'utf8')
  if (!rule.test(html)) continue
  await writeFile(f, html.replace(rule, `$1${to}$2`))
  changed++
}

console.log(changed
  ? `✓ салют ${enable ? 'включён' : 'выключен'} в отчётах: ${changed} (${dir})`
  : `✓ салют ${enable ? 'включён' : 'выключен'}, менять нечего (${dir})`)
