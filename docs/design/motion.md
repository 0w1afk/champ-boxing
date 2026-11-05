# Спецификация движения

Статус: спецификация G2 (rework — исполнение по референсу example). Значения сняты с компонентов example (framer-motion) и переведены на vanilla-реализацию. Принципы: движение имеет назначение; один вау-момент; только transform/opacity; всё имеет вариант reduced-motion; hover-стили — только на точных указателях (`(hover: hover) and (pointer: fine)`). Базовые длительности, кривые и пружины — `docs/design/tokens.json` → `motion`.

Решения прежней версии (отказ от курсора и halftone) пересмотрены rework G1: референс одобрен пользователем целиком, кроме иллюстраций и данных.

## Общие правила

- Reveal — один раз за сессию (IntersectionObserver, `once`), без повторов при обратном скролле.
- Параллакс — только transform/opacity, scroll-driven через rAF; не конкурирует с чтением.
- Ничто не блокирует контент и действия: reduced motion даёт содержательную статику.
- Якорные переходы (`#club`, `#formats`, `#coaches`, `#prices`, `#faq`, `#contacts`) работают без ожидания анимации.

## Переходы

| ID | Назначение | Свойства | Длительность/пружина | Кривая | Reduced motion |
|---|---|---|---|---|---|
| `hero-parallax` | **Вау-момент.** Глубина первого экрана: контурное слово «Бокс» уезжает медленнее контента и гаснет | translateY 0→38% траектории, opacity 1→0 к 80% скролла секции | scroll-driven, rAF | linear по прогрессу | слои статичны, слово видно |
| `image-parallax` | Дрейф изображений/заглушек в маске (hero, клуб, контакты) | внутренняя плоскость +120% высоты, translateY ±amount (7–10%), пружина | stiffness 90, damping 28, mass 0.4 | spring | статичная плоскость object-cover |
| `reveal-block` | Появление блоков секций при входе в вьюпорт (один раз, порог −70px) | opacity 0→1, translateY 28px→0 | 700 ms | cubic-bezier(0.22, 1, 0.36, 1) | блоки видимы сразу |
| `ticker-marquee` | Фоновый ритм фактов под первым экраном | translateX −50%, две копии (вторая aria-hidden) | 32 s, linear, ∞ | linear | статичная строка с переносами |
| `ticker-hover-pause` | Читаемость факта под курсором | animation-play-state: paused | мгновенно | — | не применяется (hover только на точных указателях) |
| `magnetic-cta` | Магнитный эффект главных кнопок записи: притяжение к курсору | translate ±(strength 8)×2 px от центра, пружина | stiffness 180, damping 16, mass 0.3 | spring | отключён |
| `cursor` | Кастомный курсор: точка+кольцо следуют за указателем, увеличение над интерактивом | transform: translate, scale; lerp 0.16 (кольцо), 0.2 (масштаб) | lerp | linear | не рисуется; системный курсор везде |
| `programs-preview` | Плавающее превью формата за курсором в секции «Тренировки» | следование (spring 130/18/0.4), opacity/scale 0.85→1, rotate −2° при активной строке | 250 ms ease-out + spring | spring | отключено (и на тач) |
| `row-hover` | Подсветка строки формата как цели | background surface/60, заголовок → accentBright, стрелка translate(4px, −4px) и flame | 300 ms | cubic-bezier(0.2, 0, 0, 1) | color-часть допустима, transform отключён |
| `card-image-hover` | Оживление портрета тренера | scale 1→1.04 (700 ms) + линия h-1 flame w-0→100% (500 ms) | 500/700 ms | ease-out | отключено |
| `menu-open` | Мобильное меню: оверлей и пункты | оверлей opacity 0→1 (300 ms); пункты opacity/x −24→0, stagger 60 ms, 400 ms | 300/400 ms | entrance | без анимации: мгновенное открытие |
| `button-color` | Отклик на hover/focus у действий | color, background-color, border-color | 300 ms | standard | допустим (color-переход) |
| `button-press` | Тактильный отклик нажатия primary | scale(0.97) + заливка accentPressed | 150 ms | standard | transform отключён, заливка остаётся |
| `badge-ping` | Индикатор бейджа на изображении первого экрана | ping-пульс кольца (scale+opacity, CSS animate-ping) | 1 s ∞ | — | отключён, статичная точка |
| `skip-anchor` | Переход по якорям внутри страницы | scroll-behavior: smooth, scroll-padding-top 5rem | браузерное | — | scroll-behavior: auto (мгновенно) |

## Исключено

- Имитация состояния «заявка отправлена» — не существует: ссылка открывает WhatsApp, отправку выполняет пользователь.
- Reveal «на каждый чих»: один тип появления на всю страницу, один раз.
- Анимация контура слова в заголовках секций — статичный декор.

## Реализация

- Кастомный курсор: при активном состоянии системный курсор скрывается (`cursor: none` на body, ссылках, кнопках, summary — как в example); при reduced-motion и на тач-устройствах кастомный не создаётся, системный работает везде.
- Вся анимация — vanilla: CSS-классы (reveal, marquee, ping), IntersectionObserver, rAF-скролл, pointer-events. Без React и анимационных библиотек.
- Регистрация эффектов — только если совпали media-условия; слушатели снимаются при `prefers-reduced-motion` change.
- Пороги reveal: rootMargin `−70px`, threshold 0.
