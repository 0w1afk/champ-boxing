#!/usr/bin/env node
// Плавность скролла: FPS, p95 времени кадра, долгие кадры (LoAF), CLS — по секциям страницы.
// Lighthouse этого не видит, а для сайтов со скролл-анимациями и WebGL это главное.
//
//   node scroll-perf.mjs <url> [--mobile] [--cpu 4] [--speed 1200] [--headed] [--out report.json] [--budgets budgets.json] [--serve "npm run preview"]
//   --serve: если по url никто не отвечает — поднять этот prod-сервер на время замера.
//
// Требует пакет `playwright` в проекте (devDependency) и установленный Google Chrome (channel: 'chrome').
// ВАЖНО: в headless без GPU WebGL рендерится программно (SwiftShader) → FPS 3D-сцен занижен.
// Для сайтов с WebGL запускай с --headed; скрипт печатает реальный WebGL-рендерер.

import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn, execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const url = args.find((a) => /^https?:\/\//.test(a))
if (!url) { console.error('usage: node scroll-perf.mjs <url> [--mobile] [--cpu N] [--speed px/s] [--headed] [--out f] [--budgets f]'); process.exit(2) }

const mobile = flag('mobile')
const cpu = Number(opt('cpu', mobile ? 4 : 1))
const speed = Number(opt('speed', 1200)) // px/s
const DEFAULT_BUDGET = { mobile: { p95FrameMs: 33.4, longFramePct: 10 }, desktop: { p95FrameMs: 16.7, longFramePct: 5 } }
let budgets = DEFAULT_BUDGET
if (opt('budgets')) budgets = { ...DEFAULT_BUDGET, ...JSON.parse(await readFile(opt('budgets'), 'utf8')).scroll }
const budget = budgets[mobile ? 'mobile' : 'desktop']
const TOLERANCE_MS = 1 // джиттер измерения rAF

// --serve "<cmd>": поднять prod-сервер, дождаться ответа по url, после замера остановить.
// Останавливаем и группу процессов, и всё, что слушает порт: `astro preview` (Astro 7) перезапускает себя
// отдельным процессом в своей группе, и сигнал группе npm до него не доходит.
let server = null
const stopServer = () => {
  if (!server) return
  try { process.kill(-server.pid, 'SIGTERM') } catch {}
  const port = new URL(url).port || (url.startsWith('https') ? '443' : '80')
  try {
    const pids = execFileSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN']).toString().split('\n').filter(Boolean)
    for (const pid of pids) { try { process.kill(Number(pid), 'SIGTERM') } catch {} }
  } catch {} // lsof нет или никто не слушает
  server = null
}
process.on('exit', stopServer)
if (opt('serve')) {
  const alreadyUp = await fetch(url).then(() => true, () => false)
  if (!alreadyUp) {
    server = spawn(opt('serve'), { shell: true, detached: true, stdio: 'ignore' })
    const until = Date.now() + 60000
    while (!(await fetch(url).then((r) => r.ok, () => false))) {
      if (Date.now() > until) { stopServer(); console.error(`server did not respond at ${url} within 60s`); process.exit(2) }
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: !flag('headed') })
const context = await browser.newContext(mobile
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()

await page.addInitScript(() => {
  const s = (window.__perf = { frames: [], loaf: [], cls: 0, recording: false })
  const tick = (t) => { if (s.recording) s.frames.push([t, scrollY]); requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
  try {
    new PerformanceObserver((l) => { if (s.recording) for (const e of l.getEntries()) s.loaf.push({ start: e.startTime, duration: e.duration, blocking: e.blockingDuration, y: scrollY }) })
      .observe({ type: 'long-animation-frame', buffered: false })
  } catch {}
  new PerformanceObserver((l) => { if (s.recording) for (const e of l.getEntries()) if (!e.hadRecentInput) s.cls += e.value })
    .observe({ type: 'layout-shift', buffered: false })
})

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl')
  if (!gl) return 'no webgl'
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
})

const cdp = await context.newCDPSession(page)
if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })

const total = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)
await page.evaluate(() => { window.__perf.recording = true })
const stepMs = 50
const step = Math.max(1, Math.round((speed * stepMs) / 1000))
await page.mouse.move(200, 300)
const deadline = Date.now() + Math.max(10000, (total / speed) * 1000 * 3)
for (;;) {
  await page.mouse.wheel(0, step)
  await page.waitForTimeout(stepMs)
  const y = await page.evaluate(() => scrollY)
  if (y >= total - 2 || Date.now() > deadline) break
}
await page.waitForTimeout(1200) // догоняет smooth scroll
const raw = await page.evaluate(() => { window.__perf.recording = false; return window.__perf })

const sections = await page.evaluate(() =>
  [...document.querySelectorAll('[data-section], section[id], main > section')].map((el, i) => ({
    name: el.dataset.section || el.id || `section-${i + 1}`,
    top: el.getBoundingClientRect().top + scrollY,
    bottom: el.getBoundingClientRect().bottom + scrollY,
  })))
await browser.close()

const sectionAt = (y) => {
  const mid = y + (mobile ? 422 : 450)
  return (sections.find((s) => mid >= s.top && mid < s.bottom) || { name: 'other' }).name
}
const pct = (arr, p) => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] }
const r1 = (n) => Math.round(n * 10) / 10

const deltas = []
for (let i = 1; i < raw.frames.length; i++) deltas.push({ ms: raw.frames[i][0] - raw.frames[i - 1][0], section: sectionAt(raw.frames[i][1]) })
const LONG = 33.4
const summarize = (list) => {
  const ms = list.map((d) => d.ms)
  const mean = ms.reduce((a, b) => a + b, 0) / (ms.length || 1)
  return { frames: ms.length, fps: r1(1000 / mean), p50FrameMs: r1(pct(ms, 50)), p95FrameMs: r1(pct(ms, 95)), maxFrameMs: r1(Math.max(0, ...ms)), longFramePct: r1((100 * ms.filter((m) => m > LONG).length) / (ms.length || 1)) }
}
const overall = summarize(deltas)
const bySection = Object.fromEntries([...new Set(deltas.map((d) => d.section))].map((s) => [s, summarize(deltas.filter((d) => d.section === s))]))
const ok = (m) => m.p95FrameMs <= budget.p95FrameMs + TOLERANCE_MS && m.longFramePct <= budget.longFramePct

const report = {
  url, device: mobile ? 'mobile' : 'desktop', cpuThrottling: cpu, scrollSpeedPxS: speed, headed: flag('headed'),
  webglRenderer: renderer,
  warning: /swiftshader|llvmpipe|software/i.test(renderer) ? 'WebGL рендерится программно — FPS 3D-сцен занижен, перезапусти с --headed' : null,
  budget, pass: ok(overall), overall,
  sections: Object.fromEntries(Object.entries(bySection).map(([k, v]) => [k, { ...v, pass: ok(v) }])),
  longAnimationFrames: { count: raw.loaf.length, totalBlockingMs: Math.round(raw.loaf.reduce((a, e) => a + (e.blocking || 0), 0)), worst: raw.loaf.sort((a, b) => b.duration - a.duration).slice(0, 5).map((e) => ({ durationMs: Math.round(e.duration), blockingMs: Math.round(e.blocking || 0), section: sectionAt(e.y) })) },
  cls: Math.round(raw.cls * 1000) / 1000,
}

const out = opt('out')
if (out) await writeFile(out, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exit(report.pass ? 0 : 1)
