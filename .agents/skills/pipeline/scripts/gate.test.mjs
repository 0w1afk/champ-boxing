import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.join(import.meta.dirname, 'gate.mjs');
const REAL_CONFIG = path.resolve(import.meta.dirname, '../../../../docs/process/gates.json');

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  fs.mkdirSync(path.join(root, 'docs/process'), { recursive: true });
  fs.copyFileSync(REAL_CONFIG, path.join(root, 'docs/process/gates.json'));
  const runWithEnv = (env, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env, GATE_ROOT: root, ...env }, encoding: 'utf8' });
  const run = (...args) => runWithEnv({}, ...args);
  const ok = (...args) => { const r = run(...args); assert.equal(r.status, 0, `${args.join(' ')}\n${r.stderr}`); return r; };
  const blocked = (pattern, ...args) => {
    const r = run(...args);
    assert.equal(r.status, 1, `${args.join(' ')} должно быть заблокировано\n${r.stdout}${r.stderr}`);
    assert.match(r.stderr, pattern);
  };
  const put = (...files) => files.forEach((f) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), 'x');
  });
  const state = () => JSON.parse(fs.readFileSync(path.join(root, 'docs/process/status.json'), 'utf8'));
  const status = (id) => state().gates[id]?.status;
  const finish = (id, ...materialFlags) => {
    ok('start', id);
    ok('submit', id, ...materialFlags);
    ok('approve', id, '--evidence', 'утверждаю');
  };
  return { root, run, runWithEnv, ok, blocked, put, state, status, finish };
}

const conceptFiles = ['docs/design/concept.md', 'docs/copy/home.md', 'docs/copy/privacy.md', 'docs/copy/error.md'];
const reviewFiles = ['docs/review/site/qa.md', 'docs/review/site/review.md'];

// Доводит проект до утверждённых G1–G3 (сайт).
function throughSite(p) {
  p.put('docs/design/concept.md', ...conceptFiles.slice(1));
  p.finish('G1');
  p.put('docs/design/tokens.json');
  p.finish('G2');
  p.put(...reviewFiles);
  p.finish('G3');
}

test('approve G4 на пустом проекте заблокирован', () => {
  const p = project();
  p.blocked(/approve возможен только из «на утверждении»/, 'approve', 'G4', '--evidence', 'да');
  assert.equal(p.run('status').status, 0);
  assert.equal(p.status('G4'), undefined);
});

test('submit требует материалы, approve — слова пользователя', () => {
  const p = project();
  p.ok('start', 'G1');
  p.blocked(/Материал не найден: docs\/design\/concept\.md/, 'submit', 'G1');
  p.put('docs/design/concept.md', 'docs/copy/home.md');
  p.blocked(/Материал не найден: docs\/copy\/privacy\.md/, 'submit', 'G1');
  p.put('docs/copy/privacy.md', 'docs/copy/error.md');
  p.ok('submit', 'G1');
  p.blocked(/Нужно --evidence/, 'approve', 'G1');
  fs.rmSync(path.join(p.root, 'docs/copy/error.md'));
  p.blocked(/Материал не найден: docs\/copy\/error\.md/, 'approve', 'G1', '--evidence', 'да');
  p.put('docs/copy/error.md');
  p.ok('approve', 'G1', '--evidence', 'да');
  assert.equal(p.status('G1'), 'утверждено');
});

test('пустой материал и путь вне проекта отклоняются', () => {
  const p = project();
  p.ok('start', 'G1');
  p.put('docs/design/concept.md', 'docs/copy/home.md', 'docs/copy/privacy.md');
  fs.writeFileSync(path.join(p.root, 'docs/copy/error.md'), '');
  p.blocked(/Материал пуст: docs\/copy\/error\.md/, 'submit', 'G1');
  p.put('docs/copy/error.md');
  p.blocked(/нужен путь внутри проекта/, 'submit', 'G1', '--material', '../secret.md');
});

test('нельзя перепрыгнуть предыдущий гейт', () => {
  const p = project();
  p.blocked(/G1 не утверждён/, 'start', 'G2');
  p.blocked(/G1 не утверждён/, 'start', 'G3');
  p.blocked(/G2 не утверждён/, 'start', 'G4');
});

test('G4 требует G3 и чек-лист запуска', () => {
  const p = project();
  throughSite(p);
  p.ok('start', 'G4');
  p.put('docs/review/release/qa.md', 'docs/review/release/review.md');
  p.blocked(/S9: запуск: не выполнено «lead»/, 'submit', 'G4');
  const items = JSON.parse(fs.readFileSync(REAL_CONFIG, 'utf8')).checklists.s9.items;
  p.ok('item', 's9', 'analytics', '--na', 'аналитика на запуске не подключается');
  for (const i of items.filter((x) => x.id !== 'analytics')) p.ok('item', 's9', i.id, '--note', 'проверено');
  p.ok('submit', 'G4');
  p.ok('item', 's9', 'lead', '--undo');
  assert.equal(p.status('G4'), 'устарело');
  assert.equal(p.state().checklists.s9.lead, undefined);
  p.ok('start', 'G4');
  p.ok('item', 's9', 'analytics', '--na', 'аналитика на запуске не подключается');
  for (const i of items.filter((x) => x.id !== 'analytics')) p.ok('item', 's9', i.id, '--note', 'проверено повторно');
  p.ok('submit', 'G4');
  p.ok('approve', 'G4', '--evidence', 'запускаем');
  assert.equal(p.status('G4'), 'утверждено');
  p.ok('rework', 'G3', '--reason', 'правка сайта');
  assert.equal(p.status('G4'), 'устарело');
  assert.deepEqual(p.state().checklists.s9, {});
});

test('матрица rework: G1 затрагивает всё, G3 — только запуск', () => {
  const p = project();
  throughSite(p);
  p.ok('rework', 'G3', '--reason', 'правка');
  assert.equal(p.status('G3'), 'на доработке');
  assert.equal(p.status('G4'), undefined, 'неначатый гейт остаётся неначатым');
  assert.equal(p.status('G1'), 'утверждено');
  p.ok('submit', 'G3');
  p.ok('approve', 'G3', '--evidence', 'да');
  p.ok('rework', 'G1', '--reason', 'новая концепция');
  for (const id of ['G2', 'G3']) assert.equal(p.status(id), 'устарело', id);
  assert.equal(p.status('G4'), undefined, 'неначатый гейт остаётся неначатым');
  assert.equal(p.status('G1'), 'на доработке');
});

test('rework неначатого гейта и без причины отклоняется', () => {
  const p = project();
  p.blocked(/rework возможен/, 'rework', 'G2', '--reason', 'x');
  p.put('docs/design/concept.md', 'docs/copy/home.md', 'docs/copy/privacy.md', 'docs/copy/error.md');
  p.finish('G1');
  assert.equal(p.run('rework', 'G1').status, 2);
});

test('устаревший гейт проходит полный цикл заново', () => {
  const p = project();
  throughSite(p);
  p.ok('rework', 'G2', '--reason', 'другая палитра');
  p.blocked(/submit возможен/, 'submit', 'G3');
  p.blocked(/approve возможен только/, 'approve', 'G3', '--evidence', 'да');
  p.blocked(/G2 не утверждён/, 'start', 'G3');
  p.ok('submit', 'G2');
  p.ok('approve', 'G2', '--evidence', 'да');
  p.ok('start', 'G3');
});

test('состав экранов в v2 не ведётся', () => {
  const p = project();
  assert.equal(p.run('screen', 'add', 'home').status, 2);
  assert.match(p.run('screen', 'add', 'home').stderr, /Состав экранов в воркфлоу v2 не ведётся/);
});

test('неизвестный статус в status.json не проходит молча', () => {
  const p = project();
  p.ok('status');
  const s = p.state();
  s.gates.G3 = { status: 'утвержден' };
  fs.writeFileSync(path.join(p.root, 'docs/process/status.json'), JSON.stringify(s));
  assert.equal(p.run('status').status, 2);
});

test('status.md показывает текущий этап и матрицу', () => {
  const p = project();
  p.ok('status');
  const md = fs.readFileSync(path.join(p.root, 'docs/process/status.md'), 'utf8');
  assert.match(md, /Текущий этап: \*\*S1, гейт G1/);
  assert.match(md, /\| G2 \| G1 \| G3, G4 \|/);
  assert.match(md, /\| G4 \| G3, чек-лист s9 \| — \|/);
  p.put('docs/design/concept.md', 'docs/copy/home.md', 'docs/copy/privacy.md', 'docs/copy/error.md');
  p.finish('G1');
  assert.match(fs.readFileSync(path.join(p.root, 'docs/process/status.md'), 'utf8'), /Текущий этап: \*\*S2, гейт G2/);
});

test('дата вычисляется по московской таймзоне', () => {
  const p = project();
  const r = p.runWithEnv({ GATE_NOW: '2026-11-03T21:30:00.000Z' }, 'start', 'G1');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(p.state().history.at(-1).date, '2026-11-04');
});
