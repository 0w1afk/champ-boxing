const root = document.documentElement;
document.querySelectorAll('input[name="theme"]').forEach((input) =>
  input.addEventListener("change", () => {
    root.dataset.theme = input.value;
    document.querySelector('meta[name="theme-color"]').content =
      getComputedStyle(root).getPropertyValue("--bg").trim();
  }),
);

const dialog = document.querySelector("#details-dialog");
const title = document.querySelector("#dialog-title");
const body = document.querySelector("#dialog-body");
const close = document.querySelector("#dialog-close");
const note =
  '<p class="demo-note">Демонстрация раскрытия для G5. Запись и внешние переходы на этом стенде отключены.</p>';
const content = {
  start: {
    title: "Первое занятие",
    html: "<p>Для начала возьмите спортивную форму и удобную сменную обувь. Специальная подготовка не нужна.</p><p>Обычно тренировка состоит из разминки, основной части и растяжки. В основной части изучают и отрабатывают приёмы, работают на мешках и лапах. Спарринги начинаются не сразу и только по желанию.</p><p>Первое занятие в общей, детской или женской группе бесплатно; предложение не распространяется на мини-группы. Напишите, чтобы согласовать время.</p>",
  },
  group: {
    title: "Общая группа",
    html: "<p>Для новичков и тех, кто уже занимался боксом. Техника, упражнения на скорость и выносливость; спарринги — позже и по желанию.</p><p>Разовое занятие — 700 ₽. Абонемент на 12 занятий — 6 000 ₽, действует 45 дней.</p><p>Первое занятие в общей группе бесплатно.</p>",
  },
  prices: {
    title: "Стоимость занятий",
    html: '<table class="price-table"><thead><tr><th scope="col">Формат</th><th scope="col">Разовое занятие</th><th scope="col">12 занятий</th></tr></thead><tbody><tr><th scope="row">Общая группа</th><td>700 ₽</td><td>6 000 ₽</td></tr><tr><th scope="row">Детская группа</th><td>500 ₽</td><td>5 000 ₽</td></tr><tr><th scope="row">Женская группа</th><td>700 ₽</td><td>6 000 ₽</td></tr><tr><th scope="row">Мини-группа</th><td>900 ₽</td><td>7 000 ₽</td></tr><tr><th scope="row">Индивидуальная тренировка</th><td>2 000 ₽</td><td>20 000 ₽</td></tr></tbody></table><p>Абонемент на 12 занятий действует 45 дней. Первое занятие в общей, детской или женской группе бесплатно. Мини-группы не участвуют. Пробная индивидуальная тренировка — 1 500 ₽. Сплит-тренировка платная; стоимость уточните при записи.</p>',
  },
  faq: {
    title: "Частые вопросы",
    html: "<details><summary>Что взять на первую тренировку?</summary><p>Спортивную форму и удобную сменную обувь. Остальная экипировка потребуется на дальнейших этапах тренировок.</p></details><details><summary>Можно прийти без спортивной подготовки?</summary><p>Да. Начать можно без опыта занятий спортом.</p></details><details><summary>Как проходит тренировка?</summary><p>Обычно это разминка, основная часть с отработкой приёмов и работой на мешках и лапах, затем растяжка.</p></details><details><summary>Будут ли спарринги на первых тренировках?</summary><p>Нет. Сначала вы отрабатываете удары и защиту. Спарринги начинаются позже и только по желанию.</p></details><details><summary>Со скольких лет можно заниматься?</summary><p>В детскую группу принимают с 7 лет. В клубе также тренируются взрослые до 60 лет. Тренер поможет подобрать нагрузку с учётом возраста и подготовки.</p></details><details><summary>Есть женская группа?</summary><p>Да. В ней занимаются девушки и женщины с любым уровнем подготовки.</p></details><details><summary>Сколько стоит первое занятие?</summary><p>В общей, детской и женской группах оно бесплатно. В мини-группе занятие стоит 900 ₽; индивидуальная пробная тренировка — 1 500 ₽. Стоимость сплит-тренировки уточните при записи.</p></details><details><summary>Сколько действует абонемент?</summary><p>Абонемент на 12 занятий действует 45 дней.</p></details><details><summary>Как записаться и согласовать время?</summary><p>Напишите в WhatsApp или позвоните: +7 (914) 423-45-55.</p></details>",
  },
};
let returnFocus;
document.querySelectorAll("[data-open]").forEach((button) =>
  button.addEventListener("click", () => {
    const item = content[button.dataset.open];
    title.textContent = item.title;
    body.innerHTML = item.html + note;
    returnFocus = button;
    close.setAttribute("aria-label", "Закрыть: " + item.title);
    dialog.showModal();
    dialog.scrollTop = 0;
    close.focus();
  }),
);
close.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    dialog.close();
});
dialog.addEventListener("close", () => returnFocus?.focus());
const menuToggle = document.querySelector("#menu-toggle");
const menuDemo = document.querySelector("#menu-demo");
menuToggle.addEventListener("click", () => {
  const opened = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(opened));
  menuToggle.setAttribute(
    "aria-label",
    opened ? "Закрыть меню" : "Открыть меню",
  );
  menuToggle
    .querySelector("path")
    .setAttribute("d", opened ? "m5 5 14 14M19 5 5 19" : "M3 8h18M3 16h18");
  menuDemo.hidden = !opened;
});
menuDemo.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    menuDemo.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Открыть меню");
    menuToggle.querySelector("path").setAttribute("d", "M3 8h18M3 16h18");
  }),
);
