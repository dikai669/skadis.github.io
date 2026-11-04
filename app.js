const CATEGORIES = [
  { id: 'bin', code: 'A', label: 'Контейнеры', title: 'Короба и контейнеры' },
  { id: 'hook', code: 'B', label: 'Крючки', title: 'Крючки' },
  { id: 'holder', code: 'C', label: 'Держатели', title: 'Держатели' },
  { id: 'accessory', code: 'D', label: 'Аксессуары', title: 'Аксессуары' }
];
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function priceFor(model) {
  const roundedHours = Math.ceil(Number(model.time_h || 0) * 2 - 1e-9) / 2;
  return Number(model.price_rub ?? ((model.weight_g * 3 + roundedHours * 100) * 1.25));
}
function trustedUrl(value, allowedHost) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedHost(url.hostname) ? url.href : '';
  } catch {
    return '';
  }
}
function makerWorldPage(model) {
  return trustedUrl(model.url, host => host === 'makerworld.com' || host.endsWith('.makerworld.com'));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
function imageMarkup(model, category) {
  const src = trustedUrl(model.image, host => host === 'makerworld.bblmw.com' || host.endsWith('.bblmw.com'));
  return `<div class="product-image-wrap">
    <img class="product-image" src="${escapeHtml(src)}" alt="${escapeHtml(model.title)}" loading="lazy" decoding="async">
    <span class="category-chip">${category.code} · ${category.label}</span>
  </div>`;
}
function variantNote(model) {
  if (model.variant_note) {
    return `<p class="variant-note">${escapeHtml(model.variant_note)}</p>`;
  }
  if (model.selected_size) {
    return `<p class="variant-note">Есть другие размеры или варианты. Цена рассчитана для выбранного минимального варианта: ${escapeHtml(model.selected_size)}.</p>`;
  }
  if (model.multiSizes) {
    return '<p class="variant-note">У модели есть несколько вариантов, но профиль не показывает отдельный вес каждого размера; проверьте исходную карточку MakerWorld.</p>';
  }
  return '';
}
function cardMarkup(model, category, sequence) {
  const numericPrice = priceFor(model);
  const price = numericPrice < 150 ? 'По запросу' : money.format(numericPrice);
  const link = escapeHtml(makerWorldPage(model));
  const itemCode = `${category.code}${sequence}`;
  return `<article class="product-card">
    ${imageMarkup(model, category)}
    <div class="product-body">
      <div class="product-title-row">
        <span class="model-code" aria-label="Код позиции ${itemCode}">${itemCode}</span>
        <a class="product-title" href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(model.title)}</a>
      </div>
      ${variantNote(model)}
      <div class="metrics">
        <div class="metric"><span>Вес</span><strong>${decimal.format(model.weight_g)} г</strong></div>
        <div class="metric"><span>Система</span><strong>SKÅDIS</strong></div>
      </div>
      <div class="price-row">
        <span class="price-label">${numericPrice < 150 ? 'Стоимость' : 'Расчётная цена'}</span>
        <strong class="price${numericPrice < 150 ? ' price-on-request' : ''}">${price}</strong>
      </div>
      <a class="card-link" href="${link}" target="_blank" rel="noopener noreferrer">Открыть на MakerWorld <span aria-hidden="true">↗</span></a>
    </div>
  </article>`;
}
function sectionMarkup(category, models) {
  const items = models
    .filter(model => model.category === category.id)
    .slice()
    .sort((a, b) => priceFor(a) - priceFor(b) || a.title.localeCompare(b.title, 'ru'));
  return `<section class="category-section" id="section-${category.id}" aria-labelledby="heading-${category.id}">
    <div class="category-section-heading">
      <div><p class="eyebrow">${category.code} · ${category.label.toLocaleUpperCase('ru')}</p><h3 id="heading-${category.id}">${category.title}</h3></div>
      <span class="section-count">${items.length} позиций · от дешёвых к дорогим</span>
    </div>
    <div class="product-grid">${items.map((model, index) => cardMarkup(model, category, index + 1)).join('')}</div>
  </section>`;
}
function renderSourceNote(data) {
  const countByCategory = Object.fromEntries(CATEGORIES.map(category => [
    category.id, data.models.filter(model => model.category === category.id).length
  ]));
  const coverage = [
    `контейнеры — ${countByCategory.bin}/100`,
    `крючки — ${countByCategory.hook}/100`,
    `держатели — ${countByCategory.holder}/100`,
    `аксессуары — ${countByCategory.accessory}/100`
  ].join(' · ');
  const unresolved = Array.isArray(data.profileAudit?.unresolved) ? data.profileAudit.unresolved.length : 0;
  const caveat = unresolved ? ` Для ${unresolved} моделей MakerWorld не предоставил отдельный вес минимального размера; карточки помечены.` : '';
  document.querySelector('#source-note').textContent = `Срез MakerWorld от ${data.capturedAt}. В каталоге: ${coverage}. Модели тяжелее 500 г исключены. Для вариантов цена рассчитана по выбранному размеру или профилю MakerWorld; дополнительные размеры указаны в карточке.${caveat} Цены ориентировочные.`;
}
async function init() {
  const loading = document.querySelector('#loading-message');
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    for (const category of CATEGORIES) {
      const count = data.models.filter(model => model.category === category.id).length;
      document.querySelector(`#count-${category.id}`).textContent = count.toLocaleString('ru-RU');
    }
    document.querySelector('#category-sections').innerHTML = CATEGORIES.map(category => sectionMarkup(category, data.models)).join('');
    renderSourceNote(data);
    loading.hidden = true;
  } catch (error) {
    loading.textContent = 'Не удалось загрузить каталог. Обновите страницу или попробуйте позже.';
    console.error(error);
  }
}

init();
