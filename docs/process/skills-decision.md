# Выбор скиллов

Состояние на 2026-11-05, после перехода проекта с Claude Code на OpenCode.

## Что установлено

| Что | Где | Роль |
|---|---|---|
| Скиллы Эмиля (9): emil-design-eng, animate, animation-performance, animation-vocabulary, mobile-native, break-ui, remove-animations, find-animation-opportunities, review-animations | `.agents/skills/`, реестр `skills-lock.json` | движение, мобильное поведение, стресс-тест данных, ревью |
| Graphify | `.agents/skills/graphify/` | навигация по архитектуре и связям файлов; направление не генерирует |
| Пайплайн гейтов | `.opencode/command/pipeline.md` + `.agents/skills/pipeline/scripts/gate.mjs` | команды `/pipeline …` и детерминированные переходы |
| Роли проекта | `.opencode/agent/` (5 шт.) | субагенты: marketer, copywriter, designer, frontend, reviewer |
| Изображения | `.agents/skills/pipeline/scripts/image.mjs` | генерация и обработка через ChatGPT (Codex из приложения ChatGPT) |

## Что удалено при переходе на OpenCode

- **Impeccable 4.8.0** и `.impeccable/` — были инфраструктурой Claude Code (хуки, `init`/`shape`/`harden`), вместе с `.claude/`. Направление теперь задаёт только утверждённая концепция G3 и токены; `DESIGN.md` на S9 пишется по готовому коду без скилла.
- **DeepSeek-рутина (`ds.mjs`)** — механические проверки выполняет оркестратор и пишет `qa.md` сам; оценка осталась за независимым `reviewer`.
- **GPT-часть осталась только как `image.mjs`** — генерация изображений, единственная задача ChatGPT в проекте.

## Правило одного источника направления

Визуальное направление задаёт один источник: утверждённая на G3 концепция `docs/design/concept.md` + токены `docs/design/tokens.json`. Сторонние генераторы направления (Taste, Hallmark — рассматривались 2026-11-04 и отклонены) в проект не ставились; их конфликт с этим правилом описан в git-истории файла.

Скиллы Эмиля направление не генерируют, поэтому совместимы с любым утверждённым направлением. Часть их примеров рассчитана на React и Motion: стек проекта — Astro, используются принципы и значения, а не код.
