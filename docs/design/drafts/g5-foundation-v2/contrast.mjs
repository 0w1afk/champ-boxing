// Расчёт контраста WCAG 2.1 (relative luminance, sRGB) для токенов G5 «Макро-нуар».
// Запуск: node contrast.mjs. Зависимостей нет. Числа совпадают с docs/design/tokens.json (contrast.measured / decisions).

const hexToRgb = (hex) => {
  const h = hex.replace('#', '').trim();
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

const luminance = ([r, g, b]) => {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

const BG = '#0b0a09', SURFACE = '#131110', RAISED = '#1a1715';

const measured = [
  ['textPrimaryOnBackground', '#ece7de', BG, 4.5],
  ['textPrimaryOnSurface', '#ece7de', SURFACE, 4.5],
  ['textPrimaryOnSurfaceRaised', '#ece7de', RAISED, 4.5],
  ['textSecondaryOnBackground', '#9a9284', BG, 4.5],
  ['textSecondaryOnSurface', '#9a9284', SURFACE, 4.5],
  ['textSecondaryOnSurfaceRaised', '#9a9284', RAISED, 4.5],
  ['accentOnBackground (крупный текст/графика ≥3)', '#E4570C', BG, 3.0],
  ['accentOnSurface (крупный текст/графика ≥3)', '#E4570C', SURFACE, 3.0],
  ['accentBrightOnBackground (любой текст ≥4.5)', '#ff7a1f', BG, 4.5],
  ['accentBrightOnSurface', '#ff7a1f', SURFACE, 4.5],
  ['buttonTextOnAccent', '#0b0a09', '#E4570C', 4.5],
  ['buttonTextOnAccentBright', '#0b0a09', '#ff7a1f', 4.5],
  ['buttonTextOnAccentPressed', '#0b0a09', '#d94e0d', 4.5],
  ['disabledTextOnDisabledBackground', '#9a9284', '#26221e', 4.5],
  ['focusRingOnBackground (графика ≥3)', '#ff7a1f', BG, 3.0],
];

const rejected = [
  ['отклонено: #ece7de на flame (текст кнопки)', '#ece7de', '#E4570C', 4.5],
  ['отклонено: #ffffff на flame', '#ffffff', '#E4570C', 4.5],
  ['отклонено: #ffffff на flameBright', '#ffffff', '#ff7a1f', 4.5],
];

console.log('— measured —');
for (const [label, fg, bg, req] of measured) {
  const r = ratio(hexToRgb(fg), hexToRgb(bg));
  console.log(`${r >= req ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(6)} : 1  (норма ${req})  ${label}`);
}
console.log('— rejected —');
for (const [label, fg, bg, req] of rejected) {
  const r = ratio(hexToRgb(fg), hexToRgb(bg));
  console.log(`FAIL  ${r.toFixed(2).padStart(6)} : 1  (норма ${req})  ${label}`);
}
