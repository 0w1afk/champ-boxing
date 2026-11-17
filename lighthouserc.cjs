// Lighthouse CI для сайта. Скопировать в корень проекта как lighthouserc.cjs.
//   FORM=mobile  npx @lhci/cli@0.15.1 autorun
//   FORM=desktop npx @lhci/cli@0.15.1 autorun
// Бюджеты берутся из metrics/budgets.json (создаётся из брифа), иначе — дефолты TOOLS.md, раздел H.
const fs = require('node:fs')

const FORM = process.env.FORM === 'desktop' ? 'desktop' : 'mobile'
const defaults = {
  mobile: { performance: 0.8, accessibility: 0.95, 'best-practices': 0.95, seo: 0.95, lcpMs: 2500, cls: 0.1, tbtMs: 300, scriptKb: 200 },
  desktop: { performance: 0.9, accessibility: 0.95, 'best-practices': 0.95, seo: 0.95, lcpMs: 1500, cls: 0.1, tbtMs: 150, scriptKb: 200 },
}
const file = 'metrics/budgets.json'
const b = { ...defaults[FORM], ...(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).lighthouse?.[FORM] : {}) }

// Старые отчёты этой формы удаляются перед прогоном: иначе в папке копятся
// HTML/JSON прошлых запусков и непонятно, какой отчёт свежий.
const outputDir = `metrics/lhci/${FORM}`
fs.rmSync(outputDir, { recursive: true, force: true })

// Astro (статика): STATIC_DIR=dist. Next: START="npm run start" URL=http://localhost:3000
// 404/500 не аудируем: у страниц ошибок нет осмысленных SEO/доступности.
const collect = process.env.STATIC_DIR
  ? {
      staticDistDir: process.env.STATIC_DIR,
      ...(process.env.URL ? { url: process.env.URL.split(',') } : {}),
      autodiscoverUrlBlocklist: ['/404.html', '/500.html'],
    }
  : { startServerCommand: process.env.START || 'npm run preview', url: (process.env.URL || 'http://localhost:4321/').split(',') }

module.exports = {
  ci: {
    collect: {
      ...collect,
      numberOfRuns: 3,
      settings: FORM === 'desktop' ? { preset: 'desktop' } : {}, // mobile — дефолт Lighthouse (Moto G Power, slow 4G)
    },
    assert: {
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['error', { minScore: b.performance }],
        'categories:accessibility': ['error', { minScore: b.accessibility }],
        'categories:best-practices': ['error', { minScore: b['best-practices'] }],
        'categories:seo': ['error', { minScore: b.seo }],
        'largest-contentful-paint': ['error', { maxNumericValue: b.lcpMs }],
        'cumulative-layout-shift': ['error', { maxNumericValue: b.cls }],
        'total-blocking-time': ['warn', { maxNumericValue: b.tbtMs }],
        'resource-summary:script:size': ['warn', { maxNumericValue: b.scriptKb * 1024 }], // байты, после сжатия при передаче
      },
    },
    upload: { target: 'filesystem', outputDir },
  },
}
