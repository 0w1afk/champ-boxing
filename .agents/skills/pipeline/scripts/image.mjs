#!/usr/bin/env node
// Генерация изображений: единственная задача GPT в проекте.
// Codex запускается вне репозитория, поэтому не видит правила и файлы проекта.
// Несколько пар --name/--prompt генерируются параллельно: каждый codex exec —
// отдельный агент со своей рабочей папкой, ChatGPT держит их одновременно.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = process.env.GATE_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const APP_CODEX = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex';
const OUT_DIR = 'docs/design/generated';
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const TIMEOUT_MS = 600_000;
const MAX_PARALLEL = 4;

class Usage extends Error {}

function fail(error) {
  console.error(`image: ${error.message}`);
  process.exit(error instanceof Usage ? 2 : 1);
}

function codexBin() {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  if (fs.existsSync(APP_CODEX)) return APP_CODEX;
  return 'codex';
}

function imagesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true })
    .map((entry) => path.join(dir, String(entry)))
    .filter((file) => IMAGE_EXT.test(file) && fs.statSync(file).isFile());
}

/** Резервирует уникальное базовое имя (без расширения) под будущий файл. */
function reserveBase(name) {
  const dir = path.join(ROOT, OUT_DIR);
  fs.mkdirSync(dir, { recursive: true });
  for (let version = 1; ; version += 1) {
    const base = version === 1 ? name : `${name}-v${version}`;
    const taken = fs.readdirSync(dir).some((f) => path.parse(f).name === base || f.startsWith(`${base}.`));
    if (!taken) return path.join(dir, base);
  }
}

function usage() {
  return 'Использование: image.mjs (--name имя-латиницей --prompt "описание")... [--ref путь]... — пары повторяются, генерируются параллельно';
}

function parsePairs(values) {
  const names = [].concat(values.name ?? []);
  const prompts = [].concat(values.prompt ?? []);
  if (names.length === 0 || names.length !== prompts.length) throw new Usage(usage());
  const jobs = names.map((name, i) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Usage(`${name}: имя должно быть латиницей/цифрами через дефис`);
    if (!prompts[i]?.trim()) throw new Usage(`${name}: пустой промпт`);
    return { name, prompt: prompts[i].trim() };
  });
  const seen = new Set(jobs.map((j) => j.name));
  if (seen.size !== jobs.length) throw new Usage('имена в пакете не должны повторяться');
  return jobs;
}

function codexArgs(refs, work) {
  const args = ['exec', ...(work ? ['-C', work] : []), '--skip-git-repo-check', '--ephemeral', '-s', 'workspace-write', '-m', 'gpt-6-luna', '-c', 'model_reasoning_effort="low"'];
  for (const ref of refs) args.push('-i', ref);
  args.push('-');
  return args;
}

function instructionFor(prompt) {
  return [
    'Use the built-in image_gen tool to generate exactly one image from the brief below.',
    'Do not ask questions and do not do anything else. If reference images are attached, use them as references.',
    'Then copy the generated file into the current directory as output.png.',
    '',
    `Brief: ${prompt}`,
  ].join('\n');
}

function saveResult(base, source, prompt, refs) {
  const ext = (path.extname(source).toLowerCase() || '.png');
  const target = `${base}${ext}`;
  fs.copyFileSync(source, target);
  fs.writeFileSync(`${target}.json`, `${JSON.stringify({
    origin: 'OpenAI image generation через Codex',
    date: new Date().toISOString().slice(0, 10),
    prompt,
    references: refs,
    documentary: false,
  }, null, 2)}\n`);
  return target;
}

/** Одиночная генерация: прежний путь с фолбэком на CODEX_HOME/generated_images. */
function runSingle(job, refs) {
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
  const generated = path.join(codexHome, 'generated_images');
  const before = new Set(imagesIn(generated));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-image-'));
  try {
    const args = codexArgs(refs, work);
    const run = spawnSync(codexBin(), args, { cwd: work, input: instructionFor(job.prompt), encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
    if (run.error) throw new Error(`Codex не запустился: ${run.error.message}`);

    const source = imagesIn(work)[0] ?? imagesIn(generated).filter((f) => !before.has(f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    if (!source || fs.statSync(source).size < 1024) throw new Error(`Codex не создал изображение (код ${run.status}): ${`${run.stderr}\n${run.stdout}`.trim().slice(-500)}`);

    console.log(path.relative(ROOT, saveResult(reserveBase(job.name), source, job.prompt, refs)));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** Параллельный пакет: у каждого агента своя рабочая папка и зарезервированное имя. */
async function runBatch(jobs, refs) {
  const planned = jobs.map((job) => ({ ...job, base: reserveBase(job.name), work: fs.mkdtempSync(path.join(os.tmpdir(), 'champ-image-')) }));
  const results = new Array(planned.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < planned.length) {
      const index = cursor++;
      const job = planned[index];
      try {
        const run = await new Promise((resolve, reject) => {
          const child = spawn(codexBin(), codexArgs(refs, job.work), { cwd: job.work, stdio: ['pipe', 'pipe', 'pipe'] });
          let output = '';
          let error = '';
          const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
          child.stdout.on('data', (chunk) => { output += chunk; });
          child.stderr.on('data', (chunk) => { error += chunk; });
          child.on('error', (e) => { clearTimeout(timer); reject(e); });
          child.on('close', (code) => { clearTimeout(timer); resolve({ code, output, error }); });
          child.stdin.end(instructionFor(job.prompt));
        });

        const source = imagesIn(job.work)[0];
        if (!source || fs.statSync(source).size < 1024) throw new Error(`Codex не создал изображение (код ${run.code}): ${`${run.error}\n${run.output}`.trim().slice(-500)}`);
        results[index] = { ok: true, path: path.relative(ROOT, saveResult(job.base, source, job.prompt, refs)) };
      } catch (error) {
        results[index] = { ok: false, name: job.name, message: error.message };
      } finally {
        fs.rmSync(job.work, { recursive: true, force: true });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, planned.length) }, worker));
  for (const result of results) {
    if (result.ok) console.log(result.path);
    else console.error(`image: ${result.name}: ${result.message}`);
  }
  if (results.some((r) => !r.ok)) process.exit(1);
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        name: { type: 'string', multiple: true },
        prompt: { type: 'string', multiple: true },
        ref: { type: 'string', multiple: true, default: [] },
      },
    }));
  } catch (error) {
    throw new Usage(error.message);
  }
  const jobs = parsePairs(values);
  const refs = values.ref.map((ref) => {
    const real = path.resolve(ROOT, ref);
    if (!fs.existsSync(real)) throw new Usage(`${ref}: референс не найден`);
    return real;
  });

  if (jobs.length === 1) runSingle(jobs[0], refs);
  else await runBatch(jobs, refs);
}

try {
  await main();
} catch (error) {
  fail(error);
}
