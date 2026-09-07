const menu = {
  Pichangas: [{name:'Pichangas', price:7500},{name:'Pichangas', price:10500},{name:'Pichangas', price:11500},{name:'Pichangas', price:13500},{name:'Pichangas', price:19500}],
  Completos: [{name:'Dinámico', price:2500},{name:'Italiano', price:2500},{name:'Especial palta', price:2800},{name:'Hass pollo o carne', price:4000},{name:'Hass Mixto', price:4000},{name:'Hass loco', price:4000}],
  'Salchipollo o carne': [{name:'Salchipollo o carne', price:7000},{name:'Salchipollo o carne', price:9000},{name:'Salchipollo o carne', price:11000},{name:'Salchipollo o carne', price:13000}],
  Churrascos: [{name:'Italiano', price:6500},{name:'Barro Luco', price:5500},{name:'Tortuga', price:3500},{name:'Churrasco palta', price:6000},{name:'Brasileño', price:5500},{name:'Chacarero', price:7000},{name:'Churrasco solo', price:5000}],
  Salchipapas: [{name:'Salchipapas', price:3000},{name:'Salchipapas', price:4500},{name:'Salchipapas', price:6500},{name:'Salchipapas', price:8500}],
  Chorrillanas: [{name:'Chorrillana', price:8000},{name:'Chorrillana', price:12000},{name:'Chorrillana', price:15000}],
  'Papa sola': [{name:'Papa sola', price:2500},{name:'Papa sola', price:3500},{name:'Papa sola', price:4500},{name:'Papa sola', price:8500}],
  Salchiqueso: [{name:'Salchiqueso', price:6500},{name:'Salchiqueso', price:7500},{name:'Salchiqueso', price:8500},{name:'Salchiqueso', price:13500}],
  'Pichangas con camarón': [{name:'Pichangas con camarón', price:11500},{name:'Pichangas con camarón', price:13500},{name:'Pichangas con camarón', price:16500},{name:'Pichangas con camarón', price:21000}],
  Pailas: [{name:'Paila · 2 huevos', price:2000},{name:'Paila · 3 huevos', price:3000},{name:'Paila · 4 huevos', price:3500},{name:'Paila · 2 huevos + 1 agregado', price:3500},{name:'Agregado · jamón o queso', price:0}]
};

const allProducts = Object.entries(menu).flatMap(([group, items]) => items.map((item, index) => ({...item, group, id:`${group}-${index}`})));
const state = { quantities: {}, manualPrices: {}, drinks: 0 };
const STORAGE_KEY = 'pichangas-daily-sales';
const PENDING_DELIVERIES_KEY = 'pichangas-pending-deliveries';
const VIEW_TITLES = { resumen:'Resumen del negocio', cierre:'Cierre diario', repartos:'Repartos del día', reportes:'Reportes' };
const REPORT_PERIODS = { week:'Esta semana', month:'Este mes', year:'Este año' };
const WEEK_STATS_DAYS = 7;
const today = new Date();
let activeReportPeriod = 'week';
let storageNoticeShown = false;
let toastTimer = null;
let toastHideAt = 0;
let toastRemaining = 3500;
let confirmResolver = null;
let confirmTrigger = null;
let deferredInstallPrompt = null;

const money = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const isoDate = (date) => { const local = new Date(date); local.setMinutes(local.getMinutes() - local.getTimezoneOffset()); return local.toISOString().slice(0,10); };
const prettyDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.', '');
const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const slugify = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
const formatTodayLabel = (date) => `Hoy · ${prettyDate(isoDate(date))}`;
const saleTotal = (sale) => Number(sale?.menuTotal || 0) + Number(sale?.drinks || 0) + Number(sale?.deliveries || 0);

function refreshIcons(){
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function announceStorageIssue(){
  if (!storageNoticeShown) {
    storageNoticeShown = true;
    window.setTimeout(() => toast('No fue posible leer o guardar los datos en este dispositivo.', 'error'), 0);
  }
}

function getSales(){
  try {
    const sales = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(sales) ? sales : [];
  } catch {
    announceStorageIssue();
    return [];
  }
}

function saveSales(sales){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
    return true;
  } catch {
    announceStorageIssue();
    return false;
  }
}

function getPendingDeliveries(){
  try {
    const items = JSON.parse(localStorage.getItem(PENDING_DELIVERIES_KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    announceStorageIssue();
    return [];
  }
}

function savePendingDeliveries(items){
  try {
    localStorage.setItem(PENDING_DELIVERIES_KEY, JSON.stringify(items));
    return true;
  } catch {
    announceStorageIssue();
    return false;
  }
}

function inPeriod(date, period){
  return date >= getPeriodStart(period) && date <= isoDate(new Date());
}

function getPeriodStart(period){
  const date = new Date();
  if (period === 'week') {
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
  }
  if (period === 'month') date.setDate(1);
  if (period === 'year') date.setMonth(0, 1);
  return isoDate(date);
}

function currentTotals(){
  let products = 0;
  let menuTotal = 0;
  Object.entries(state.quantities).forEach(([id, quantity]) => {
    const product = allProducts.find(item => item.id === id);
    if (!product) return;
    const count = Math.max(0, Number(quantity) || 0);
    const unitPrice = product.price > 0 ? product.price : Math.max(0, Number(state.manualPrices[id]) || 0);
    products += count;
    menuTotal += unitPrice * count;
  });
  const deliveries = getPendingDeliveries();
  const deliveryTotal = deliveries.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const drinks = Math.max(0, Number(state.drinks) || 0);
  return { products, menuTotal, drinks, deliveries: deliveryTotal, deliveryCount: deliveries.length, total: menuTotal + drinks + deliveryTotal };
}

function renderProducts(){
  const container = document.querySelector('#product-groups');
  if (!container) return;
  container.innerHTML = Object.entries(menu).map(([group, items]) => `
    <section class="product-group group-${slugify(group)}" data-group="${escapeHTML(group)}">
      <h4>${escapeHTML(group)}<span>${items.length} opciones</span></h4>
      ${items.map((item, index) => {
        const id = `${group}-${index}`;
        const inputId = `q-${slugify(id)}-${index}`;
        const manualId = `price-${slugify(id)}-${index}`;
        const isManual = item.price === 0;
        return `
          <div class="sale-product${isManual ? ' manual-product' : ''}">
            <div class="product-copy">
              <label for="${inputId}"><span class="product-name">${escapeHTML(item.name)}</span><small class="product-price">${item.price ? money(item.price) : 'Precio manual'}</small></label>
              ${isManual ? `<label class="manual-price-field" for="${manualId}"><span>Precio unitario</span><input id="${manualId}" data-manual-price="${escapeHTML(id)}" type="number" min="1" step="100" value="${state.manualPrices[id] || ''}" placeholder="$ 0" inputmode="numeric" aria-describedby="manual-error-${slugify(id)}"><small class="field-error" id="manual-error-${slugify(id)}" data-manual-error="${escapeHTML(id)}" role="alert"></small></label>` : ''}
            </div>
            <label class="quantity-label" for="${inputId}"><span class="visually-hidden">Cantidad de ${escapeHTML(item.name)}</span><input class="quantity-input" id="${inputId}" data-quantity="${escapeHTML(id)}" type="number" min="0" step="1" value="${state.quantities[id] || 0}" inputmode="numeric"></label>
            <strong class="product-subtotal" data-subtotal="${escapeHTML(id)}">${money((state.quantities[id] || 0) * (item.price || state.manualPrices[id] || 0))}</strong>
          </div>`;
      }).join('')}
    </section>`).join('');
  renderManualPriceErrors();
  refreshIcons();
}

function renderManualPriceErrors(){
  document.querySelectorAll('[data-manual-error]').forEach(error => {
    const id = error.dataset.manualError;
    const product = allProducts.find(item => item.id === id);
    const quantity = Number(state.quantities[id]) || 0;
    const price = Number(state.manualPrices[id]) || 0;
    const missing = product?.price === 0 && quantity > 0 && price <= 0;
    error.textContent = missing ? 'Ingresa un precio mayor que $0.' : '';
    error.classList.toggle('is-visible', missing);
    const input = error.parentElement?.querySelector('[data-manual-price]');
    if (input) input.setAttribute('aria-invalid', missing ? 'true' : 'false');
  });
}

function renderClosingSummary(){
  const totals = currentTotals();
  const values = {
    '#closing-products': totals.products,
    '#closing-menu': money(totals.menuTotal),
    '#closing-drinks': money(totals.drinks),
    '#closing-deliveries': money(totals.deliveries),
    '#closing-delivery-count': totals.deliveryCount,
    '#closing-total': money(totals.total)
  };
  Object.entries(values).forEach(([selector, value]) => { const element = document.querySelector(selector); if (element) element.textContent = value; });
  document.querySelectorAll('[data-subtotal]').forEach(element => {
    const product = allProducts.find(item => item.id === element.dataset.subtotal);
    if (!product) return;
    const quantity = Number(state.quantities[product.id]) || 0;
    const unitPrice = product.price || Number(state.manualPrices[product.id]) || 0;
    element.textContent = money(quantity * unitPrice);
  });
  renderManualPriceErrors();
}

function resetClosing(){
  state.quantities = {};
  state.manualPrices = {};
  state.drinks = 0;
  const drinksInput = document.querySelector('#drinks-input');
  const noteInput = document.querySelector('#sale-note');
  if (drinksInput) drinksInput.value = '';
  if (noteInput) noteInput.value = '';
  renderProducts();
  renderClosingSummary();
}

function renderPendingDeliveries(){
  const items = getPendingDeliveries();
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const pendingCount = document.querySelector('#pending-count');
  const listCount = document.querySelector('#delivery-list-count');
  const listTotal = document.querySelector('#delivery-list-total');
  if (pendingCount) pendingCount.textContent = items.length;
  if (listCount) listCount.textContent = items.length;
  if (listTotal) listTotal.textContent = money(total);
  const list = document.querySelector('#delivery-list');
  if (list) {
    list.innerHTML = items.length ? items.map((item, index) => `
      <div class="delivery-row">
        <div><b>${escapeHTML(item.name)}</b><small>${money(item.amount)}</small></div>
        <button class="remove-delivery" data-remove-delivery="${index}" type="button" aria-label="Eliminar reparto de ${escapeHTML(item.name)}"><i class="icon" data-lucide="trash-2" aria-hidden="true"></i></button>
      </div>`).join('') : `
      <div class="empty-deliveries"><span class="empty-mark"><i class="icon" data-lucide="package-check" aria-hidden="true"></i></span><div><strong>Lista al día</strong><p>No hay entregas esperando cierre.</p></div></div>`;
  }
  renderDashboardDelivery(items);
  refreshIcons();
}

function renderDashboardDelivery(items = getPendingDeliveries()){
  const container = document.querySelector('#dashboard-delivery');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="dashboard-delivery-row"><div class="delivery-label"><i class="icon" data-lucide="package-check" aria-hidden="true"></i><div><strong>Lista al día</strong><small>No hay entregas esperando cierre.</small></div></div><span class="delivery-status"><span class="dot"></span>0 pendientes</span></div>`;
    return;
  }
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  container.innerHTML = `<div class="dashboard-delivery-row"><div class="delivery-label"><i class="icon" data-lucide="bike" aria-hidden="true"></i><div><strong>${items.length} entregas pendientes</strong><small>${money(total)} por cerrar en la lista de hoy.</small></div></div><button class="inline-action" data-view-link="repartos" type="button">Ver lista <i class="icon" data-lucide="arrow-right" aria-hidden="true"></i></button></div>`;
}

function buildWeekStats(sales){
  return Array.from({length:WEEK_STATS_DAYS}, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (WEEK_STATS_DAYS - 1 - index));
    const key = isoDate(date);
    const sale = sales.find(item => item.date === key);
    return {
      date: key,
      label: date.toLocaleDateString('es-CL', {weekday:'short'}).replace('.', ''),
      shortLabel: date.toLocaleDateString('es-CL', {day:'2-digit', month:'short'}).replace('.', ''),
      value: sale ? saleTotal(sale) : 0,
      hasRecord: Boolean(sale),
      isToday: key === isoDate(today)
    };
  });
}

function formatStatsAriaLabel(point){
  return `${point.label} ${point.shortLabel}: ${point.hasRecord ? money(point.value) : 'sin cierre'}${point.isToday ? ', hoy' : ''}`;
}

function formatStatsSummary(points){
  const recorded = points.filter(point => point.hasRecord);
  if (!recorded.length) return 'No hay ventas registradas en los últimos 7 días.';
  const total = recorded.reduce((sum, point) => sum + point.value, 0);
  const best = recorded.slice().sort((a, b) => b.value - a.value)[0];
  return `Total semanal ${money(total)}. Máximo ${money(best.value)} el ${best.shortLabel}.`;
}

function renderStatsAccessible(points){
  const list = document.querySelector('#week-stats-accessible');
  if (!list) return;
  list.innerHTML = points.map(point => `<li>${escapeHTML(formatStatsAriaLabel(point))}</li>`).join('');
}

function renderWeekStats(sales){
  const shell = document.querySelector('#week-stats-chart');
  const empty = document.querySelector('#week-stats-empty');
  const svg = document.querySelector('#week-stats-svg');
  const summary = document.querySelector('#week-stats-summary');
  const points = buildWeekStats(sales);
  const hasSales = points.some(point => point.hasRecord);
  if (!shell || !empty || !svg || !summary) return;
  summary.textContent = formatStatsSummary(points);
  renderStatsAccessible(points);
  shell.hidden = !hasSales;
  empty.hidden = hasSales;
  if (!hasSales) {
    svg.replaceChildren();
    hideStatsTooltip();
    refreshIcons();
    return;
  }
  const width = 760;
  const height = 260;
  const padding = {top:24, right:18, bottom:48, left:76};
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const baseline = padding.top + plotHeight;
  const maxValue = Math.max(...points.map(point => point.value), 1);
  const slot = plotWidth / points.length;
  const barWidth = Math.min(48, slot * .46);
  const yTicks = [maxValue, maxValue / 2, 0];
  const grid = yTicks.map((tick, index) => {
    const y = baseline - (tick / maxValue) * plotHeight;
    return `<line class="stats-grid-line" x1="${padding.left}" y1="${y.toFixed(2)}" x2="${width - padding.right}" y2="${y.toFixed(2)}"></line><text class="stats-axis-label" x="${padding.left - 12}" y="${(y + 4).toFixed(2)}" text-anchor="end">${escapeHTML(money(tick))}</text>`;
  }).join('');
  const bars = points.map((point, index) => {
    const center = padding.left + slot * index + slot / 2;
    const barHeight = point.value ? Math.max(8, (point.value / maxValue) * plotHeight) : 0;
    const y = baseline - barHeight;
    const label = formatStatsAriaLabel(point);
    const rect = point.value ? `<rect class="stats-bar" x="${(center - barWidth / 2).toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="${Math.min(6, barWidth / 5).toFixed(2)}"></rect>` : `<circle class="stats-zero-marker" cx="${center.toFixed(2)}" cy="${baseline}" r="3"></circle>`;
    const marker = point.hasRecord ? '' : `<line class="stats-no-record" x1="${(center - 8).toFixed(2)}" y1="${baseline - 5}" x2="${(center + 8).toFixed(2)}" y2="${baseline - 5}"></line>`;
    return `<g class="stats-point${point.isToday ? ' is-today' : ''}" data-stats-index="${index}" tabindex="0" role="img" aria-label="${escapeHTML(label)}">${marker}${rect}<text class="stats-value-label" x="${center.toFixed(2)}" y="${Math.max(padding.top + 12, y - 9).toFixed(2)}" text-anchor="middle">${point.value ? escapeHTML(money(point.value)) : ''}</text><text class="stats-day-label" x="${center.toFixed(2)}" y="${height - 15}" text-anchor="middle">${escapeHTML(point.label)}</text></g>`;
  }).join('');
  svg.innerHTML = `<title>Ventas de los últimos 7 días</title><desc>${escapeHTML(formatStatsSummary(points))}</desc>${grid}<line class="stats-baseline" x1="${padding.left}" y1="${baseline}" x2="${width - padding.right}" y2="${baseline}"></line>${bars}`;
}

function statsPointFromEvent(event){
  const point = event.target.closest?.('[data-stats-index]');
  return point ? Number(point.dataset.statsIndex) : null;
}

function showStatsTooltip(index, anchor){
  const sales = getSales();
  const points = buildWeekStats(sales);
  const point = points[index];
  const tooltip = document.querySelector('#week-stats-tooltip');
  if (!point || !tooltip) return;
  tooltip.textContent = `${point.shortLabel} · ${point.hasRecord ? money(point.value) : 'Sin cierre'}${point.isToday ? ' · Hoy' : ''}`;
  tooltip.hidden = false;
  if (anchor?.getBoundingClientRect) {
    const chart = document.querySelector('#week-stats-chart').getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    const left = Math.max(8, Math.min(chart.width - tooltip.offsetWidth - 8, rect.left - chart.left + rect.width / 2 - tooltip.offsetWidth / 2));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(8, rect.top - chart.top - tooltip.offsetHeight - 10)}px`;
  }
}

function hideStatsTooltip(){
  const tooltip = document.querySelector('#week-stats-tooltip');
  if (tooltip) tooltip.hidden = true;
}

function bindStatsInteractions(){
  const chart = document.querySelector('#week-stats-chart');
  if (!chart || chart.dataset.bound === 'true') return;
  chart.dataset.bound = 'true';
  chart.addEventListener('pointerover', event => { const index = statsPointFromEvent(event); if (index !== null) showStatsTooltip(index, event.target.closest('[data-stats-index]')); });
  chart.addEventListener('pointermove', event => { const index = statsPointFromEvent(event); if (index !== null) showStatsTooltip(index, event.target.closest('[data-stats-index]')); });
  chart.addEventListener('pointerout', event => { if (!event.relatedTarget || !chart.contains(event.relatedTarget)) hideStatsTooltip(); });
  chart.addEventListener('focusin', event => { const index = statsPointFromEvent(event); if (index !== null) showStatsTooltip(index, event.target.closest('[data-stats-index]')); });
  chart.addEventListener('focusout', event => { if (!chart.contains(event.relatedTarget)) hideStatsTooltip(); });
  chart.addEventListener('pointerdown', event => { const index = statsPointFromEvent(event); if (index !== null) { showStatsTooltip(index, event.target.closest('[data-stats-index]')); window.setTimeout(hideStatsTooltip, 3200); } });
}

function renderActivity(sales){
  const container = document.querySelector('#activity-content');
  if (!container) return;
  const recent = sales.filter(sale => inPeriod(sale.date, 'week')).sort((a, b) => b.date.localeCompare(a.date));
  if (!recent.length) {
    container.innerHTML = `<div class="empty-activity"><div class="empty-mark"><i class="icon" data-lucide="clipboard-list" aria-hidden="true"></i></div><div><h4>Registra un cierre para ver tu semana</h4><p>Cuando guardes el primer cierre, aquí aparecerá la actividad de los últimos 7 días.</p></div><button class="inline-action" data-view-link="cierre" type="button">Ir a cierre <i class="icon" data-lucide="arrow-right" aria-hidden="true"></i></button></div>`;
    refreshIcons();
    return;
  }
  container.innerHTML = `<div class="activity-list">${recent.slice(0, 7).map(sale => `<div class="activity-row"><div><strong>${prettyDate(sale.date)}</strong><small>${sale.products || 0} productos · Menú ${money(sale.menuTotal)}</small></div><strong class="activity-total">${money(saleTotal(sale))}</strong><span class="sale-badge">Guardado</span></div>`).join('')}</div>`;
}

function updateDashboard(){
  const sales = getSales();
  const todaySale = sales.find(sale => sale.date === isoDate(today));
  const week = sales.filter(sale => inPeriod(sale.date, 'week'));
  const month = sales.filter(sale => inPeriod(sale.date, 'month'));
  const todayTotal = todaySale ? saleTotal(todaySale) : 0;
  const summaryToday = document.querySelector('#summary-today');
  const summaryOrders = document.querySelector('#summary-orders');
  const heroStatus = document.querySelector('#hero-status');
  if (summaryToday) summaryToday.textContent = money(todayTotal);
  if (heroStatus) heroStatus.textContent = todaySale ? 'Cierre registrado' : 'Aún no registrado';
  if (summaryOrders) summaryOrders.textContent = todaySale ? `${todaySale.products || 0} productos vendidos hoy.` : 'Ingresa tus productos, bebidas y repartos para cerrar la jornada.';
  const values = {
    '#summary-week': money(week.reduce((sum, sale) => sum + saleTotal(sale), 0)),
    '#summary-week-days': `${week.length} días registrados`,
    '#summary-month': money(month.reduce((sum, sale) => sum + saleTotal(sale), 0)),
    '#summary-month-days': `${month.length} días registrados`,
    '#summary-average': money(sales.length ? sales.reduce((sum, sale) => sum + saleTotal(sale), 0) / sales.length : 0)
  };
  Object.entries(values).forEach(([selector, value]) => { const element = document.querySelector(selector); if (element) element.textContent = value; });
  renderWeekStats(sales);
  renderActivity(sales);
  renderDashboardDelivery();
  refreshIcons();
}

function setActiveReportTab(period){
  document.querySelectorAll('.period-tab').forEach(tab => {
    const active = tab.dataset.period === period;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
  });
  const panel = document.querySelector('#report-panel');
  const activeTab = document.querySelector(`.period-tab[data-period="${period}"]`);
  if (panel && activeTab) panel.setAttribute('aria-labelledby', activeTab.id);
}

function renderReport(period = activeReportPeriod){
  activeReportPeriod = period;
  setActiveReportTab(period);
  const sales = getSales().filter(sale => inPeriod(sale.date, period)).sort((a, b) => b.date.localeCompare(a.date));
  const total = sales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const products = sales.reduce((sum, sale) => sum + Number(sale.products || 0), 0);
  const best = sales.slice().sort((a, b) => saleTotal(b) - saleTotal(a))[0];
  const values = {
    '#report-total': money(total),
    '#report-days': `${sales.length} días registrados`,
    '#report-products': products,
    '#report-best': best ? money(saleTotal(best)) : 'Sin datos',
    '#report-best-date': best ? prettyDate(best.date) : 'Registra un cierre'
  };
  Object.entries(values).forEach(([selector, value]) => { const element = document.querySelector(selector); if (element) element.textContent = value; });
  const rows = document.querySelector('#report-rows');
  if (!rows) return;
  rows.innerHTML = sales.length ? sales.map(sale => `<div class="report-row"><div class="report-date"><strong>${prettyDate(sale.date)}</strong><small>${sale.products || 0} productos</small></div><div class="report-breakdown"><span>Menú ${money(sale.menuTotal)}</span><span>Bebidas ${money(sale.drinks)}</span><span>Repartos ${money(sale.deliveries)}</span></div><strong class="report-total-value">${money(saleTotal(sale))}</strong></div>`).join('') : `<div class="report-empty"><span class="empty-mark"><i class="icon" data-lucide="clipboard-list" aria-hidden="true"></i></span><div><strong>No hay cierres en ${REPORT_PERIODS[period].toLowerCase()}.</strong><p>Registra un cierre para empezar a ver el rendimiento de tu negocio.</p></div><button class="inline-action" data-view-link="cierre" type="button">Ir a cierre <i class="icon" data-lucide="arrow-right" aria-hidden="true"></i></button></div>`;
  refreshIcons();
}

function switchView(view){
  if (!VIEW_TITLES[view]) return;
  document.querySelectorAll('.view').forEach(item => item.classList.toggle('active-view', item.id === `view-${view}`));
  document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(item => {
    const active = item.dataset.view === view;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
  const title = document.querySelector('#page-title');
  if (title) title.textContent = VIEW_TITLES[view];
  if (view === 'resumen') updateDashboard();
  if (view === 'cierre') renderClosingSummary();
  if (view === 'repartos') renderPendingDeliveries();
  if (view === 'reportes') renderReport(activeReportPeriod);
  window.scrollTo({top:0, behavior:'smooth'});
}

function hideToast(){
  const element = document.querySelector('#toast');
  if (!element) return;
  element.classList.remove('show');
  clearTimeout(toastTimer);
}

function toast(message, tone = 'success'){
  const element = document.querySelector('#toast');
  const messageElement = document.querySelector('#toast-message');
  if (!element || !messageElement) return;
  messageElement.textContent = message;
  element.className = `toast ${tone}`;
  requestAnimationFrame(() => element.classList.add('show'));
  clearTimeout(toastTimer);
  toastRemaining = 3500;
  toastHideAt = Date.now() + toastRemaining;
  toastTimer = window.setTimeout(hideToast, toastRemaining);
  refreshIcons();
}

function pauseToast(){
  if (!document.querySelector('#toast')?.classList.contains('show')) return;
  toastRemaining = Math.max(300, toastHideAt - Date.now());
  clearTimeout(toastTimer);
}

function resumeToast(){
  if (!document.querySelector('#toast')?.classList.contains('show')) return;
  toastHideAt = Date.now() + toastRemaining;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, toastRemaining);
}

function askConfirmation({title, message, confirmLabel = 'Confirmar', trigger = null}){
  const dialog = document.querySelector('#confirm-dialog');
  if (!dialog?.showModal) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  document.querySelector('#confirm-title').textContent = title;
  document.querySelector('#confirm-message').textContent = message;
  document.querySelector('#confirm-accept').textContent = confirmLabel;
  confirmTrigger = trigger || document.activeElement;
  if (dialog.open) dialog.close('cancel');
  dialog.showModal();
  window.setTimeout(() => document.querySelector('#confirm-cancel')?.focus(), 0);
  return new Promise(resolve => { confirmResolver = resolve; });
}

function clearFieldError(input, error){
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');
  if (error) error.textContent = '';
}

function setFieldError(input, error, message){
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
  if (error) error.textContent = message;
}

function validateDeliveryForm(){
  const name = document.querySelector('#delivery-name');
  const amount = document.querySelector('#delivery-amount');
  const nameError = document.querySelector('#delivery-name-error');
  const amountError = document.querySelector('#delivery-amount-error');
  clearFieldError(name, nameError);
  clearFieldError(amount, amountError);
  let valid = true;
  if (!name.value.trim()) { setFieldError(name, nameError, 'Escribe una referencia o cliente.'); valid = false; }
  if (!(Number(amount.value) > 0)) { setFieldError(amount, amountError, 'Ingresa un monto mayor que $0.'); valid = false; }
  if (!valid) (name.classList.contains('is-invalid') ? name : amount).focus();
  return valid;
}

async function saveSale(){
  const dateInput = document.querySelector('#sale-date');
  const date = dateInput.value;
  if (!date) { toast('Selecciona una fecha.', 'error'); dateInput.focus(); return; }
  const missingManual = [...document.querySelectorAll('[data-manual-error].is-visible')];
  if (missingManual.length) { toast('Completa los precios manuales antes de guardar.', 'error'); missingManual[0].parentElement.querySelector('[data-manual-price]')?.focus(); return; }
  const totals = currentTotals();
  if (!totals.products && !totals.drinks && !totals.deliveries) { toast('Ingresa al menos una venta.', 'error'); return; }
  const sales = getSales();
  const existing = sales.find(sale => sale.date === date);
  const confirmed = existing ? await askConfirmation({title:'¿Reemplazar el cierre?', message:'Ya existe un cierre para esta fecha. Si continúas, se reemplazará con los datos actuales.', confirmLabel:'Reemplazar', trigger:document.querySelector('#save-sale')}) : true;
  if (!confirmed) return;
  const nextSales = sales.filter(sale => sale.date !== date);
  nextSales.push({...totals, date, note:document.querySelector('#sale-note').value.trim(), manualPrices:{...state.manualPrices}});
  if (!saveSales(nextSales)) return;
  if (!savePendingDeliveries([])) return;
  resetClosing();
  renderPendingDeliveries();
  updateDashboard();
  toast(existing ? 'Cierre actualizado.' : 'Cierre guardado y repartos reiniciados.');
  switchView('resumen');
}

function exportReport(){
  const sales = getSales().filter(sale => inPeriod(sale.date, activeReportPeriod));
  if (!sales.length) { toast(`No hay cierres en ${REPORT_PERIODS[activeReportPeriod].toLowerCase()}.`, 'info'); return; }
  const escapeCSV = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = sales.map(sale => [sale.date, sale.products || 0, sale.menuTotal || 0, sale.drinks || 0, sale.deliveries || 0, sale.deliveryCount || 0, saleTotal(sale), sale.note || ''].map(escapeCSV).join(';'));
  const csv = `Fecha;Productos;Menu;Bebidas;Repartos;Cantidad repartos;Total;Nota\n${rows.join('\n')}`;
  const blob = new Blob([`\ufeff${csv}`], {type:'text/csv;charset=utf-8;'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `reporte-${activeReportPeriod}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast(`Resumen de ${REPORT_PERIODS[activeReportPeriod].toLowerCase()} descargado.`);
}

function handleDocumentClick(event){
  const navTrigger = event.target.closest('[data-view], [data-view-link]');
  if (navTrigger) {
    event.preventDefault();
    switchView(navTrigger.dataset.view || navTrigger.dataset.viewLink);
    return;
  }
  const removeButton = event.target.closest('[data-remove-delivery]');
  if (removeButton) {
    const next = getPendingDeliveries();
    next.splice(Number(removeButton.dataset.removeDelivery), 1);
    savePendingDeliveries(next);
    renderPendingDeliveries();
    renderClosingSummary();
    toast('Reparto eliminado.', 'info');
    return;
  }
  if (event.target.closest('#reset-quantities')) {
    askConfirmation({title:'¿Limpiar las cantidades?', message:'Se eliminarán las cantidades y precios manuales ingresados en este cierre.', confirmLabel:'Limpiar', trigger:event.target.closest('#reset-quantities')}).then(confirmed => { if (confirmed) { resetClosing(); toast('Cantidades limpiadas.', 'info'); } });
    return;
  }
  if (event.target.closest('#clear-deliveries')) {
    const items = getPendingDeliveries();
    if (!items.length) { toast('La lista ya está vacía.', 'info'); return; }
    askConfirmation({title:'¿Vaciar la lista de repartos?', message:`Se eliminarán ${items.length} entregas pendientes y su total asociado.`, confirmLabel:'Vaciar lista', trigger:event.target.closest('#clear-deliveries')}).then(confirmed => { if (confirmed) { savePendingDeliveries([]); renderPendingDeliveries(); renderClosingSummary(); toast('Lista de repartos vaciada.', 'info'); } });
    return;
  }
  const reportTab = event.target.closest('.period-tab');
  if (reportTab) { renderReport(reportTab.dataset.period); return; }
  if (event.target.closest('#save-sale')) { saveSale(); return; }
  if (event.target.closest('#export-report')) { exportReport(); return; }
  if (event.target.closest('#toast-close')) hideToast();
}

function handleDocumentInput(event){
  const target = event.target;
  if (target.matches('[data-quantity]')) {
    state.quantities[target.dataset.quantity] = Math.max(0, parseInt(target.value, 10) || 0);
    renderClosingSummary();
  }
  if (target.matches('[data-manual-price]')) {
    state.manualPrices[target.dataset.manualPrice] = Math.max(0, Number(target.value) || 0);
    renderClosingSummary();
  }
  if (target.matches('#drinks-input')) {
    state.drinks = Math.max(0, Number(target.value) || 0);
    renderClosingSummary();
  }
}

function handleTabKeydown(event){
  if (!event.target.matches('.period-tab')) return;
  const tabs = [...document.querySelectorAll('.period-tab')];
  const current = tabs.indexOf(event.target);
  let next = current;
  if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
  if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = tabs.length - 1;
  if (next !== current) { event.preventDefault(); tabs[next].focus(); renderReport(tabs[next].dataset.period); }
}

function setupPWA(){
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  const installButton = document.querySelector('#install-app');
  if (!installButton) return;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
    refreshIcons();
  });

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
    if (choice.outcome === 'accepted') toast('Foodtruck Ventas se está instalando.');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
    toast('Foodtruck Ventas ya está instalada.');
  });
}

function init(){
  setupPWA();
  document.querySelector('#today-label').textContent = formatTodayLabel(today);
  document.querySelector('#sale-date').value = isoDate(today);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('input', handleDocumentInput);
  document.addEventListener('keydown', handleTabKeydown);
  document.querySelector('#delivery-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!validateDeliveryForm()) return;
    const items = getPendingDeliveries();
    items.push({name:document.querySelector('#delivery-name').value.trim(), amount:Number(document.querySelector('#delivery-amount').value) || 0});
    if (!savePendingDeliveries(items)) return;
    event.currentTarget.reset();
    document.querySelectorAll('.field-error').forEach(error => { if (error.id.includes('delivery-')) error.textContent = ''; });
    renderPendingDeliveries();
    renderClosingSummary();
    toast('Reparto agregado a la lista.');
  });
  const dialog = document.querySelector('#confirm-dialog');
  dialog.addEventListener('close', () => {
    const result = dialog.returnValue === 'confirm';
    const resolver = confirmResolver;
    confirmResolver = null;
    if (resolver) resolver(result);
    if (confirmTrigger?.isConnected) confirmTrigger.focus();
    confirmTrigger = null;
  });
  document.querySelector('#confirm-cancel').addEventListener('click', () => dialog.close('cancel'));
  document.querySelector('#confirm-accept').addEventListener('click', () => dialog.close('confirm'));
  bindStatsInteractions();
  const toastElement = document.querySelector('#toast');
  toastElement.addEventListener('mouseenter', pauseToast);
  toastElement.addEventListener('mouseleave', resumeToast);
  toastElement.addEventListener('focusin', pauseToast);
  toastElement.addEventListener('focusout', resumeToast);
  renderProducts();
  renderPendingDeliveries();
  renderClosingSummary();
  updateDashboard();
  renderReport();
  refreshIcons();
}

document.addEventListener('DOMContentLoaded', init);
