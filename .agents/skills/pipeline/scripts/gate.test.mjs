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

function completeS0(p) {
  const items = JSON.parse(fs.readFileSync(REAL_CONFIG, 'utf8')).checklists.s0.items;
  for (const i of items) p.ok('item', 's0', i.id, '--note', 'проверено');
}

function completeOpencode(p) {
  const items = JSON.parse(fs.readFileSync(REAL_CONFIG, 'utf8')).checklists.opencode.items;
  for (const i of items) p.ok('item', 'opencode', i.id, '--note', 'проверено');
}

// Доводит проект до состояния, когда утверждены G1–G7 и экраны home, about.
function throughG7(p) {
  completeS0(p);
  completeOpencode(p);
  p.put('docs/brief/brief.md', 'PRODUCT.md', 'docs/strategy/strategy.md', 'docs/strategy/sitemap.md', 'docs/design/concept.md');
  p.finish('G1');
  p.finish('G2');
  p.ok('screen', 'add', 'home');
  p.ok('screen', 'add', 'about');
  p.finish('G3');
  p.put('docs/copy/home.md', 'docs/copy/about.md', 'docs/design/tokens.json');
  p.finish('G4');
  p.finish('G5');
  p.put('docs/design/screens/home.md', 'docs/design/screens/about.md', 'docs/design/motion.md');
  p.finish('G6.home');
  p.finish('G6.about');
  p.finish('G6');
  p.put('docs/design/handoff.md');
  p.finish('G7');
}

const reviewFiles = (s) => ['desktop.png', 'mobile.png', 'qa.md', 'review.md'].map((f) => `docs/review/${s}/${f}`);

test('approve G7 на S0 заблокирован', () => {
  const p = project();
  p.blocked(/approve возможен только из «на утверждении»/, 'approve', 'G7', '--evidence', 'да');
  assert.equal(p.run('status').status, 0);
  assert.equal(p.status('G7'), undefined);
});

test('G1 нельзя начать, пока не закрыт чек-лист S0', () => {
  const p = project();
  p.blocked(/S0: настройка: не выполнено «hooks»/, 'start', 'G1');
});

test('снятие пункта S0 делает зависимые гейты устаревшими', () => {
  const p = project();
  completeS0(p);
  p.put('docs/brief/brief.md', 'PRODUCT.md', 'docs/strategy/strategy.md', 'docs/strategy/sitemap.md');
  p.finish('G1');
  p.finish('G2');
  p.ok('item', 's0', 'hooks', '--undo');
  assert.equal(p.status('G1'), 'устарело');
  assert.equal(p.status('G2'), 'устарело');
  p.blocked(/S0: настройка: не выполнено «hooks»/, 'start', 'G1');
  p.blocked(/G1 не утверждён/, 'start', 'G2');
});

test('пункт чек-листа требует доказательство', () => {
  const p = project();
  assert.equal(p.run('item', 's0', 'hooks').status, 2);
  p.blocked(/нельзя пометить неприменимым/, 'item', 's0', 'hooks', '--na', 'не нужно');
});

test('approve требует статус на утверждении, материалы и слова пользователя', () => {
  const p = project();
  completeS0(p);
  p.ok('start', 'G1');
  p.blocked(/approve возможен только/, 'approve', 'G1', '--evidence', 'да');
  p.blocked(/Материал не найден: docs\/brief\/brief\.md/, 'submit', 'G1');
  p.put('docs/brief/brief.md', 'PRODUCT.md');
  p.ok('submit', 'G1');
  p.blocked(/Нужно --evidence/, 'approve', 'G1');
  fs.rmSync(path.join(p.root, 'PRODUCT.md'));
  p.blocked(/Материал не найден: PRODUCT\.md/, 'approve', 'G1', '--evidence', 'да');
  p.put('PRODUCT.md');
  p.ok('approve', 'G1', '--evidence', 'да');
  assert.equal(p.status('G1'), 'утверждено');
});

test('пустой материал и путь вне проекта отклоняются', () => {
  const p = project();
  completeS0(p);
  p.ok('start', 'G1');
  p.put('docs/brief/brief.md');
  fs.writeFileSync(path.join(p.root, 'PRODUCT.md'), '');
  p.blocked(/Материал пуст: PRODUCT\.md/, 'submit', 'G1');
  p.put('PRODUCT.md');
  p.blocked(/нужен путь внутри проекта/, 'submit', 'G1', '--material', '../secret.md');
});

test('нельзя перепрыгнуть предыдущий гейт', () => {
  const p = project();
  completeS0(p);
  p.blocked(/G1 не утверждён/, 'start', 'G2');
  p.blocked(/G1 не утверждён/, 'start', 'G5');
});

test('G4 и G6 не проходят при пустом списке экранов', () => {
  const p = project();
  completeS0(p);
  p.put('docs/brief/brief.md', 'PRODUCT.md', 'docs/strategy/strategy.md', 'docs/strategy/sitemap.md', 'docs/design/concept.md', 'docs/design/motion.md');
  p.finish('G1');
  p.finish('G2');
  p.finish('G3');
  p.ok('start', 'G4');
  p.blocked(/ни один не добавлен/, 'submit', 'G4');
  p.blocked(/ни один не добавлен/, 'start', 'G6');
});

test('Figma выведена из процесса', () => {
  const p = project();
  throughG7(p);
  const r = p.run('figma');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Figma выведена из процесса/);
});

test('экраны утверждаются строго по порядку', () => {
  const p = project();
  throughG7(p);
  p.ok('rework', 'G6.home', '--reason', 'правка');
  p.blocked(/G6\.home не утверждён/, 'start', 'G6');
  assert.equal(p.status('G6'), 'устарело');
  p.blocked(/G8\.home не утверждён/, 'start', 'G8.about');
});

test('G7 требует все экраны G6.* и G6', () => {
  const p = project();
  throughG7(p);
  p.ok('rework', 'G6.about', '--reason', 'правка');
  assert.equal(p.status('G7'), 'устарело');
  const r = p.run('start', 'G7');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /G6\.about не утверждён/);
  assert.match(r.stderr, /G6 не утверждён/);
});

test('G9 требует все G8.* и чек-лист запуска', () => {
  const p = project();
  throughG7(p);
  p.blocked(/G8\.home не утверждён/, 'start', 'G9');
  p.put(...reviewFiles('home'), ...reviewFiles('about'));
  p.finish('G8.home');
  p.blocked(/G8\.about не утверждён/, 'start', 'G9');
  p.finish('G8.about');
  p.ok('start', 'G9');
  p.put('docs/review/release/qa.md', 'docs/review/release/review.md', 'DESIGN.md');
  p.blocked(/S9: запуск: не выполнено «lead»/, 'submit', 'G9');
  const items = JSON.parse(fs.readFileSync(REAL_CONFIG, 'utf8')).checklists.s9.items;
  p.ok('item', 's9', 'analytics', '--na', 'аналитика не подключается');
  for (const i of items.filter((x) => x.id !== 'analytics')) p.ok('item', 's9', i.id, '--note', 'проверено');
  p.ok('submit', 'G9');
  p.ok('item', 's9', 'lead', '--undo');
  assert.equal(p.status('G9'), 'устарело');
  assert.equal(p.state().checklists.s9.lead, undefined);
  p.ok('start', 'G9');
  p.ok('item', 's9', 'analytics', '--na', 'аналитика не подключается');
  for (const i of items.filter((x) => x.id !== 'analytics')) p.ok('item', 's9', i.id, '--note', 'проверено повторно');
  p.ok('submit', 'G9');
  p.ok('approve', 'G9', '--evidence', 'запускаем');
  assert.equal(p.status('G9'), 'утверждено');
  p.ok('rework', 'G8.home', '--reason', 'правка');
  assert.equal(p.status('G9'), 'устарело');
  assert.deepEqual(p.state().checklists.s9, {});
});

test('матрица rework: G5 затрагивает экраны и код, но не тексты', () => {
  const p = project();
  throughG7(p);
  p.put(...reviewFiles('home'));
  p.finish('G8.home');
  p.ok('rework', 'G5', '--reason', 'другой цвет');
  assert.equal(p.status('G5'), 'на доработке');
  for (const id of ['G6.home', 'G6.about', 'G6', 'G7', 'G8.home']) assert.equal(p.status(id), 'устарело', id);
  assert.equal(p.status('G4'), 'утверждено');
  assert.equal(p.status('G8.about'), undefined, 'неначатый гейт остаётся неначатым');
});

test('rework текста с --screens затрагивает только указанный экран', () => {
  const p = project();
  throughG7(p);
  p.ok('rework', 'G4', '--reason', 'опечатка', '--screens', 'about');
  assert.equal(p.status('G6.about'), 'устарело');
  assert.equal(p.status('G6.home'), 'утверждено');
  assert.equal(p.status('G7'), 'устарело');
  assert.equal(p.run('rework', 'G5', '--reason', 'x', '--screens', 'about').status, 2);
  assert.equal(p.run('rework', 'G4', '--reason', 'x', '--screens', 'nope').status, 2);
});

test('rework неначатого гейта и без причины отклоняется', () => {
  const p = project();
  p.blocked(/rework возможен/, 'rework', 'G3', '--reason', 'x');
  completeS0(p);
  p.put('docs/brief/brief.md', 'PRODUCT.md');
  p.finish('G1');
  assert.equal(p.run('rework', 'G1').status, 2);
});

test('устаревший гейт проходит полный цикл заново', () => {
  const p = project();
  throughG7(p);
  p.ok('rework', 'G6', '--reason', 'другой переход');
  p.blocked(/submit возможен/, 'submit', 'G7');
  p.blocked(/approve возможен только/, 'approve', 'G7', '--evidence', 'да');
  p.blocked(/G6 не утверждён/, 'start', 'G7');
  p.ok('submit', 'G6');
  p.ok('approve', 'G6', '--evidence', 'да');
  p.ok('start', 'G7');
});

test('состав экранов меняется только между G2 и G4', () => {
  const p = project();
  p.blocked(/после утверждения G2/, 'screen', 'add', 'home');
  throughG7(p);
  p.blocked(/через rework G2/, 'screen', 'add', 'prices');
  p.ok('rework', 'G2', '--reason', 'новая страница');
  p.blocked(/после утверждения G2/, 'screen', 'add', 'prices');
  p.ok('submit', 'G2');
  p.ok('approve', 'G2', '--evidence', 'да');
  p.ok('screen', 'add', 'prices');
  assert.deepEqual(p.state().screens, ['home', 'about', 'prices']);
});

test('неизвестный статус в status.json не проходит молча', () => {
  const p = project();
  p.ok('status');
  const s = p.state();
  s.gates.G7 = { status: 'утвержден' };
  fs.writeFileSync(path.join(p.root, 'docs/process/status.json'), JSON.stringify(s));
  assert.equal(p.run('status').status, 2);
});

test('status.md показывает текущий этап и матрицу', () => {
  const p = project();
  p.ok('status');
  const md = fs.readFileSync(path.join(p.root, 'docs/process/status.md'), 'utf8');
  assert.match(md, /Текущий этап: \*\*S0 Настройка/);
  assert.match(md, /\| G5 \| G4, чек-лист opencode \| G6\.\*, G6, G7, G8\.\*, G9 \|/);
  assert.match(md, /\| G1 \| чек-лист s0 \|/);
  assert.match(md, /\| G9 \| G8\.\*, чек-лист s9 \| — \|/);
  completeS0(p);
  assert.match(fs.readFileSync(path.join(p.root, 'docs/process/status.md'), 'utf8'), /Текущий этап: \*\*S1, гейт G1/);
});

test('дата вычисляется по московской таймзоне', () => {
  const p = project();
  const r = p.runWithEnv({ GATE_NOW: '2026-11-03T21:30:00.000Z' }, 'item', 's0', 'hooks', '--note', 'проверено');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(p.state().history.at(-1).date, '2026-11-04');
});
