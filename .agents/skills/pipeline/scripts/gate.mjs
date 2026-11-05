#!/usr/bin/env node
// Детерминированная проверка переходов между гейтами.
// Правила: docs/process/gates.json. Состояние: docs/process/status.json.
// docs/process/status.md генерируется отсюда и вручную не редактируется.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.GATE_ROOT || path.resolve(import.meta.dirname, '../../../..');
const CONFIG_PATH = path.join(ROOT, 'docs/process/gates.json');
const STATE_PATH = path.join(ROOT, 'docs/process/status.json');
const MD_PATH = path.join(ROOT, 'docs/process/status.md');

const NOT = 'не начато', WORK = 'в работе', REVIEW = 'на утверждении';
const REWORK = 'на доработке', OK = 'утверждено', STALE = 'устарело';
const STATUSES = [NOT, WORK, REVIEW, REWORK, OK, STALE];
const PROJECT_TIME_ZONE = 'Europe/Moscow';

function today() {
  const date = new Date(process.env.GATE_NOW ?? Date.now());
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PROJECT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
class Blocked extends Error {
  constructor(reasons) { super('blocked'); this.reasons = [].concat(reasons); }
}
class Usage extends Error {}

function load() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const state = fs.existsSync(STATE_PATH)
    ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
    : { screens: [], gates: {}, checklists: { s0: {}, opencode: {}, s9: {} }, history: [] };
  for (const [id, g] of Object.entries(state.gates)) {
    if (!STATUSES.includes(g.status)) throw new Usage(`status.json повреждён: ${id} имеет неизвестный статус «${g.status}»`);
  }
  return { config, state };
}

function save(ctx) {
  for (const [file, body] of [[STATE_PATH, JSON.stringify(ctx.state, null, 2) + '\n'], [MD_PATH, renderMd(ctx)]]) {
    fs.writeFileSync(file + '.tmp', body);
    fs.renameSync(file + '.tmp', file);
  }
}

const fill = (s, screen, prev) => s.replaceAll('{screen}', screen ?? '').replaceAll('{prev}', prev ?? '');

// Разворачивает шаблоны per_screen в конкретные гейты, сохраняя порядок.
function gateList({ config, state }) {
  const out = [];
  for (const def of config.gates) {
    if (!def.per_screen) { out.push({ ...def, screen: null }); continue; }
    state.screens.forEach((screen, i) => {
      const prev = state.screens[i - 1];
      out.push({
        ...def,
        id: fill(def.id, screen),
        title: fill(def.title, screen),
        screen,
        template: def.id,
        requires: def.requires.filter((r) => prev || !r.includes('{prev}')).map((r) => fill(r, screen, prev)),
        materials: def.materials.map((m) => fill(m, screen)),
        invalidates: def.invalidates.map((r) => fill(r, screen)),
      });
    });
  }
  return out;
}

const statusOf = ({ state }, id) => state.gates[id]?.status ?? NOT;

function expand(ctx, list, pattern) {
  if (!pattern.endsWith('.*')) return [pattern];
  const prefix = pattern.slice(0, -1);
  return list.filter((g) => g.id.startsWith(prefix)).map((g) => g.id);
}

function findGate(ctx, id) {
  const list = gateList(ctx);
  const gate = list.find((g) => g.id === id);
  if (!gate) throw new Usage(`Неизвестный гейт ${id}. Есть: ${list.map((g) => g.id).join(', ')}`);
  return { gate, list };
}

// Все предшествующие гейты, включая транзитивные, должны быть утверждены.
function requireReasons(ctx, gate, list) {
  const reasons = [];
  const seen = new Set();
  const walk = (g) => {
    for (const pattern of g.requires) {
      const ids = expand(ctx, list, pattern);
      if (pattern.endsWith('.*') && ids.length === 0) reasons.push(`Для ${g.id} нужны экраны, но ни один не добавлен (screen add)`);
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        if (statusOf(ctx, id) !== OK) reasons.push(`${id} не утверждён, сейчас: ${statusOf(ctx, id)}`);
        const dep = list.find((x) => x.id === id);
        if (dep) walk(dep);
      }
    }
  };
  walk(gate);
  return reasons;
}

function requiredPaths(ctx, gate) {
  return gate.materials.flatMap((m) => (m.includes('{each}') ? ctx.state.screens.map((s) => m.replaceAll('{each}', s)) : [m]));
}

function fileProblem(rel) {
  if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) return `Материал ${rel}: нужен путь внутри проекта`;
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return `Материал не найден: ${rel}`;
  const stat = fs.statSync(full);
  if (!stat.isFile()) return `Материал не является файлом: ${rel}`;
  if (stat.size === 0) return `Материал пуст: ${rel}`;
  return null;
}

function materialReasons(ctx, gate, materials) {
  const reasons = [];
  if (gate.materials.some((m) => m.includes('{each}')) && ctx.state.screens.length === 0) {
    reasons.push(`Для ${gate.id} нужны экраны, но ни один не добавлен (screen add)`);
  }
  for (const rel of requiredPaths(ctx, gate)) {
    const p = fileProblem(rel);
    if (p) reasons.push(p);
  }
  for (const m of materials) {
    if (/^https?:\/\//.test(m)) continue;
    const p = fileProblem(m);
    if (p && !reasons.includes(p)) reasons.push(p);
  }
  return reasons;
}

function checklistReasons(ctx, name) {
  if (!name) return [];
  const list = ctx.config.checklists[name];
  const done = ctx.state.checklists[name] ?? {};
  return list.items.filter((i) => !done[i.id]).map((i) => `${list.title}: не выполнено «${i.id}» — ${i.text}`);
}

function startReasons(ctx, gate, list) {
  const st = statusOf(ctx, gate.id);
  const reasons = [NOT, STALE].includes(st) ? [] : [`${gate.id}: start возможен из «${NOT}» или «${STALE}», сейчас «${st}»`];
  return [...reasons, ...checklistReasons(ctx, gate.checklist_before_start), ...requireReasons(ctx, gate, list)];
}

function submitReasons(ctx, gate, list, materials) {
  const st = statusOf(ctx, gate.id);
  const reasons = [WORK, REWORK].includes(st) ? [] : [`${gate.id}: submit возможен из «${WORK}» или «${REWORK}», сейчас «${st}»`];
  return [...reasons, ...requireReasons(ctx, gate, list), ...checklistReasons(ctx, gate.checklist_before_review), ...materialReasons(ctx, gate, materials)];
}

function approveReasons(ctx, gate, list) {
  const st = statusOf(ctx, gate.id);
  const saved = ctx.state.gates[gate.id]?.materials ?? [];
  const reasons = st === REVIEW ? [] : [`${gate.id}: approve возможен только из «${REVIEW}», сейчас «${st}»`];
  if (st === REVIEW && saved.length === 0) reasons.push(`${gate.id}: материалы не заполнены`);
  return [
    ...reasons,
    ...checklistReasons(ctx, gate.checklist_before_start),
    ...checklistReasons(ctx, gate.checklist_before_review),
    ...requireReasons(ctx, gate, list),
    ...(st === REVIEW ? materialReasons(ctx, gate, saved) : []),
  ];
}

function setGate(ctx, id, patch) {
  ctx.state.gates[id] = { status: NOT, ...ctx.state.gates[id], ...patch };
  // Любое сомнение в G9 отменяет чек-лист запуска: его нужно пройти заново на актуальной версии сайта.
  if (id === 'G9' && [REWORK, STALE].includes(patch.status)) ctx.state.checklists.s9 = {};
}

function log(ctx, action, gate, detail) {
  ctx.state.history.push({ date: today(), action, gate, ...(detail ? { detail } : {}) });
}

function invalidatedBy(ctx, gate, list, screens) {
  let patterns = gate.invalidates;
  if (screens) {
    if (!gate.scoped_invalidates) throw new Usage(`--screens поддерживается только для гейтов с точечной правкой, ${gate.id} к ним не относится`);
    for (const s of screens) if (!ctx.state.screens.includes(s)) throw new Usage(`Неизвестный экран ${s}`);
    patterns = screens.flatMap((s) => gate.scoped_invalidates.map((p) => p.replaceAll('{screen}', s)));
  }
  return [...new Set(patterns.flatMap((p) => expand(ctx, list, p)))];
}

function invalidateChecklistDependents(ctx, checklist, list) {
  const affected = new Set();
  for (const gate of list.filter((g) => g.checklist_before_start === checklist || g.checklist_before_review === checklist)) {
    affected.add(gate.id);
    for (const id of invalidatedBy(ctx, gate, list)) affected.add(id);
  }
  const stale = [];
  for (const id of affected) {
    if (statusOf(ctx, id) === NOT) continue;
    setGate(ctx, id, { status: STALE, date: today(), evidence: undefined });
    stale.push(id);
  }
  return stale;
}

// ---------- status.md ----------

function currentStage(ctx) {
  const open = checklistReasons(ctx, 's0');
  if (open.length) return `S0 Настройка: осталось пунктов ${open.length}`;
  const list = gateList(ctx);
  const firstOpen = list.find((g) => statusOf(ctx, g.id) !== OK);
  if (!firstOpen) return 'Все гейты утверждены';
  return `${firstOpen.stage}, гейт ${firstOpen.id}: ${firstOpen.title} (${statusOf(ctx, firstOpen.id)})`;
}

function checklistMd(ctx, name) {
  const list = ctx.config.checklists[name];
  const done = ctx.state.checklists[name] ?? {};
  const rows = list.items.map((i) => {
    const d = done[i.id];
    const mark = !d ? '[ ]' : '[x]';
    const note = !d ? '' : ` — ${d.na ? 'неприменимо: ' : ''}${d.note} (${d.date})`;
    return `- ${mark} \`${i.id}\` ${i.text}${note}`;
  });
  return `## ${list.title}\n\n${rows.join('\n')}\n`;
}

function renderMd(ctx) {
  const { state, config } = ctx;
  const list = gateList(ctx);
  const gateRows = config.gates.flatMap((def) => {
    if (def.per_screen && state.screens.length === 0) return [`| ${def.id} | ${def.title} | экраны не добавлены | | |`];
    return list.filter((g) => (def.per_screen ? g.template === def.id : g.id === def.id)).map((g) => {
      const s = state.gates[g.id] ?? {};
      return `| ${g.id} | ${g.title} | ${s.status ?? NOT} | ${s.date ?? ''} | ${(s.materials ?? []).join('<br>')} |`;
    });
  });
  const matrix = config.gates.map((d) => {
    const scoped = d.scoped_invalidates ? `. С \`--screens\`: ${d.scoped_invalidates.join(', ')}` : '';
    const checklist = d.checklist_before_start ?? d.checklist_before_review;
    const requires = [...d.requires, ...(checklist ? [`чек-лист ${checklist}`] : [])];
    return `| ${d.id} | ${requires.join(', ') || '—'} | ${d.invalidates.join(', ') || '—'}${scoped} |`;
  });
  const history = state.history.slice(-15).reverse().map((h) => `- ${h.date} · ${h.action} ${h.gate ?? ''}${h.detail ? `: ${h.detail}` : ''}`);
  return [
    '# Статус проекта',
    '',
    '> Файл создаётся скриптом `.agents/skills/pipeline/scripts/gate.mjs`. Не редактируй его вручную: изменения будут перезаписаны.',
    '',
    `Текущий этап: **${currentStage(ctx)}**`,
    '',
    `Экраны по порядку сборки: ${state.screens.join(', ') || 'ещё не добавлены'}`,
    '',
    checklistMd(ctx, 's0'),
    checklistMd(ctx, 'opencode'),
    '## Гейты',
    '',
    '| Гейт | Что утверждается | Статус | Дата | Материалы |',
    '|---|---|---|---|---|',
    ...gateRows,
    '',
    checklistMd(ctx, 's9'),
    '## Зависимости',
    '',
    '`Требует`: что должно быть утверждено, включая всю цепочку раньше. `Правка делает устаревшими`: что переходит в статус «устарело» при `rework` этого гейта. `G6.*` означает все экраны.',
    '',
    '| Гейт | Требует | Правка делает устаревшими |',
    '|---|---|---|',
    ...matrix,
    '',
    '## История',
    '',
    ...(history.length ? history : ['Пока пусто.']),
    '',
  ].join('\n');
}

// ---------- команды ----------

function parse(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const key = a.slice(2);
    const boolean = ['undo'].includes(key);
    const value = boolean ? true : argv[++i];
    if (value === undefined) throw new Usage(`Для --${key} нужно значение`);
    (flags[key] ??= []).push(value);
  }
  return { positional, flags };
}

const one = (flags, key) => flags[key]?.at(-1);
function need(value, message) {
  if (value === undefined || value === true || !String(value).trim()) throw new Usage(message);
  return String(value).trim();
}

const commands = {
  status(ctx) {
    save(ctx);
    console.log(`Текущий этап: ${currentStage(ctx)}`);
    for (const g of gateList(ctx)) console.log(`${g.id}\t${statusOf(ctx, g.id)}`);
  },

  check(ctx, { positional }) {
    const id = need(positional[0], 'Использование: check <гейт>');
    const { gate, list } = findGate(ctx, id);
    const st = statusOf(ctx, id);
    let step, reasons;
    if ([NOT, STALE].includes(st)) { step = 'start'; reasons = startReasons(ctx, gate, list); }
    else if ([WORK, REWORK].includes(st)) { step = 'submit'; reasons = submitReasons(ctx, gate, list, ctx.state.gates[id]?.materials ?? []); }
    else if (st === REVIEW) { step = 'approve'; reasons = approveReasons(ctx, gate, list); }
    else { console.log(`${id} утверждён.`); return; }
    if (reasons.length) throw new Blocked(reasons);
    console.log(`${id}: статус «${st}», следующий шаг ${step} разрешён.`);
  },

  start(ctx, { positional }) {
    const id = need(positional[0], 'Использование: start <гейт>');
    const { gate, list } = findGate(ctx, id);
    const reasons = startReasons(ctx, gate, list);
    if (reasons.length) throw new Blocked(reasons);
    setGate(ctx, id, { status: WORK, date: today() });
    log(ctx, 'start', id);
    save(ctx);
    console.log(`${id}: ${WORK}.`);
  },

  submit(ctx, { positional, flags }) {
    const id = need(positional[0], 'Использование: submit <гейт> [--material путь-или-ссылка]');
    const { gate, list } = findGate(ctx, id);
    const materials = [...new Set([...requiredPaths(ctx, gate), ...(flags.material ?? [])])];
    const reasons = submitReasons(ctx, gate, list, materials);
    if (reasons.length) throw new Blocked(reasons);
    setGate(ctx, id, { status: REVIEW, date: today(), materials, reason: undefined });
    log(ctx, 'submit', id);
    save(ctx);
    console.log(`${id}: ${REVIEW}. Материалы:\n${materials.join('\n')}`);
  },

  approve(ctx, { positional, flags }) {
    const id = need(positional[0], 'Использование: approve <гейт> --evidence "слова пользователя"');
    const { gate, list } = findGate(ctx, id);
    const reasons = approveReasons(ctx, gate, list);
    if (!one(flags, 'evidence')?.trim()) reasons.push('Нужно --evidence: дословная фраза пользователя с утверждением');
    if (reasons.length) throw new Blocked(reasons);
    const evidence = one(flags, 'evidence').trim();
    setGate(ctx, id, { status: OK, date: today(), evidence });
    log(ctx, 'approve', id, evidence);
    save(ctx);
    console.log(`${id}: ${OK}.`);
  },

  rework(ctx, { positional, flags }) {
    const id = need(positional[0], 'Использование: rework <гейт> --reason "что изменить" [--screens a,b]');
    const reason = need(one(flags, 'reason'), 'Нужно --reason: что именно меняется');
    const { gate, list } = findGate(ctx, id);
    const st = statusOf(ctx, id);
    if (![OK, REVIEW, REWORK].includes(st)) throw new Blocked(`${id}: rework возможен из «${OK}», «${REVIEW}» или «${REWORK}», сейчас «${st}»`);
    const screens = one(flags, 'screens')?.split(',').map((s) => s.trim()).filter(Boolean);
    const affected = invalidatedBy(ctx, gate, list, screens);
    setGate(ctx, id, { status: REWORK, date: today(), reason, evidence: undefined });
    const stale = [];
    for (const dep of affected) {
      if (statusOf(ctx, dep) === NOT) continue;
      setGate(ctx, dep, { status: STALE, date: today(), evidence: undefined });
      stale.push(dep);
    }
    log(ctx, 'rework', id, `${reason}${stale.length ? `; устарели: ${stale.join(', ')}` : ''}`);
    save(ctx);
    console.log(`${id}: ${REWORK}. Устарели: ${stale.join(', ') || 'нет'}.`);
  },

  screen(ctx, { positional }) {
    const [action, slug] = positional;
    if (!['add', 'remove'].includes(action) || !slug) throw new Usage('Использование: screen add|remove <идентификатор>');
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Usage('Идентификатор экрана: строчная латиница, цифры, дефис');
    if (statusOf(ctx, 'G2') !== OK) throw new Blocked(`Состав экранов задаётся после утверждения G2, сейчас: ${statusOf(ctx, 'G2')}`);
    if (statusOf(ctx, 'G4') === OK) throw new Blocked('Тексты уже утверждены для текущего состава экранов. Изменение карты сайта идёт через rework G2');
    const { screens } = ctx.state;
    if (action === 'add') {
      if (screens.includes(slug)) throw new Usage(`Экран ${slug} уже есть`);
      screens.push(slug);
    } else {
      if (!screens.includes(slug)) throw new Usage(`Экрана ${slug} нет`);
      ctx.state.screens = screens.filter((s) => s !== slug);
      delete ctx.state.gates[`G6.${slug}`];
      delete ctx.state.gates[`G8.${slug}`];
    }
    log(ctx, `screen ${action}`, null, slug);
    save(ctx);
    console.log(`Экраны: ${ctx.state.screens.join(', ') || 'нет'}.`);
  },

  item(ctx, { positional, flags }) {
    const [name, itemId] = positional;
    const list = ctx.config.checklists[name];
    if (!list) throw new Usage(`Использование: item <${Object.keys(ctx.config.checklists).join('|')}> <пункт> --note "доказательство"`);
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw new Usage(`Неизвестный пункт. Есть: ${list.items.map((i) => i.id).join(', ')}`);
    ctx.state.checklists[name] ??= {};
    if (flags.undo) {
      delete ctx.state.checklists[name][itemId];
      const stale = invalidateChecklistDependents(ctx, name, gateList(ctx));
      log(ctx, `item ${name} снят`, null, `${itemId}${stale.length ? `; устарели: ${stale.join(', ')}` : ''}`);
      save(ctx);
      console.log(`${itemId}: снято. Устарели: ${stale.join(', ') || 'нет'}.`);
      return;
    }
    if (name === 's9' && ![WORK, REWORK].includes(statusOf(ctx, 'G9'))) {
      throw new Blocked(`Чек-лист запуска заполняется, когда G9 в работе, сейчас: ${statusOf(ctx, 'G9')}`);
    }
    const na = one(flags, 'na');
    if (na !== undefined && !list.na_allowed) throw new Blocked(`В чек-листе ${name} пункт нельзя пометить неприменимым`);
    const note = need(na ?? one(flags, 'note'), 'Нужно --note с доказательством: ссылка, вывод команды или результат проверки');
    ctx.state.checklists[name][itemId] = { date: today(), note, ...(na !== undefined ? { na: true } : {}) };
    log(ctx, `item ${name}`, null, `${itemId}: ${note}`);
    save(ctx);
    console.log(`${itemId}: отмечено.`);
  },

  figma() {
    throw new Usage('Figma выведена из процесса: прототипы в docs/design/drafts/ заменяют макеты Figma.');
  },
};

try {
  const [command, ...rest] = process.argv.slice(2);
  if (!commands[command]) throw new Usage(`Команды: ${Object.keys(commands).join(', ')}`);
  commands[command](load(), parse(rest));
} catch (e) {
  if (e instanceof Blocked) {
    console.error(`ЗАБЛОКИРОВАНО:\n- ${e.reasons.join('\n- ')}`);
    process.exit(1);
  }
  if (e instanceof Usage) {
    console.error(e.message);
    process.exit(2);
  }
  throw e;
}
