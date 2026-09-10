const menu = {
  Pichangas: [{name:'Pichangas', price:7500},{name:'Pichangas', price:10500},{name:'Pichangas', price:11500},{name:'Pichangas', price:13500},{name:'Pichangas', price:19500}],
  Completos: [{name:'Dinámico', price:2500},{name:'Italiano', price:2500},{name:'Especial palta', price:2800},{name:'Hass pollo o carne', price:4000},{name:'Hass Mixto', price:4000},{name:'Hass Luco', price:4000}],
  'Salchipollo o carne': [{name:'Salchipollo o carne', price:7000},{name:'Salchipollo o carne', price:9000},{name:'Salchipollo o carne', price:11000},{name:'Salchipollo o carne', price:13000}],
  Churrascos: [{name:'Italiano', price:6500},{name:'Barro Luco', price:5500},{name:'Tortuga', price:3500},{name:'Churrasco palta', price:6000},{name:'Brasileño', price:5500},{name:'Chacarero', price:7000},{name:'Churrasco solo', price:5000}],
  Salchipapas: [{name:'Salchipapas', price:3000},{name:'Salchipapas', price:4500},{name:'Salchipapas', price:6500},{name:'Salchipapas', price:8500}],
  Chorrillanas: [{name:'Chorrillana', price:8000},{name:'Chorrillana', price:12000},{name:'Chorrillana', price:15000}],
  'Papa sola': [{name:'Papa sola', price:2500},{name:'Papa sola', price:3500},{name:'Papa sola', price:4500},{name:'Papa sola', price:8500}],
  Salchiqueso: [{name:'Salchiqueso', price:6500},{name:'Salchiqueso', price:7500},{name:'Salchiqueso', price:8500},{name:'Salchiqueso', price:13500}],
  'Pichangas con camarón': [{name:'Pichangas con camarón', price:11500},{name:'Pichangas con camarón', price:13500},{name:'Pichangas con camarón', price:16500},{name:'Pichangas con camarón', price:21000}],
  Promos: [{name:'Completo + papas + bebida', price:5000},{name:'Completo + papas (sin bebida)', price:4000}],
  Bebidas: [{name:'Bebida lata 220cc', price:1000},{name:'Bebida 350cc', price:1500},{name:'Bebida 1,5', price:3000},{name:'Jugo 1,5', price:3000},{name:'Energizante', price:3000},{name:'Té/café', price:1000},{name:'Agua con gas 1,5 lts', price:2000},{name:'Agua sin gas 1,5 lts', price:2000},{name:'Kapo', price:500},{name:'Bebidas express', price:1000}],
  Pailas: [{name:'Paila · 2 huevos', price:2000},{name:'Paila · 3 huevos', price:3000},{name:'Paila · 4 huevos', price:3500},{name:'Paila · 2 huevos + 1 agregado', price:3500},{name:'Agregado · jamón o queso', price:0}]
};

const allProducts = Object.entries(menu).flatMap(([group, items]) => items.map((item, index) => ({...item, group, id:`${group}-${index}`})));
const workers = [
  {id:'vannesa-perez', name:'Vannesa Perez', rut:'16436186-1'},
  {id:'vanessa-gonzales', name:'Vanessa Gonzales', rut:'22746439-9'},
  {id:'nelida-rojas-montoya', name:'Nelida Rojas Montoya', rut:'11506952-7'}
];
const state = { quantities: {}, manualPrices: {}, drinks: 0, workerPayment: 0, workerRecords: {} };
const STORAGE_KEY = 'pichangas-daily-sales';
const PENDING_DELIVERIES_KEY = 'pichangas-pending-deliveries';
const EXPENSES_KEY = 'pichangas-business-expenses';
const ORDERS_KEY = 'pichangas-order-list';
const ACTIVE_SHIFT_DATE_KEY = 'pichangas-active-shift-date';
const CLOSING_DRAFT_KEY = 'pichangas-closing-draft';
const VIEW_TITLES = { resumen:'Resumen del negocio', cierre:'Cierre diario', repartos:'Repartos del día', lista:'Lista de pedidos', reportes:'Reportes generales', gastos:'Gastos del negocio' };
const VIEW_ORDER = ['resumen', 'cierre', 'repartos', 'lista', 'reportes', 'gastos'];
const REPORT_PERIODS = { week:'Esta semana', month:'Este mes', year:'Este año' };
const WEEK_STATS_DAYS = 7;
const DATE_LOCALE = 'es-CL';
const today = new Date();
let activeReportPeriod = 'week';
let storageNoticeShown = false;
let toastTimer = null;
let toastHideAt = 0;
let toastRemaining = 3500;
let confirmResolver = null;
let confirmTrigger = null;
let deferredInstallPrompt = null;
let orderDraftItems = [];

const money = (value) => {
  const amount = Math.round(Number(value) || 0);
  return amount < 0 ? `-$${Math.abs(amount).toLocaleString(DATE_LOCALE)}` : `$${amount.toLocaleString(DATE_LOCALE)}`;
};
const isoDate = (date) => { const local = new Date(date); local.setMinutes(local.getMinutes() - local.getTimezoneOffset()); return local.toISOString().slice(0,10); };
const prettyDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(DATE_LOCALE,{day:'2-digit',month:'short',year:'numeric'}).replace('.', '');
const numericDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(DATE_LOCALE,{day:'2-digit',month:'2-digit',year:'numeric'});
const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const slugify = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
const formatTodayLabel = (date) => `Hoy · ${prettyDate(isoDate(date))}`;
const saleTotal = (sale) => Number(sale?.menuTotal || 0) + Number(sale?.drinks || 0) + Number(sale?.deliveries || 0);

function refreshIcons(){
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function renderExpenses(){
  const expenses = getExpenses().sort((a, b) => b.date.localeCompare(a.date));
  const totalElement = document.querySelector('#expense-total');
  const countElement = document.querySelector('#expense-count');
  const list = document.querySelector('#expense-list');
  if (totalElement) totalElement.textContent = `−${money(expensesTotal(expenses))}`;
  if (countElement) countElement.textContent = `${expenses.length} ${expenses.length === 1 ? 'gasto' : 'gastos'}`;
  if (!list) return;
  list.innerHTML = expenses.length ? expenses.map((expense, index) => `<div class="delivery-row expense-row"><div><b>${escapeHTML(expense.name)}</b><small>${prettyDate(expense.date)} · −${money(expense.amount)}</small></div><button class="remove-delivery" data-remove-expense="${index}" type="button" aria-label="Eliminar gasto de ${escapeHTML(expense.name)}"><i class="icon" data-lucide="trash-2" aria-hidden="true"></i></button></div>`).join('') : `<div class="empty-deliveries"><span class="empty-mark"><i class="icon" data-lucide="wallet-cards" aria-hidden="true"></i></span><div><strong>Sin gastos</strong><p>Agrega una compra para verla aquí.</p></div></div>`;
  refreshIcons();
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

function getExpenses(){
  try {
    const expenses = JSON.parse(localStorage.getItem(EXPENSES_KEY));
    return Array.isArray(expenses) ? expenses : [];
  } catch {
    announceStorageIssue();
    return [];
  }
}

function saveExpenses(expenses){
  try {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
    return true;
  } catch {
    announceStorageIssue();
    return false;
  }
}

function isValidDateKey(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function getActiveShiftDate(){
  try {
    const stored = localStorage.getItem(ACTIVE_SHIFT_DATE_KEY);
    return isValidDateKey(stored) ? stored : isoDate(new Date());
  } catch {
    announceStorageIssue();
    return isoDate(new Date());
  }
}

function saveActiveShiftDate(date){
  if (!isValidDateKey(date)) return false;
  try {
    localStorage.setItem(ACTIVE_SHIFT_DATE_KEY, date);
    return true;
  } catch {
    announceStorageIssue();
    return false;
  }
}

function saveClosingDraft(){
  const date = document.querySelector('#sale-date')?.value || getActiveShiftDate();
  const note = document.querySelector('#sale-note')?.value || '';
  try {
    localStorage.setItem(CLOSING_DRAFT_KEY, JSON.stringify({
      date,
      note,
      quantities: state.quantities,
      manualPrices: state.manualPrices,
      drinks: state.drinks,
      workerPayment: state.workerPayment,
      workerRecords: state.workerRecords
    }));
    return true;
  } catch {
    announceStorageIssue();
    return false;
  }
}

function restoreClosingDraft(){
  try {
    const draft = JSON.parse(localStorage.getItem(CLOSING_DRAFT_KEY));
    if (!draft || typeof draft !== 'object') return null;
    if (isValidDateKey(draft.date)) saveActiveShiftDate(draft.date);
    state.quantities = draft.quantities && typeof draft.quantities === 'object' ? draft.quantities : {};
    state.manualPrices = draft.manualPrices && typeof draft.manualPrices === 'object' ? draft.manualPrices : {};
    state.drinks = Math.max(0, Number(draft.drinks) || 0);
    state.workerPayment = Math.max(0, Number(draft.workerPayment) || 0);
    state.workerRecords = draft.workerRecords && typeof draft.workerRecords === 'object' ? draft.workerRecords : {};
    return draft;
  } catch {
    announceStorageIssue();
    return null;
  }
}

function clearClosingDraft(){
  try {
    localStorage.removeItem(CLOSING_DRAFT_KEY);
    return true;
  } catch {
    announceStorageIssue();
    return false;
  }
}

function updateShiftDateUI(date){
  const currentDate = isoDate(new Date());
  const label = document.querySelector('#shift-date-label');
  const hint = document.querySelector('#sale-date-hint');
  if (label) label.textContent = date === currentDate ? 'Turno activo · hoy' : `Turno activo · ${numericDate(date)}`;
  if (hint) hint.textContent = date === currentDate ? 'El turno se mantiene hasta guardar el cierre.' : `Turno iniciado el ${numericDate(date)}. Se cambiará al guardar el cierre.`;
}

function getOrders(){
  try {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY));
    return Array.isArray(orders) ? orders : [];
  } catch {
    announceStorageIssue();
    return [];
  }
}

function saveOrders(orders){
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  } catch {
    announceStorageIssue();
    return false;
  }
}

function orderDraftTotal(){
  return orderDraftItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function orderProductSummary(items){
  return items.map(item => `${item.quantity}× ${item.name} (${money(item.price)})`).join(' + ');
}

function renderOrderDraft(){
  const list = document.querySelector('#order-draft-list');
  const total = orderDraftTotal();
  const count = orderDraftItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalElement = document.querySelector('#order-draft-total');
  const countElement = document.querySelector('#order-draft-count');
  if (totalElement) totalElement.textContent = money(total);
  if (countElement) countElement.textContent = `${count} ${count === 1 ? 'producto' : 'productos'} seleccionados`;
  if (!list) return;
  list.innerHTML = orderDraftItems.length ? orderDraftItems.map((item, index) => `<div class="order-draft-row"><div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.group)} · ${item.quantity} × ${money(item.price)}</small></div><div class="order-draft-actions"><strong>${money(item.price * item.quantity)}</strong><button class="remove-delivery" data-remove-order-draft="${index}" type="button" aria-label="Quitar ${escapeHTML(item.name)} del pedido"><i class="icon" data-lucide="x"></i></button></div></div>`).join('') : `<div class="empty-order-draft"><span class="empty-mark"><i class="icon" data-lucide="shopping-basket"></i></span><div><strong>Arma el pedido aquí</strong><p>Agrega uno o varios productos antes de guardarlo.</p></div></div>`;
  refreshIcons();
}

function updateOrderProductOptions(category = document.querySelector('#order-category')?.value || ''){
  const select = document.querySelector('#order-product');
  if (!select) return;
  const products = menu[category] || [];
  select.innerHTML = `<option value="">Selecciona una opción</option>${products.map((item, index) => {
    const id = `${category}-${index}`;
    const priceLabel = item.price > 0 ? money(item.price) : 'Precio manual';
    return `<option value="${escapeHTML(id)}">${escapeHTML(item.name)} · ${priceLabel}</option>`;
  }).join('')}`;
  select.disabled = !products.length;
  updateOrderManualPriceField();
}

function updateOrderManualPriceField(){
  const select = document.querySelector('#order-product');
  const field = document.querySelector('#order-manual-price-field');
  const input = document.querySelector('#order-manual-price');
  const product = allProducts.find(item => item.id === select?.value);
  const isManual = product?.price === 0;
  if (field) field.hidden = !isManual;
  if (input) {
    input.disabled = !isManual;
    if (!isManual) input.value = '';
  }
}

function resetOrderDraft(){
  orderDraftItems = [];
  document.querySelector('#order-form')?.reset();
  updateOrderProductOptions('');
  renderOrderDraft();
}

function addOrderDraftProduct(){
  const category = document.querySelector('#order-category')?.value || '';
  const productSelect = document.querySelector('#order-product');
  const quantityInput = document.querySelector('#order-quantity');
  const manualPriceInput = document.querySelector('#order-manual-price');
  const product = allProducts.find(item => item.id === productSelect?.value);
  const parsedQuantity = parseInt(quantityInput?.value, 10);
  const quantity = Math.min(30, Math.max(0, Number.isFinite(parsedQuantity) ? parsedQuantity : 0));
  const price = product?.price > 0 ? product.price : Math.max(0, Number(manualPriceInput?.value) || 0);
  if (!category || !product) { toast('Selecciona una categoría y un producto.', 'error'); return; }
  if (!quantity) { toast('Ingresa una cantidad mayor que 0.', 'error'); quantityInput?.focus(); return; }
  if (!(price > 0)) { toast('Ingresa el precio unitario de este producto.', 'error'); manualPriceInput?.focus(); return; }
  const existing = orderDraftItems.find(item => item.id === product.id && item.price === price);
  if (existing) existing.quantity = Math.min(30, existing.quantity + quantity);
  else orderDraftItems.push({id:product.id, group:product.group, name:product.name, price, quantity});
  if (productSelect) productSelect.value = '';
  if (quantityInput) quantityInput.value = '1';
  if (manualPriceInput) manualPriceInput.value = '';
  updateOrderManualPriceField();
  renderOrderDraft();
  toast(`${product.name} agregado al pedido.`, 'info');
}

function renderOrders(){
  const orders = getOrders();
  document.querySelectorAll('#order-count, #order-list-count').forEach(element => { element.textContent = orders.length; });
  const list = document.querySelector('#order-list');
  if (!list) return;
  list.innerHTML = orders.length ? orders.map((order, index) => {
    const items = Array.isArray(order.items) && order.items.length ? order.items : [{name:order.category || 'Pedido', group:order.category || '', price:Number(order.price) || 0, quantity:Number(order.quantity) || 1}];
    const summary = orderProductSummary(items);
    const phone = String(order.contact || '').match(/[+]?\d[\d\s-]{7,}/)?.[0]?.replace(/\D/g, '') || '';
    const whatsappText = `Pedido Foodtruck\n${summary}\nDirección: ${order.address || ''}`;
    const whatsapp = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}` : '';
    return `<div class="order-row"><div><strong>${escapeHTML(summary)}</strong><small>${escapeHTML(order.address || '')} · ${escapeHTML(order.contact || '')}</small></div><div class="order-actions">${whatsapp ? `<a class="whatsapp-button" href="${whatsapp}" target="_blank" rel="noopener"><i class="icon" data-lucide="message-circle"></i> WhatsApp</a>` : ''}<button class="remove-delivery" data-remove-order="${index}" type="button" aria-label="Eliminar pedido"><i class="icon" data-lucide="trash-2"></i></button></div></div>`;
  }).join('') : `<div class="empty-deliveries"><span class="empty-mark"><i class="icon" data-lucide="clipboard-list"></i></span><div><strong>Lista vacía</strong><p>Agrega el primer pedido pendiente.</p></div></div>`;
  refreshIcons();
}

function setupOrderForm(){
  const category = document.querySelector('#order-category');
  if (category && category.options.length === 1) category.insertAdjacentHTML('beforeend', Object.keys(menu).map(group => `<option value="${escapeHTML(group)}">${escapeHTML(group)}</option>`).join(''));
  updateOrderProductOptions(category?.value || '');
  renderOrderDraft();
}

function expensesTotal(expenses){
  return expenses.reduce((sum, expense) => sum + Math.max(0, Number(expense.amount) || 0), 0);
}

function inPeriod(date, period){
  return date >= getPeriodStart(period) && date <= getActiveShiftDate();
}

function getPeriodStart(period){
  const date = new Date(`${getActiveShiftDate()}T12:00:00`);
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
  const workerPayment = workers.reduce((sum, worker) => sum + Math.max(0, Number(state.workerRecords[worker.id]?.payment) || 0), 0);
  const total = menuTotal + drinks + deliveryTotal;
  return { products, menuTotal, drinks, deliveries: deliveryTotal, deliveryCount: deliveries.length, workerPayment, workers: workers.map(worker => ({...worker, present:Boolean(state.workerRecords[worker.id]?.present), rest:Boolean(state.workerRecords[worker.id]?.rest), payment:Math.max(0, Number(state.workerRecords[worker.id]?.payment) || 0)})), total, netTotal: total - workerPayment };
}

function renderProducts(){
  const container = document.querySelector('#product-groups');
  if (!container) return;
  container.innerHTML = Object.entries(menu).map(([group, items]) => {
    const groupId = slugify(group);
    return `
      <details class="product-group group-${groupId}" data-group="${escapeHTML(group)}">
        <summary>
          <span class="group-title">${escapeHTML(group)}</span>
          <span class="group-count">${items.length} opciones</span>
        </summary>
        <div class="group-items">
          ${items.map((item, index) => {
            const id = `${group}-${index}`;
            const inputId = `q-${slugify(id)}-${index}`;
            const manualId = `price-${slugify(id)}-${index}`;
            const isManual = item.price === 0;
            const currentQuantity = Number(state.quantities[id]) || 0;
            const quantityValue = currentQuantity > 0 ? currentQuantity : '';
            return `
              <div class="sale-product${isManual ? ' manual-product' : ''}">
                <div class="product-copy">
                  <label for="${inputId}"><span class="product-name">${escapeHTML(item.name)}</span><small class="product-price">${item.price ? money(item.price) : 'Precio manual'}</small></label>
                  ${isManual ? `<label class="manual-price-field" for="${manualId}"><span>Precio unitario</span><input id="${manualId}" data-manual-price="${escapeHTML(id)}" type="number" min="1" step="100" value="${state.manualPrices[id] || ''}" placeholder="$ 0" inputmode="numeric" aria-describedby="manual-error-${slugify(id)}"><small class="field-error" id="manual-error-${slugify(id)}" data-manual-error="${escapeHTML(id)}" role="alert"></small></label>` : ''}
                </div>
                <label class="quantity-label" for="${inputId}"><span class="visually-hidden">Cantidad de ${escapeHTML(item.name)}</span><input class="quantity-input" id="${inputId}" data-quantity="${escapeHTML(id)}" type="number" min="0" max="30" step="1" value="${quantityValue}" inputmode="numeric" placeholder="0"></label>
                <strong class="product-subtotal" data-subtotal="${escapeHTML(id)}">${money((state.quantities[id] || 0) * (item.price || state.manualPrices[id] || 0))}</strong>
              </div>`;
          }).join('')}
        </div>
      </details>`;
  }).join('');
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
    '#closing-worker-payment': money(totals.workerPayment),
    '#closing-delivery-count': totals.deliveryCount,
    '#closing-total': money(totals.total),
    '#closing-net-total': money(totals.netTotal)
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
  const summary = document.querySelector('.closing-summary');
  if (summary) summary.classList.toggle('is-complete', totals.total > 0);
}

function getWorkerStreak(workerId, throughDate = getActiveShiftDate()){
  const dates = new Set(getSales().filter(sale => sale.workers?.some(worker => worker.id === workerId && (worker.present || worker.rest))).map(sale => sale.date));
  const currentRecord = state.workerRecords[workerId];
  if (throughDate === getActiveShiftDate() && (currentRecord?.present || currentRecord?.rest)) dates.add(throughDate);
  let streak = 0;
  const cursor = new Date(`${throughDate}T12:00:00`);
  while (dates.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderWorkers(){
  const list = document.querySelector('#worker-list');
  if (!list) return;
  const count = workers.filter(worker => state.workerRecords[worker.id]?.present).length;
  const countElement = document.querySelector('#worker-count');
  if (countElement) countElement.textContent = `${count} ${count === 1 ? 'presente' : 'presentes'}`;
  list.innerHTML = workers.map(worker => {
    const record = state.workerRecords[worker.id] || {};
    const streak = getWorkerStreak(worker.id);
    return `<div class="worker-row${record.present ? ' is-present' : ''}${record.rest ? ' is-rest' : ''}">
      <div class="worker-identity"><strong>${escapeHTML(worker.name)}</strong><small>RUT ${escapeHTML(worker.rut)}</small><span class="worker-streak" aria-label="${streak} ${streak === 1 ? 'día' : 'días'} seguidos">🔥 ${streak} ${streak === 1 ? 'día' : 'días'}</span></div>
      <div class="worker-toggles">
        <label class="worker-attendance"><input type="checkbox" data-worker-present="${worker.id}" ${record.present ? 'checked' : ''}><span>Vino</span></label>
        <label class="worker-rest"><input type="checkbox" data-worker-rest="${worker.id}" ${record.rest ? 'checked' : ''}><span>Descanso</span></label>
      </div>
      <label class="worker-payment-field"><span>Paga</span><input type="number" min="0" step="100" inputmode="numeric" placeholder="$ 0" data-worker-payment="${worker.id}" value="${record.payment || ''}" ${record.present ? '' : 'disabled'}></label>
    </div>`;
  }).join('');
}

function resetClosing({persist = true} = {}){
  state.quantities = {};
  state.manualPrices = {};
  state.drinks = 0;
  state.workerPayment = 0;
  state.workerRecords = {};
  const drinksInput = document.querySelector('#drinks-input');
  const workerPaymentInput = document.querySelector('#worker-payment-input');
  const noteInput = document.querySelector('#sale-note');
  if (drinksInput) drinksInput.value = '';
  if (workerPaymentInput) workerPaymentInput.value = '';
  if (noteInput) noteInput.value = '';
  renderProducts();
  renderWorkers();
  renderClosingSummary();
  if (persist) saveClosingDraft();
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

function renderDashboardDelivery(){
  const container = document.querySelector('#dashboard-delivery');
  if (!container) return;
  const sale = getSales().find(item => item.date === getActiveShiftDate());
  const count = Number(sale?.deliveryCount || 0);
  const total = Number(sale?.deliveries || 0);
  if (!count) {
    container.innerHTML = `<div class="dashboard-delivery-row"><div class="delivery-label"><i class="icon" data-lucide="package-check" aria-hidden="true"></i><div><strong>Sin repartos hechos</strong><small>Los repartos realizados aparecerán al guardar el cierre.</small></div></div><span class="delivery-status"><span class="dot"></span>0 hoy</span></div>`;
    return;
  }
  container.innerHTML = `<div class="dashboard-delivery-row"><div class="delivery-label"><i class="icon" data-lucide="package-check" aria-hidden="true"></i><div><strong>${count} repartos hechos</strong><small>${money(total)} registrados en el cierre de hoy.</small></div></div><button class="inline-action" data-view-link="repartos" type="button">Ver repartos <i class="icon" data-lucide="arrow-right" aria-hidden="true"></i></button></div>`;
}

function buildWeekStats(sales){
  const shiftDate = getActiveShiftDate();
  return Array.from({length:WEEK_STATS_DAYS}, (_, index) => {
    const date = new Date(`${shiftDate}T12:00:00`);
    date.setDate(date.getDate() - (WEEK_STATS_DAYS - 1 - index));
    const key = isoDate(date);
    const sale = sales.find(item => item.date === key);
    return {
      date: key,
      label: date.toLocaleDateString(DATE_LOCALE, {weekday:'short'}).replace('.', ''),
      shortLabel: date.toLocaleDateString(DATE_LOCALE, {day:'2-digit', month:'short'}).replace('.', ''),
      value: sale ? saleTotal(sale) : 0,
      hasRecord: Boolean(sale),
      isToday: key === shiftDate
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
    container.innerHTML = `<div class="empty-activity"><div class="empty-mark"><i class="icon" data-lucide="clipboard-list" aria-hidden="true"></i></div><div><h4>Registra un cierre para ver tu semana</h4><p>Usa el botón “Registrar cierre” de arriba para comenzar.</p></div></div>`;
    refreshIcons();
    return;
  }
  container.innerHTML = `<div class="activity-list">${recent.slice(0, 7).map(sale => `<div class="activity-row"><div><strong>${prettyDate(sale.date)}</strong><small>${sale.products || 0} productos · Menú ${money(sale.menuTotal)}</small></div><strong class="activity-total">${money(saleTotal(sale))}</strong><span class="sale-badge">Guardado</span></div>`).join('')}</div>`;
}

function updateDashboard(){
  const sales = getSales();
  const shiftDate = getActiveShiftDate();
  const todaySale = sales.find(sale => sale.date === shiftDate);
  const week = sales.filter(sale => inPeriod(sale.date, 'week'));
  const month = sales.filter(sale => inPeriod(sale.date, 'month'));
  const todayTotal = todaySale ? saleTotal(todaySale) : 0;
  const summaryToday = document.querySelector('#summary-today');
  const summaryOrders = document.querySelector('#summary-orders');
  const heroStatus = document.querySelector('#hero-status');
  if (summaryToday) summaryToday.textContent = money(todayTotal);
  if (heroStatus) heroStatus.textContent = todaySale ? 'Cierre registrado' : 'Aún no registrado';
  if (summaryOrders) summaryOrders.textContent = todaySale ? 'Resultado neto registrado en reportes.' : 'Ingresa tus productos, bebidas y repartos para cerrar la jornada.';
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
  renderDashboardExpenses();
  refreshIcons();
}

function renderDashboardExpenses(){
  const container = document.querySelector('#dashboard-expenses');
  if (!container) return;
  const expenses = getExpenses().filter(expense => expense.date === getActiveShiftDate());
  const total = expensesTotal(expenses);
  container.innerHTML = expenses.length
    ? `<div class="dashboard-expense-row"><div class="delivery-label"><i class="icon" data-lucide="trending-down" aria-hidden="true"></i><div><strong>−${money(total)}</strong><small>${expenses.length} compras registradas hoy.</small></div></div><button class="inline-action" data-view-link="gastos" type="button">Ver gastos <i class="icon" data-lucide="arrow-right" aria-hidden="true"></i></button></div>`
    : `<div class="dashboard-expense-row"><div class="delivery-label"><i class="icon" data-lucide="wallet-cards" aria-hidden="true"></i><div><strong>Sin gastos registrados</strong><small>Las compras del carro aparecerán aquí.</small></div></div><button class="inline-action" data-view-link="gastos" type="button">Agregar gasto <i class="icon" data-lucide="arrow-right" aria-hidden="true"></i></button></div>`;
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
  const deliveryRevenue = sales.reduce((sum, sale) => sum + Number(sale.deliveries || 0), 0);
  const deliveryCount = sales.reduce((sum, sale) => sum + Number(sale.deliveryCount || 0), 0);
  const payments = sales.reduce((sum, sale) => sum + Number(sale.workerPayment || 0), 0);
  const expenses = getExpenses().filter(expense => inPeriod(expense.date, period));
  const expenseAmount = expensesTotal(expenses);
  const values = {
    '#report-total': money(total),
    '#report-days': `${sales.length} días registrados`,
    '#report-products': products,
    '#report-deliveries': money(deliveryRevenue),
    '#report-delivery-count': `${deliveryCount} ${deliveryCount === 1 ? 'entrega' : 'entregas'}`,
    '#report-net': money(total - payments - expenseAmount),
    '#report-payments': `Pagos: ${money(payments)} · Gastos: ${money(expenseAmount)}`
  };
  Object.entries(values).forEach(([selector, value]) => { const element = document.querySelector(selector); if (element) element.textContent = value; });
  const rows = document.querySelector('#report-rows');
  if (!rows) return;
  rows.innerHTML = sales.length || expenses.length ? [...sales.map(sale => `<div class="report-row"><div class="report-date"><strong>${prettyDate(sale.date)}</strong><small>Cierre · ${sale.products || 0} productos</small></div><div class="report-breakdown"><span>Ventas ${money(saleTotal(sale))}</span><span>Repartos ${money(sale.deliveries)}</span><span>Trabajadores ${money(sale.workerPayment)}</span></div><strong class="report-total-value">${money(saleTotal(sale) - Number(sale.workerPayment || 0))}</strong></div>`), ...expenses.map(expense => `<div class="report-row expense-report-row"><div class="report-date"><strong>${prettyDate(expense.date)}</strong><small>Gasto · ${escapeHTML(expense.name)}</small></div><div class="report-breakdown"><span class="negative-value">−${money(expense.amount)}</span></div><strong class="report-total-value negative-value">−${money(expense.amount)}</strong></div>`)].join('') : `<div class="report-empty"><span class="empty-mark"><i class="icon" data-lucide="clipboard-list" aria-hidden="true"></i></span><div><strong>No hay movimientos en ${REPORT_PERIODS[period].toLowerCase()}.</strong><p>Registra un cierre o un gasto para empezar a ver el rendimiento.</p></div><button class="inline-action" data-view-link="cierre" type="button">Registrar cierre <i class="icon" data-lucide="arrow-right" aria-hidden="true"></i></button></div>`;
  renderReportChart(sales, period);
  refreshIcons();
}

function renderReportChart(sales, period){
  const svg = document.querySelector('#report-chart');
  if (!svg) return;
  const width = 760;
  const height = 280;
  const points = sales.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  if (!points.length) {
    svg.innerHTML = '<text class="report-chart-empty" x="380" y="140" text-anchor="middle">Registra cierres para ver el gráfico</text>';
    return;
  }
  const max = Math.max(...points.map(sale => saleTotal(sale)), 1);
  const left = 46;
  const bottom = 38;
  const chartHeight = 185;
  const step = (width - left - 24) / points.length;
  const barWidth = Math.min(34, step * .55);
  const bars = points.map((sale, index) => {
    const value = saleTotal(sale);
    const barHeight = Math.max(3, value / max * chartHeight);
    const x = left + step * index + (step - barWidth) / 2;
    const y = height - bottom - barHeight;
    return `<g><rect class="report-chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="5"></rect><text class="report-chart-value" x="${(x + barWidth / 2).toFixed(1)}" y="${Math.max(16, y - 8).toFixed(1)}" text-anchor="middle">${escapeHTML(money(value))}</text><text class="report-chart-label" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 15}" text-anchor="middle">${escapeHTML(prettyDate(sale.date).slice(0, 5))}</text></g>`;
  }).join('');
  svg.innerHTML = `<line class="report-chart-axis" x1="${left}" y1="${height - bottom}" x2="${width - 20}" y2="${height - bottom}"></line>${bars}`;
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
  if (view === 'lista') renderOrders();
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
  if (window.Swal?.fire) {
    window.Swal.fire({
      toast: true,
      position: 'top-end',
      icon: tone === 'error' ? 'error' : tone === 'info' ? 'info' : 'success',
      title: message,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }
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
  if (window.Swal?.fire) {
    return window.Swal.fire({
      title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmLabel,
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => result.isConfirmed);
  }
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
  const date = dateInput.value || getActiveShiftDate();
  if (!date) { toast('Selecciona una fecha.', 'error'); dateInput.focus(); return; }
  const missingManual = [...document.querySelectorAll('[data-manual-error].is-visible')];
  if (missingManual.length) { toast('Completa los precios manuales antes de guardar.', 'error'); missingManual[0].parentElement.querySelector('[data-manual-price]')?.focus(); return; }
  const pendingDeliveries = getPendingDeliveries();
  const totals = currentTotals();
  if (!totals.products && !totals.drinks && !totals.deliveries) { toast('Ingresa al menos una venta.', 'error'); return; }
  const sales = getSales();
  const existing = sales.find(sale => sale.date === date);
  const confirmed = existing ? await askConfirmation({title:'¿Reemplazar el cierre?', message:'Ya existe un cierre para esta fecha. Si continúas, se reemplazará con los datos actuales.', confirmLabel:'Reemplazar', trigger:document.querySelector('#save-sale')}) : true;
  if (!confirmed) return;
  const nextSales = sales.filter(sale => sale.date !== date);
  nextSales.push({
    ...totals,
    date,
    note:document.querySelector('#sale-note').value.trim(),
    manualPrices:{...state.manualPrices},
    deliveryItems:pendingDeliveries.map(item => ({name:item.name, amount:Number(item.amount) || 0})),
    shiftClosedAt:new Date().toISOString()
  });
  if (!saveSales(nextSales)) return;
  if (!savePendingDeliveries([])) {
    saveSales(sales);
    toast('No se pudo completar el guardado. Tus datos anteriores fueron restaurados.', 'error');
    return;
  }
  clearClosingDraft();
  const nextShiftDate = isoDate(new Date());
  saveActiveShiftDate(nextShiftDate);
  resetClosing({persist:false});
  if (dateInput) {
    dateInput.max = nextShiftDate;
    dateInput.value = nextShiftDate;
  }
  updateShiftDateUI(nextShiftDate);
  renderPendingDeliveries();
  updateDashboard();
  renderReport(activeReportPeriod);
  toast(existing ? 'Cierre actualizado.' : 'Cierre guardado y repartos archivados en Reportes.');
  switchView('resumen');
}

function exportReport(){
  const sales = getSales().filter(sale => inPeriod(sale.date, activeReportPeriod));
  if (!sales.length) { toast(`No hay cierres en ${REPORT_PERIODS[activeReportPeriod].toLowerCase()}.`, 'info'); return; }
  const escapeXML = value => String(value ?? '').replace(/[<>&'"]/g, character => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[character]));
  const headers = ['Fecha','Productos','Menu','Bebidas','Repartos','Cantidad repartos','Total ventas','Pago trabajadores','Resultado neto','Detalle trabajadores','Nota'];
  const rows = sales.map(sale => [sale.date, sale.products || 0, sale.menuTotal || 0, sale.drinks || 0, sale.deliveries || 0, sale.deliveryCount || 0, saleTotal(sale), sale.workerPayment || 0, saleTotal(sale) - Number(sale.workerPayment || 0), (sale.workers || []).map(worker => `${worker.name} (${worker.rut}) ${worker.present ? 'vino' : worker.rest ? 'descanso' : 'no vino'} ${money(worker.payment)}`).join(' | '), sale.note || '']);
  const xmlRows = [headers, ...rows].map((row, rowIndex) => `<Row>${row.map(value => `<Cell${rowIndex === 0 ? ' ss:StyleID="Header"' : ''}><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${escapeXML(value)}</Data></Cell>`).join('')}</Row>`).join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#287E80" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="Cierres"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
  const blob = new Blob([workbook], {type:'application/vnd.ms-excel'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `reporte-${activeReportPeriod}.xls`;
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
  if (event.target.closest('#add-order-product')) {
    addOrderDraftProduct();
    return;
  }
  const removeOrderDraft = event.target.closest('[data-remove-order-draft]');
  if (removeOrderDraft) {
    orderDraftItems.splice(Number(removeOrderDraft.dataset.removeOrderDraft), 1);
    renderOrderDraft();
    return;
  }
  const removeOrder = event.target.closest('[data-remove-order]');
  if (removeOrder) {
    const orders = getOrders();
    orders.splice(Number(removeOrder.dataset.removeOrder), 1);
    if (saveOrders(orders)) { renderOrders(); toast('Pedido eliminado.', 'info'); }
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
  const removeExpense = event.target.closest('[data-remove-expense]');
  if (removeExpense) {
    const expenses = getExpenses();
    expenses.splice(Number(removeExpense.dataset.removeExpense), 1);
    if (saveExpenses(expenses)) { renderExpenses(); updateDashboard(); toast('Gasto eliminado.', 'info'); }
    return;
  }
  if (event.target.closest('#clear-expenses')) {
    if (!getExpenses().length) { toast('La lista de gastos ya está vacía.', 'info'); return; }
    askConfirmation({title:'¿Vaciar los gastos?', message:'Se eliminará todo el historial de gastos.', confirmLabel:'Vaciar gastos', trigger:event.target.closest('#clear-expenses')}).then(confirmed => { if (confirmed && saveExpenses([])) { renderExpenses(); updateDashboard(); toast('Gastos eliminados.', 'info'); } });
    return;
  }
  if (event.target.closest('#clear-orders')) {
    if (!getOrders().length) { toast('La lista ya está vacía.', 'info'); return; }
    askConfirmation({title:'¿Vaciar la lista?', message:'Se eliminarán todos los pedidos pendientes.', confirmLabel:'Vaciar lista'}).then(confirmed => { if (confirmed && saveOrders([])) { renderOrders(); toast('Lista vaciada.', 'info'); } });
    return;
  }
  if (event.target.closest('#export-report')) { exportReport(); return; }
  if (event.target.closest('#toast-close')) hideToast();
}

function handleDocumentInput(event){
  const target = event.target;
  if (target.matches('#order-category')) updateOrderProductOptions(target.value);
  if (target.matches('#order-product')) updateOrderManualPriceField();
  if (target.matches('[data-quantity]')) {
    const quantity = Math.min(30, Math.max(0, parseInt(target.value, 10) || 0));
    target.value = quantity;
    state.quantities[target.dataset.quantity] = quantity;
    renderClosingSummary();
  }

  if (target.matches('[data-manual-price]')) {
    state.manualPrices[target.dataset.manualPrice] = Math.max(0, Number(target.value) || 0);
    renderClosingSummary();
  }
  if (target.matches('#worker-payment-input')) {
    state.workerPayment = Math.max(0, Number(target.value) || 0);
    renderClosingSummary();
  }
  if (target.matches('[data-worker-present]')) {
    const id = target.dataset.workerPresent;
    state.workerRecords[id] = {...state.workerRecords[id], present:target.checked, rest:false};
    renderWorkers();
    renderClosingSummary();
  }
  if (target.matches('[data-worker-rest]')) {
    const id = target.dataset.workerRest;
    state.workerRecords[id] = {...state.workerRecords[id], rest:target.checked, present:false, payment:target.checked ? 0 : state.workerRecords[id]?.payment};
    renderWorkers();
    renderClosingSummary();
  }
  if (target.matches('[data-worker-payment]')) {
    const id = target.dataset.workerPayment;
    state.workerRecords[id] = {...state.workerRecords[id], payment:Math.max(0, Number(target.value) || 0)};
    renderClosingSummary();
  }
  if (target.matches('#drinks-input')) {
    state.drinks = Math.max(0, Number(target.value) || 0);
    renderClosingSummary();
  }
  if (target.matches('#sale-date')) {
    const date = target.value;
    if (isValidDateKey(date)) {
      saveActiveShiftDate(date);
      updateShiftDateUI(date);
    }
  }
  if (target.closest('#view-cierre')) saveClosingDraft();
}

function setupSwipeNavigation(){
  let startX = 0;
  let startY = 0;
  let swipeAllowed = false;
  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) return;
    const target = event.target;
    swipeAllowed = Boolean(target.closest('.view')) &&
      !target.closest('button, a, input, textarea, select, svg, .report-chart-wrap, .stats-chart-shell, .period-tabs, .mobile-bottom-nav');
    if (!swipeAllowed) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, {passive:true});
  document.addEventListener('touchend', event => {
    if (!swipeAllowed || !startX || event.changedTouches.length !== 1) return;
    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    startX = 0;
    swipeAllowed = false;
    if (Math.abs(deltaX) < 100 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.35) return;
    const activeView = document.querySelector('.view.active-view')?.id.replace('view-', '');
    const currentIndex = VIEW_ORDER.indexOf(activeView);
    if (currentIndex < 0) return;
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    if (VIEW_ORDER[nextIndex]) switchView(VIEW_ORDER[nextIndex]);
  }, {passive:true});
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
  const splash = document.querySelector('#app-splash');
  window.setTimeout(() => splash?.classList.add('is-hidden'), 950);
  setupPWA();
  if (window.AOS?.init) {
    document.querySelectorAll('.page-content > *, .panel, .flat-section, .command-hero, .product-group').forEach((element, index) => {
      element.dataset.aos = 'fade-up';
      element.dataset.aosDelay = String(Math.min(index * 35, 240));
    });
    window.AOS.init({duration: 520, easing: 'ease-out-cubic', once: true, offset: 18});
  }
  const draft = restoreClosingDraft();
  const saleDate = document.querySelector('#sale-date');
  const shiftDate = getActiveShiftDate();
  saleDate.max = isoDate(new Date());
  saleDate.value = shiftDate;
  updateShiftDateUI(shiftDate);
  const drinksInput = document.querySelector('#drinks-input');
  const noteInput = document.querySelector('#sale-note');
  if (drinksInput) drinksInput.value = state.drinks || '';
  if (noteInput) noteInput.value = draft?.note || '';
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('input', handleDocumentInput);
  document.addEventListener('change', handleDocumentInput);
  document.addEventListener('keydown', handleTabKeydown);
  setupSwipeNavigation();
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
  document.querySelector('#expense-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = document.querySelector('#expense-name');
    const amount = document.querySelector('#expense-amount');
    const nameError = document.querySelector('#expense-name-error');
    const amountError = document.querySelector('#expense-amount-error');
    nameError.textContent = '';
    amountError.textContent = '';
    if (!name.value.trim()) { nameError.textContent = 'Escribe qué compraste.'; name.focus(); return; }
    if (!(Number(amount.value) > 0)) { amountError.textContent = 'Ingresa un monto mayor que $0.'; amount.focus(); return; }
    const expenses = getExpenses();
    expenses.push({name:name.value.trim(), amount:Number(amount.value), date:getActiveShiftDate()});
    if (!saveExpenses(expenses)) return;
    event.currentTarget.reset();
    renderExpenses();
    updateDashboard();
    toast('Gasto guardado como plata negativa.');
  });
  document.querySelector('#order-form').addEventListener('submit', event => {
    event.preventDefault();
    const address = document.querySelector('#order-address');
    const contact = document.querySelector('#order-contact');
    if (!orderDraftItems.length) { toast('Agrega al menos un producto al pedido.', 'error'); return; }
    if (!address.value.trim() || !contact.value.trim()) { toast('Completa dirección y contacto.', 'error'); return; }
    const orders = getOrders();
    orders.push({
      items: orderDraftItems.map(item => ({...item})),
      total: orderDraftTotal(),
      address: address.value.trim(),
      contact: contact.value.trim(),
      createdAt: new Date().toISOString()
    });
    if (!saveOrders(orders)) return;
    resetOrderDraft();
    renderOrders();
    toast('Pedido agregado a la lista.');
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
  renderExpenses();
  const toastElement = document.querySelector('#toast');
  toastElement.addEventListener('mouseenter', pauseToast);
  toastElement.addEventListener('mouseleave', resumeToast);
  toastElement.addEventListener('focusin', pauseToast);
  toastElement.addEventListener('focusout', resumeToast);
  renderProducts();
  renderWorkers();
  renderPendingDeliveries();
  setupOrderForm();
  renderOrders();
  renderClosingSummary();
  updateDashboard();
  renderReport();
  refreshIcons();
}

document.addEventListener('DOMContentLoaded', init);
