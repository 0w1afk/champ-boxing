#!/usr/bin/env node
// Генерация изображений: единственная задача GPT в проекте.
// Codex запускается вне репозитория, поэтому не видит правила и файлы проекта.
import { spawnSync } from 'node:child_process';
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

function freePath(name, ext) {
  const dir = path.join(ROOT, OUT_DIR);
  for (let version = 1; ; version += 1) {
    const base = version === 1 ? name : `${name}-v${version}`;
    const taken = fs.existsSync(dir) && fs.readdirSync(dir).some((f) => path.parse(f).name === base || f.startsWith(`${base}.`));
    if (!taken) return path.join(dir, `${base}${ext}`);
  }
}

function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        name: { type: 'string' },
        prompt: { type: 'string' },
        ref: { type: 'string', multiple: true, default: [] },
      },
    }));
  } catch (error) {
    throw new Usage(error.message);
  }
  if (!values.prompt?.trim() || !/^[a-z0-9][a-z0-9-]*$/.test(values.name ?? '')) {
    throw new Usage('Использование: image.mjs --name имя-латиницей --prompt "описание" [--ref путь]...');
  }
  const refs = values.ref.map((ref) => {
    const real = path.resolve(ROOT, ref);
    if (!fs.existsSync(real)) throw new Usage(`${ref}: референс не найден`);
    return real;
  });

  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
  const generated = path.join(codexHome, 'generated_images');
  const before = new Set(imagesIn(generated));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-image-'));
  try {
    const instruction = [
      'Use the built-in image_gen tool to generate exactly one image from the brief below.',
      'Do not ask questions and do not do anything else. If reference images are attached, use them as references.',
      'Then copy the generated file into the current directory as output.png.',
      '',
      `Brief: ${values.prompt}`,
    ].join('\n');
    const args = ['exec', '--skip-git-repo-check', '--ephemeral', '-C', work, '-s', 'workspace-write', '-m', 'gpt-6-luna', '-c', 'model_reasoning_effort="low"'];
    for (const ref of refs) args.push('-i', ref);
    args.push('-');
    const run = spawnSync(codexBin(), args, { cwd: work, input: instruction, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
    if (run.error) throw new Error(`Codex не запустился: ${run.error.message}`);

    const source = imagesIn(work)[0] ?? imagesIn(generated).filter((f) => !before.has(f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    if (!source) throw new Error(`Codex не создал изображение (код ${run.status}): ${`${run.stderr}\n${run.stdout}`.trim().slice(-500)}`);

    const target = freePath(values.name, path.extname(source).toLowerCase());
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    fs.writeFileSync(`${target}.json`, `${JSON.stringify({
      origin: 'OpenAI image generation через Codex',
      date: new Date().toISOString().slice(0, 10),
      prompt: values.prompt,
      references: values.ref,
      documentary: false,
    }, null, 2)}\n`);
    console.log(path.relative(ROOT, target));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  fail(error);
}
