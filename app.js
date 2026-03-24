// =====================================================
//  FINANÇA ROSA — Lógica Principal
// =====================================================

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const DEFAULT_CATEGORIES = [
  'Assinaturas','Beleza','Contas','Despesas eventuais','Eletrônicos',
  'Lazer','Mercado','Necessidades','Presentes','Prestações','Restaurante',
  'Roupas','Saúde','Transporte','Saídas'
];
const CATEGORY_ICONS = {
  'Assinaturas':'📱','Beleza':'💄','Contas':'🏠','Despesas eventuais':'🎲',
  'Eletrônicos':'💻','Lazer':'🎉','Mercado':'🛒','Necessidades':'🧺',
  'Presentes':'🎁','Prestações':'💳','Restaurante':'🍽️','Roupas':'👗',
  'Saúde':'💊','Transporte':'🚗','Saídas':'🌙','Poupança':'🐷',
  'Salário':'💰','Outro':'📌',
};

const APP = {
  uid: null, user: null,
  currentMonth: new Date().getMonth() + 1,
  currentYear:  new Date().getFullYear(),
  annualYear:   new Date().getFullYear(), // separado para o ecrã anual
  settings: { name:'', salary:0, categories:[...DEFAULT_CATEGORIES], currency:'€' },
  _saving: false // guard contra duplo submit
};


// ═══════════════════════════════════════════════════
//  CUSTOM DIALOGS
// ═══════════════════════════════════════════════════
function showConfirm({ icon='🗑️', title, message, confirmText='Confirmar', cancelText='Cancelar', danger=false }) {
  return new Promise(resolve => {
    document.getElementById('dialog-icon').textContent    = icon;
    document.getElementById('dialog-title').textContent   = title;
    document.getElementById('dialog-message').textContent = message;
    document.getElementById('dialog-input').style.display = 'none';
    const btnClass = danger ? 'btn-danger' : 'btn-primary';
    document.getElementById('dialog-buttons').innerHTML = `
      <button class="btn-outline" onclick="closeDialog(false)">${cancelText}</button>
      <button class="${btnClass}" onclick="closeDialog(true)">${confirmText}</button>`;
    document.getElementById('dialog-overlay').classList.add('open');
    window._dialogResolve = resolve;
  });
}

function showPrompt({ icon='✏️', title, message='', placeholder='', defaultValue='', inputType='text' }) {
  return new Promise(resolve => {
    document.getElementById('dialog-icon').textContent    = icon;
    document.getElementById('dialog-title').textContent   = title;
    document.getElementById('dialog-message').textContent = message;
    const input = document.getElementById('dialog-input');
    input.style.display = 'block';
    input.type = inputType; input.placeholder = placeholder; input.value = defaultValue;
    document.getElementById('dialog-buttons').innerHTML = `
      <button class="btn-outline" onclick="closeDialog(null)">Cancelar</button>
      <button class="btn-primary" onclick="closeDialog(document.getElementById('dialog-input').value)">Confirmar</button>`;
    document.getElementById('dialog-overlay').classList.add('open');
    window._dialogResolve = resolve;
    setTimeout(() => input.focus(), 100);
    input.onkeydown = e => { if (e.key === 'Enter') closeDialog(input.value); };
  });
}

function showAlert({ icon='ℹ️', title, message }) {
  return new Promise(resolve => {
    document.getElementById('dialog-icon').textContent    = icon;
    document.getElementById('dialog-title').textContent   = title;
    document.getElementById('dialog-message').textContent = message;
    document.getElementById('dialog-input').style.display = 'none';
    document.getElementById('dialog-buttons').innerHTML   =
      `<button class="dialog-btn-only" onclick="closeDialog(true)">Ok</button>`;
    document.getElementById('dialog-overlay').classList.add('open');
    window._dialogResolve = resolve;
  });
}

function closeDialog(value) {
  document.getElementById('dialog-overlay').classList.remove('open');
  if (window._dialogResolve) { window._dialogResolve(value); window._dialogResolve = null; }
}


// ═══════════════════════════════════════════════════
//  ARRANQUE
// ═══════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  const user = await ensureAuth();
  if (user) { await initApp(user); } else { showLoginScreen(); }

  document.getElementById('btn-google-login').addEventListener('click', async () => {
    try {
      setLoginLoading(true);
      await initApp(await signInWithGoogle());
    } catch(e) {
      console.error('[Login Google]', e);
      showToast('Erro ao entrar com Google.');
      setLoginLoading(false);
    }
  });

  document.getElementById('btn-anonymous-login').addEventListener('click', async () => {
    try {
      setLoginLoading(true);
      await initApp(await signInAnonymous());
    } catch(e) {
      console.error('[Login Anónimo]', e);
      showToast('Erro ao criar sessão.');
      setLoginLoading(false);
    }
  });
});

async function initApp(user) {
  APP.uid = user.uid; APP.user = user;
  const saved = await DB.getSettings(APP.uid);
  if (saved) APP.settings = { ...APP.settings, ...saved };
  if (!APP.settings.categories?.length) {
    APP.settings.categories = [...DEFAULT_CATEGORIES];
  } else {
    // Garantir que categorias novas (Prestações, Poupança) estão presentes
    const missing = DEFAULT_CATEGORIES.filter(c => !APP.settings.categories.includes(c));
    if (missing.length) {
      APP.settings.categories = [...APP.settings.categories, ...missing].sort();
      await DB.saveSettings(APP.uid, APP.settings);
    }
  }
  setupNavigation(); setupMonthNav(); setupTypeSelector(); setupAnnualYearNav(); initSpeedDial();
  updateMonthDisplay(); await loadDashboard();
  updateFirebaseStatus(true);
  hideLoginScreen(); showApp(); hideLoading();
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 400); }
}
function showLoginScreen()  { hideLoading(); document.getElementById('login-screen').classList.remove('hidden'); }
function hideLoginScreen()  { document.getElementById('login-screen').classList.add('hidden'); }
function showApp()          { document.getElementById('app').classList.remove('hidden'); }
function setLoginLoading(l) {
  ['btn-google-login','btn-anonymous-login'].forEach(id => {
    const el = document.getElementById(id);
    el.disabled = l; el.style.opacity = l ? '0.6' : '1';
  });
}
function updateFirebaseStatus(online) {
  const dot  = document.querySelector('.firebase-dot');
  const text = document.getElementById('firebase-status-text');
  if (!dot || !text) return;
  dot.classList.toggle('online', online); dot.classList.toggle('offline', !online);
  text.textContent = online ? 'Ligado ao Firebase · dados sincronizados' : 'Modo offline · dados guardados localmente';
}


// ═══════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2800);
}


// ═══════════════════════════════════════════════════
//  NAVEGAÇÃO
// ═══════════════════════════════════════════════════
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn =>
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen)));
}

function navigateTo(name) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  // Header de mês só em Início e Gastos
  const showMonthHeader = ['home','gastos'].includes(name);
  document.getElementById('app-header').style.display = showMonthHeader ? 'flex' : 'none';
  document.getElementById('fab-add').style.display    = showMonthHeader ? 'flex' : 'none';
  switch(name) {
    case 'home':   loadDashboard();    break;
    case 'gastos': loadTransactions(); break;
    case 'anual':  loadAnnual();       break;
    case 'metas':  loadGoals();        break;
    case 'config': loadConfig();       break;
  }
}


// ═══════════════════════════════════════════════════
//  NAVEGAÇÃO DE MÊS
// ═══════════════════════════════════════════════════
function setupMonthNav() {
  document.getElementById('btn-prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('btn-next-month').addEventListener('click', () => changeMonth(1));
}
function changeMonth(delta) {
  APP.currentMonth += delta;
  if (APP.currentMonth > 12) { APP.currentMonth = 1;  APP.currentYear++; }
  if (APP.currentMonth < 1)  { APP.currentMonth = 12; APP.currentYear--; }
  updateMonthDisplay();
  const active = document.querySelector('.screen.active')?.id?.replace('screen-','');
  if (active && active !== 'anual') navigateTo(active);
}
function updateMonthDisplay() {
  const label = `${MONTH_NAMES[APP.currentMonth - 1]} ${APP.currentYear}`;
  document.getElementById('header-month').textContent   = label;
  document.getElementById('greeting-month').textContent = label;
  document.getElementById('greeting-text').textContent  = APP.settings.name ? `Olá, ${APP.settings.name} 👋` : 'Olá 👋';
}


// ═══════════════════════════════════════════════════
//  NAVEGAÇÃO DE ANO (ecrã Anual)
// ═══════════════════════════════════════════════════
function setupAnnualYearNav() {
  document.getElementById('btn-prev-year').addEventListener('click', () => changeAnnualYear(-1));
  document.getElementById('btn-next-year').addEventListener('click', () => changeAnnualYear(1));
}
function changeAnnualYear(delta) {
  APP.annualYear += delta;
  document.getElementById('annual-year-display').textContent = APP.annualYear;
  // Desativar botão "próximo" se for o ano atual
  document.getElementById('btn-next-year').disabled = APP.annualYear >= new Date().getFullYear();
  loadAnnual();
}


// ═══════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const [transactions, fixedExpenses, allPrestacoes] = await Promise.all([
      DB.getByMonth(APP.uid, 'transactions',  APP.currentMonth, APP.currentYear),
      DB.getByMonth(APP.uid, 'fixedExpenses', APP.currentMonth, APP.currentYear),
      DB.getAllPrestacoes(APP.uid),
    ]);
    // Filtrar prestações ativas neste mês
    const prestacoes = filterActivePrestacoes(allPrestacoes, APP.currentMonth, APP.currentYear);

    const income      = transactions.filter(t => t.type==='income').reduce((s,t) => s+(t.amount||0), 0);
    const varExp      = transactions.filter(t => t.type!=='income').reduce((s,t) => s+(t.amount||0), 0);
    const fixExp      = fixedExpenses.reduce((s,t) => s+(t.amount||0), 0);
    const prestExp    = prestacoes.reduce((s,t) => s+(t.amount||0), 0);
    const totalExp    = varExp + fixExp + prestExp;
    const balance  = income - totalExp;

    document.getElementById('total-income').textContent   = fmt(income);
    document.getElementById('total-expenses').textContent = fmt(totalExp);

    const balEl   = document.getElementById('total-balance');
    const badgeEl = document.getElementById('saldo-badge');
    balEl.textContent = fmt(balance);
    balEl.className   = 'summary-value ' + (balance >= 0 ? 'positive' : 'negative');
    if (badgeEl) {
      badgeEl.textContent = balance >= 0 ? '✓ Positivo' : '↓ Negativo';
      badgeEl.className   = 'saldo-badge ' + (balance >= 0 ? 'positive' : 'negative');
    }

    // FIX: Salário em uso — mostrar % gasto
    renderSalaryBar(totalExp);

    const allExp = [...transactions.filter(t=>t.type!=='income'), ...fixedExpenses, ...prestacoes];
    renderCategoryBars(allExp, totalExp);
    renderFixedStatus(fixedExpenses);
    renderPrestacoes(prestacoes);
  } catch(e) { console.error('[loadDashboard]', e); }
}

// FIX: Salário usado no dashboard
function renderSalaryBar(totalExp) {
  const salary  = APP.settings.salary || 0;
  const el      = document.getElementById('salary-bar-section');
  if (!el) return;
  if (!salary) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const pct = Math.min(100, totalExp / salary * 100);
  const color = pct > 90 ? 'var(--color-primary)' : pct > 70 ? '#BA7517' : 'var(--color-positive)';
  el.innerHTML = `
    <div class="salary-bar-row">
      <span class="salary-bar-label">Do salário gasto</span>
      <span class="salary-bar-pct" style="color:${color}">${pct.toFixed(0)}%</span>
    </div>
    <div class="salary-track">
      <div class="salary-fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <div class="salary-detail">${fmt(totalExp)} de ${fmt(salary)}</div>`;
}

function renderCategoryBars(expenses, total) {
  const container = document.getElementById('category-bars');
  if (!expenses.length) { container.innerHTML = '<p class="empty-state">Ainda sem gastos este mês.</p>'; return; }
  const byCategory = {};
  expenses.forEach(e => { const c = e.category||'Outro'; byCategory[c] = (byCategory[c]||0)+(e.amount||0); });
  container.innerHTML = Object.entries(byCategory).sort((a,b)=>b[1]-a[1])
    .map(([cat, val]) => {
      const pct = total > 0 ? (val/total*100) : 0;
      return `<div class="cat-row">
        <span class="cat-icon">${CATEGORY_ICONS[cat]||'📌'}</span>
        <span class="cat-name">${cat}</span>
        <div class="cat-track"><div class="cat-fill" style="width:${pct.toFixed(1)}%"></div></div>
        <span class="cat-value">${fmt(val)}</span>
      </div>`;
    }).join('');
}

// FIX: Mostrar X/Y fixos pagos
function renderFixedStatus(fixedExpenses) {
  const container = document.getElementById('fixed-status');
  if (!fixedExpenses.length) { container.innerHTML = '<p class="empty-state">Sem gastos fixos este mês.</p>'; return; }
  const paid = fixedExpenses.filter(f => f.paid).length;
  const total = fixedExpenses.length;
  const headerHTML = `<div class="fixed-progress-header">
    <span class="fixed-progress-text">${paid} de ${total} pagos</span>
    <div class="fixed-progress-track">
      <div class="fixed-progress-fill" style="width:${total>0?(paid/total*100):0}%"></div>
    </div>
  </div>`;
  container.innerHTML = headerHTML + fixedExpenses.map(f => `
    <div class="fixed-item" id="fixed-item-${f.id}">
      <div class="fixed-check ${f.paid?'paid':''}" onclick="toggleFixedPaid('${f.id}',${!f.paid},this)"></div>
      <span class="fixed-name ${f.paid?'paid-name':''}">${f.name||'—'}</span>
      <span class="fixed-badge">${f.paymentType||'Débito'}</span>
      <span class="fixed-amount">${fmt(f.amount)}</span>
    </div>`).join('');
}

// FIX: Optimistic UI para fixos pagos
async function toggleFixedPaid(id, paid, checkEl) {
  // Atualizar visualmente de imediato
  checkEl.classList.toggle('paid', paid);
  const nameEl = checkEl.parentElement.querySelector('.fixed-name');
  if (nameEl) nameEl.classList.toggle('paid-name', paid);
  // Atualizar o contador
  const allChecks  = document.querySelectorAll('.fixed-check');
  const paidCount  = [...allChecks].filter(c => c.classList.contains('paid')).length;
  const totalCount = allChecks.length;
  const txt = document.querySelector('.fixed-progress-text');
  if (txt) txt.textContent = `${paidCount} de ${totalCount} pagos`;
  const fill = document.querySelector('.fixed-progress-fill');
  if (fill) fill.style.width = `${totalCount>0?(paidCount/totalCount*100):0}%`;
  // Persistir em background
  try { await DB.update(APP.uid, 'fixedExpenses', id, { paid }); }
  catch(e) {
    // Reverter se falhar
    checkEl.classList.toggle('paid', !paid);
    showToast('Erro ao guardar. Tenta novamente.');
  }
}


// ═══════════════════════════════════════════════════
//  LANÇAMENTOS
// ═══════════════════════════════════════════════════
async function loadTransactions(filter = 'all') {
  try {
    const [transactions, fixedExpenses, allPrest] = await Promise.all([
      DB.getByMonth(APP.uid, 'transactions',  APP.currentMonth, APP.currentYear),
      DB.getByMonth(APP.uid, 'fixedExpenses', APP.currentMonth, APP.currentYear),
      DB.getAllPrestacoes(APP.uid),
    ]);
    const activePrest = filterActivePrestacoes(allPrest, APP.currentMonth, APP.currentYear);
    let all = [
      ...transactions.map(t => ({ ...t, _col:'transactions' })),
      ...fixedExpenses.map(t => ({ ...t, _col:'fixedExpenses', type:'fixed' })),
      ...activePrest.map(t  => ({ ...t, _col:'prestacoes', type:'prestacao',
          category: t.category||'Prestações',
          name: `${t.name} (${prestacaoParcelLabel(t)})` })),
    ];
    if (filter==='variable')   all = all.filter(t => !['fixed','prestacao','income'].includes(t.type));
    else if (filter==='credit') all = all.filter(t => t.type==='prestacao'); // credit tab shows prestacoes
    else if (filter!=='all')   all = all.filter(t => t.type===filter);
    // Fixos não têm date — ficam numa chave especial no topo
    all.sort((a,b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return -1;
      if (!b.date) return 1;
      return new Date(b.date) - new Date(a.date);
    });

    const container = document.getElementById('transactions-list');
    if (!all.length) { container.innerHTML = '<p class="empty-state">Sem lançamentos para este filtro.</p>'; return; }
    const groups = {};
    all.forEach(t => {
      const k = (!t.date && t._col === 'fixedExpenses') ? '__fixed__' : (t.date || 'Sem data');
      if (!groups[k]) groups[k] = [];
      groups[k].push(t);
    });
    // Garantir que __fixed__ fica sempre no topo
    const orderedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '__fixed__') return -1;
      if (b === '__fixed__') return 1;
      return new Date(b) - new Date(a);
    });
    const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    container.innerHTML = orderedKeys
      .map(key => {
        const label = key === '__fixed__'
          ? `Gasto do mês · ${MONTH_NAMES_PT[APP.currentMonth - 1]} ${APP.currentYear}`
          : formatDateLabel(key);
        return `<div class="tx-group-label">${label}</div>${groups[key].map(renderTxItem).join('')}`;
      })
      .join('');
    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); loadTransactions(btn.dataset.filter);
      };
    });
  } catch(e) { console.error('[loadTransactions]', e); }
}

function renderTxItem(t) {
  const icon = CATEGORY_ICONS[t.category]||'📌';
  const isIncome = t.type==='income';
  const badges = {
    fixed:     '<span class="tx-type-badge tx-type-fixed">Fixo</span>',
    prestacao: '<span class="tx-type-badge tx-type-prestacao">Prestação</span>',
    credit:    '<span class="tx-type-badge tx-type-credit">Crédito</span>',
    income:    '<span class="tx-type-badge tx-type-income">Entrada</span>',
    variable:  ''
  };
  const installInfo = t.installments>1 ? ` · ${t.installments}x` : '';
  return `<div class="tx-item" onclick="openTxActions(${JSON.stringify(t).replace(/"/g,'&quot;')})">
    <div class="tx-icon">${icon}</div>
    <div class="tx-info">
      <div class="tx-name">${t.name||t.category||'—'}</div>
      <div class="tx-meta">${badges[t.type]||''}${t.category||''}${installInfo}</div>
    </div>
    <div class="tx-right">
      <span class="tx-amount ${isIncome?'income':'expense'}">${isIncome?'+':'−'}${fmt(t.amount)}</span>
      <span class="tx-chevron">›</span>
    </div>
  </div>`;
}

// FIX: Action sheet ao tocar num lançamento (editar ou apagar)
function openTxActions(t) {
  window._currentTx = t;
  document.getElementById('tx-action-name').textContent   = t.name||t.category||'Lançamento';
  document.getElementById('tx-action-amount').textContent = `${t.type==='income'?'+':'−'}${fmt(t.amount)}`;
  const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('tx-action-date').textContent   = (!t.date && t._col === 'fixedExpenses')
    ? `${MONTH_NAMES_PT[APP.currentMonth - 1]} ${APP.currentYear}`
    : formatDateLabel(t.date||'');
  openModal('modal-tx-actions');
}

function editCurrentTx() {
  closeModal();
  const t = window._currentTx;
  if (!t) return;
  // Pré-preencher o modal de edição
  document.getElementById('tx-edit-id').value        = t.id;
  document.getElementById('tx-edit-col').value       = t._col;
  document.getElementById('tx-edit-name').value      = t.name||'';
  document.getElementById('tx-edit-amount').value    = t.amount||'';
  document.getElementById('tx-edit-date').value      = t.date||todayISO();
  document.getElementById('edit-date-group').style.display = t._col === 'fixedExpenses' ? 'none' : '';
  // Categoria
  const catSel = document.getElementById('tx-edit-category');
  const cats   = APP.settings.categories||DEFAULT_CATEGORIES;
  if (t.type==='income') {
    catSel.innerHTML = `<option value="Salário">💰 Salário</option><option value="Outro">📌 Outro</option>`;
  } else {
    catSel.innerHTML = cats.map(c=>`<option value="${c}">${CATEGORY_ICONS[c]||'📌'} ${c}</option>`).join('');
  }
  catSel.value = t.category||'';
  // Tipo de pagamento (fixos)
  const ptGroup = document.getElementById('tx-edit-payment-group');
  ptGroup.style.display = t._col==='fixedExpenses' ? 'flex' : 'none';
  if (t._col==='fixedExpenses') document.getElementById('tx-edit-payment-type').value = t.paymentType||'Débito';
  // Parcelas (crédito)
  const instGroup = document.getElementById('tx-edit-install-group');
  instGroup.style.display = t._col==='creditCard' ? 'flex' : 'none';
  if (t._col==='creditCard') document.getElementById('tx-edit-installments').value = t.installments||1;
  openModal('modal-edit-transaction');
}

async function saveEditTransaction() {
  const id     = document.getElementById('tx-edit-id').value;
  const col    = document.getElementById('tx-edit-col').value;
  const name   = document.getElementById('tx-edit-name').value.trim();
  const amount = parseFloat(document.getElementById('tx-edit-amount').value);
  const cat    = document.getElementById('tx-edit-category').value;
  const date   = document.getElementById('tx-edit-date').value;

  if (!name)            { showToast('Escreve um nome'); return; }
  if (!amount||amount<=0){ showToast('Insere um valor válido'); return; }
  if (col !== 'fixedExpenses' && !date) { showToast('Seleciona uma data'); return; }

  const updates = col === 'fixedExpenses'
    ? { name, amount, category: cat }
    : { name, amount, category: cat, date };
  if (col==='fixedExpenses') updates.paymentType = document.getElementById('tx-edit-payment-type').value;
  if (col==='creditCard')    updates.installments = parseInt(document.getElementById('tx-edit-installments').value)||1;

  const btn = document.querySelector('#modal-edit-transaction .btn-save-edit');
  if (btn) { btn.disabled=true; btn.textContent='A guardar…'; }
  try {
    await DB.update(APP.uid, col, id, updates);
    closeModal();
    await Promise.all([loadDashboard(), loadTransactions()]);
    showToast('Lançamento atualizado ✓');
  } catch(e) {
    showToast('Erro ao guardar.');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Guardar'; }
  }
}

async function deleteCurrentTx() {
  closeModal();
  const t = window._currentTx;
  if (!t) return;
  const ok = await showConfirm({
    icon:'🗑️', title:'Apagar lançamento',
    message:'Tens a certeza? Esta ação não pode ser desfeita.',
    confirmText:'Apagar', danger:true
  });
  if (!ok) return;
  await DB.delete(APP.uid, t._col, t.id);
  await Promise.all([loadDashboard(), loadTransactions()]);
  showToast('Lançamento apagado');
}


// ═══════════════════════════════════════════════════
//  SPEED DIAL
// ═══════════════════════════════════════════════════
function initSpeedDial() {
  const dial = document.getElementById('speed-dial');
  const fab  = document.getElementById('fab-add');
  fab.addEventListener('click', e => { e.stopPropagation(); dial.classList.toggle('open'); });
  document.querySelectorAll('.sd-option').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      dial.classList.remove('open');
      const type = btn.dataset.type;
      if (type === 'credit') { setTimeout(() => openAddPrestacao(), 180); }
      else { setTimeout(() => openAddTransaction(type), 180); }
    });
  });
  document.addEventListener('click', () => dial.classList.remove('open'));
}

// ═══════════════════════════════════════════════════
//  MODAL — ADICIONAR LANÇAMENTO
// ═══════════════════════════════════════════════════
function openAddTransaction(type = 'variable') {
  populateCategorySelect(type);
  document.getElementById('tx-date').value = todayISO();
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  const instGroup = document.getElementById('installments-group');
  if (instGroup) instGroup.style.display = 'none';
  const isFixed = type === 'fixed';
  document.getElementById('payment-type-group').style.display = isFixed ? 'flex' : 'none';
  document.getElementById('date-group').style.display         = isFixed ? 'none' : '';
  document.getElementById('category-label').textContent = type === 'income' ? 'Fonte' : 'Categoria';
  openModal('modal-add-transaction');
}

function populateCategorySelect(type) {
  const sel  = document.getElementById('tx-category');
  const cats = APP.settings.categories||DEFAULT_CATEGORIES;
  sel.innerHTML = type==='income'
    ? `<option value="Salário">💰 Salário</option><option value="Outro">📌 Outro</option>`
    : cats.map(c=>`<option value="${c}">${CATEGORY_ICONS[c]||'📌'} ${c}</option>`).join('');
}

function setupTypeSelector() {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;

      // "Crédito" redireciona para o modal de Prestação dedicado
      if (type === 'credit') {
        closeModal();
        setTimeout(() => openAddPrestacao(), 180); // aguarda animação de fecho
        return;
      }

      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const ig = document.getElementById('installments-group'); if (ig) ig.style.display = 'none';
      document.getElementById('payment-type-group').style.display = type==='fixed' ? 'flex':'none';
      document.getElementById('date-group').style.display         = type==='fixed' ? 'none' : '';
      document.getElementById('category-label').textContent = type==='income' ? 'Fonte':'Categoria';
      populateCategorySelect(type);
    });
  });
}

// FIX: Guard contra duplo submit
async function saveTransaction() {
  if (APP._saving) return;
  APP._saving = true;
  const saveBtn = document.getElementById('btn-save-transaction');
  if (saveBtn) { saveBtn.disabled=true; saveBtn.textContent='A guardar…'; }

  const type     = document.querySelector('.type-btn.active')?.dataset.type||'variable';
  const name     = document.getElementById('tx-name').value.trim();
  const amount   = parseFloat(document.getElementById('tx-amount').value);
  const category = document.getElementById('tx-category').value;
  const date     = document.getElementById('tx-date').value;

  if (!name)             { showToast('Escreve um nome'); resetSaveBtn(saveBtn); return; }
  if (!amount||amount<=0){ showToast('Insere um valor válido'); resetSaveBtn(saveBtn); return; }
  if (type !== 'fixed' && !date) { showToast('Seleciona uma data'); resetSaveBtn(saveBtn); return; }

  const base = type === 'fixed'
    ? { name, amount, category, month: APP.currentMonth, year: APP.currentYear, type }
    : { name, amount, category, date, month: APP.currentMonth, year: APP.currentYear, type };
  try {
    if (type==='fixed') {
      await DB.add(APP.uid,'fixedExpenses',{ ...base, paymentType:document.getElementById('tx-payment-type').value, paid:false });
    } else if (type==='credit') {
      // Crédito é gerido no modal de Prestações — não deve chegar aqui
      closeModal();
      setTimeout(() => openAddPrestacao(), 180);
      resetSaveBtn(saveBtn);
      return;
    } else {
      await DB.add(APP.uid,'transactions', base);
    }
    closeModal();
    await loadDashboard();
    if (document.getElementById('screen-gastos').classList.contains('active')) loadTransactions();
    showToast('Lançamento guardado ✓');
  } catch(e) {
    console.error('[saveTransaction]', e);
    showToast('Erro ao guardar. Tenta novamente.');
  } finally {
    resetSaveBtn(saveBtn);
  }
}

function resetSaveBtn(btn) {
  APP._saving = false;
  if (btn) { btn.disabled=false; btn.textContent='Guardar'; }
}


// ═══════════════════════════════════════════════════
//  PANORAMA ANUAL — FIX: 1 chamada por coleção (3 total)
// ═══════════════════════════════════════════════════
async function loadAnnual() {
  document.getElementById('annual-year-display').textContent = APP.annualYear;
  document.getElementById('btn-next-year').disabled = APP.annualYear >= new Date().getFullYear();
  document.getElementById('annual-summary').innerHTML = '<p class="empty-state" style="padding:8px 0;">A carregar…</p>';

  try {
    // FIX: 3 chamadas em vez de 36 — ler o ano todo de uma vez e filtrar localmente
    const [allTx, allFx, allPrest] = await Promise.all([
      DB.getByYear(APP.uid, 'transactions',  APP.annualYear),
      DB.getByYear(APP.uid, 'fixedExpenses', APP.annualYear),
      DB.getAllPrestacoes(APP.uid),
    ]);

    const data = Array.from({length:12},(_,i)=>i+1).map(m => {
      const activePrest = filterActivePrestacoes(allPrest, m, APP.annualYear);
      const income  = allTx.filter(t=>t.month===m&&t.type==='income').reduce((s,t)=>s+(t.amount||0),0);
      const expense = [
        ...allTx.filter(t=>t.month===m&&t.type!=='income'),
        ...allFx.filter(t=>t.month===m),
        ...activePrest
      ].reduce((s,t)=>s+(t.amount||0),0);
      return { month:m, income, expense, balance:income-expense };
    });

    renderAnnualChart(data);
    renderAnnualSummary(data);
  } catch(e) { console.error('[loadAnnual]', e); }
}

function renderAnnualChart(data) {
  const canvas = document.getElementById('annual-chart');
  if (!canvas||typeof Chart==='undefined') return;
  if (window._annualChart) window._annualChart.destroy();
  const currency = APP.settings.currency||'€';
  window._annualChart = new Chart(canvas.getContext('2d'), {
    type:'bar',
    data: {
      labels: MONTH_NAMES.map(m=>m.slice(0,3)),
      datasets: [
        { label:'Entradas', data:data.map(d=>d.income),  backgroundColor:'rgba(45,122,79,0.65)',  borderColor:'rgba(45,122,79,0.9)',  borderWidth:1, borderRadius:5, borderSkipped:false },
        { label:'Gastos',   data:data.map(d=>d.expense), backgroundColor:'rgba(212,83,126,0.65)', borderColor:'rgba(153,53,86,0.9)',  borderWidth:1, borderRadius:5, borderSkipped:false }
      ]
    },
    options: {
      responsive:true,
      plugins: {
        legend: { position:'top', labels:{ font:{size:12}, padding:12 } },
        tooltip: { callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${currency}${(ctx.raw||0).toLocaleString('pt-PT',{minimumFractionDigits:2})}` } }
      },
      scales: {
        // FIX: usar currency dinâmico
        y: { ticks:{ callback: v=>`${currency}${v.toLocaleString('pt-PT')}`, font:{size:11} }, grid:{ color:'rgba(240,214,224,0.4)' } },
        x: { ticks:{ font:{size:11} }, grid:{ display:false } }
      }
    }
  });
}

function renderAnnualSummary(data) {
  const totalIncome  = data.reduce((s,d)=>s+d.income,0);
  const totalExpense = data.reduce((s,d)=>s+d.expense,0);
  const totalBalance = totalIncome - totalExpense;
  document.getElementById('annual-summary').innerHTML = `
    <div class="section-card" style="margin-top:12px;">
      <h3 class="section-title">Totais ${APP.annualYear}</h3>
      <div class="summary-grid" style="margin-bottom:0;">
        <div class="summary-card"><span class="summary-label">Total entradas</span><span class="summary-value positive">${fmt(totalIncome)}</span></div>
        <div class="summary-card"><span class="summary-label">Total gastos</span><span class="summary-value negative">${fmt(totalExpense)}</span></div>
        <div class="summary-card full-width">
          <div><span class="summary-label">Balanço anual</span><span class="summary-value ${totalBalance>=0?'positive':'negative'}">${fmt(totalBalance)}</span></div>
          <div class="saldo-badge ${totalBalance>=0?'positive':'negative'}">${totalBalance>=0?'✓ Positivo':'↓ Negativo'}</div>
        </div>
      </div>
    </div>`;
}


// ═══════════════════════════════════════════════════
//  METAS & INVESTIMENTOS
// ═══════════════════════════════════════════════════
async function loadGoals() {
  document.getElementById('inv-month-label').textContent = MONTH_NAMES[APP.currentMonth-1];
  const inv = await DB.getInvestment(APP.uid, APP.currentMonth, APP.currentYear);
  document.getElementById('investments-form-inline').innerHTML = `
    <div class="inv-grid">
      <div class="form-group"><label class="form-label">Reserva (€)</label><input type="number" class="form-input" id="inv-reserve"   value="${inv.reserve||''}"        placeholder="0" inputmode="decimal"></div>
      <div class="form-group"><label class="form-label">Renda fixa (€)</label><input type="number" class="form-input" id="inv-fixed"     value="${inv.fixedIncome||''}"    placeholder="0" inputmode="decimal"></div>
      <div class="form-group"><label class="form-label">Renda variável (€)</label><input type="number" class="form-input" id="inv-variable"  value="${inv.variableIncome||''}" placeholder="0" inputmode="decimal"></div>
      <div class="form-group" style="justify-content:flex-end;"><button class="btn-primary full-width" onclick="saveInvestment()">Guardar</button></div>
    </div>
    <div style="background:var(--rose-50);border-radius:var(--radius-sm);padding:10px 12px;font-size:13px;color:var(--color-text-muted);">
      Total investido: <strong style="color:var(--color-text);">${fmt((inv.reserve||0)+(inv.fixedIncome||0)+(inv.variableIncome||0))}</strong>
    </div>`;

  const goals = await DB.getAll(APP.uid,'goals');
  const container = document.getElementById('goals-list');
  container.innerHTML = goals.length
    ? goals.map(renderGoalCard).join('')
    : '<p class="empty-state">Sem metas criadas.<br>Carrega em "+ Meta" para começar.</p>';
}

function renderGoalCard(g) {
  const total    = g.total||0;
  const amounts  = g.monthlyAmounts||{};
  const saved    = Object.values(amounts).reduce((s,v)=>s+(v||0),0);
  const pct      = total>0 ? Math.min(100,saved/total*100) : 0;
  const remaining = Math.max(0, total-saved);
  const history  = Object.entries(amounts)
    .filter(([,v])=>v>0).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,4)
    .map(([key,val])=>{
      const [y,m] = key.split('-');
      return `<div class="contrib-row"><span class="contrib-month">${MONTH_NAMES[parseInt(m)-1]} ${y}</span><span class="contrib-val">+${fmt(val)}</span></div>`;
    }).join('');

  const safeName = g.name.replace(/'/g,"\\'");
  return `<div class="goal-card">
    <div class="goal-header">
      <span class="goal-name">🎯 ${g.name}</span>
      <div class="goal-actions">
        <button class="goal-btn-edit"   onclick="editGoalTarget('${g.id}','${safeName}',${total})" title="Editar objetivo">✏️</button>
        <button class="goal-btn-delete" onclick="deleteGoal('${g.id}','${safeName}')">✕</button>
      </div>
    </div>
    <div class="goal-amounts-row">
      <span class="goal-saved">${fmt(saved)}</span>
      <span class="goal-sep">/</span>
      <span class="goal-target">${fmt(total)}</span>
    </div>
    <div class="goal-track"><div class="goal-fill" style="width:${pct.toFixed(1)}%"></div></div>
    <div class="goal-footer">
      <span class="goal-pct">${pct.toFixed(0)}% concluído</span>
      <span class="goal-remaining">Falta: ${fmt(remaining)}</span>
      ${g.targetDate?`<span class="goal-date">🗓 ${g.targetDate}</span>`:''}
    </div>
    ${history?`<div class="contrib-history">${history}</div>`:''}
    <button class="btn-add-contrib" onclick="openAddContribution('${g.id}','${safeName}',${saved},${total})">
      + Adicionar valor
    </button>
  </div>`;
}

async function saveInvestment() {
  const data = {
    reserve:        parseFloat(document.getElementById('inv-reserve').value)||0,
    fixedIncome:    parseFloat(document.getElementById('inv-fixed').value)||0,
    variableIncome: parseFloat(document.getElementById('inv-variable').value)||0,
  };
  await DB.saveInvestment(APP.uid, APP.currentMonth, APP.currentYear, data);
  showToast('Investimentos guardados ✓');
  loadGoals();
}

async function openAddGoal() {
  const name = await showPrompt({ icon:'🎯', title:'Nova meta', message:'Como se chama esta meta?', placeholder:'Ex: Viagem a Paris, Fundo de emergência…' });
  if (!name?.trim()) return;
  const totalStr = await showPrompt({ icon:'💰', title:'Valor objetivo', message:`Quanto precisas para "${name.trim()}"?`, placeholder:'0.00', inputType:'number' });
  const total = parseFloat(totalStr);
  if (!total||total<=0) { showToast('Valor inválido'); return; }
  const date = await showPrompt({ icon:'📅', title:'Data alvo', message:'Quando queres atingir esta meta? (opcional)', placeholder:'Ex: Dez 2026' });
  await DB.add(APP.uid,'goals',{ name:name.trim(), total, targetDate:date?.trim()||'', monthlyAmounts:{} });
  loadGoals(); showToast('Meta criada ✓');
}

function openAddContribution(goalId, goalName, currentTotal, goalTarget) {
  document.getElementById('contrib-goal-id').value        = goalId;
  document.getElementById('contrib-goal-name').textContent = goalName;
  document.getElementById('contrib-current').textContent   = fmt(currentTotal);
  document.getElementById('contrib-target').textContent    = fmt(goalTarget);
  document.getElementById('contrib-amount').value          = '';
  document.getElementById('contrib-month-label').textContent = `${MONTH_NAMES[APP.currentMonth-1]} ${APP.currentYear}`;
  // FIX: checkbox para registar como gasto
  document.getElementById('contrib-as-expense').checked = false;
  openModal('modal-add-contribution');
}

async function saveContribution() {
  const goalId  = document.getElementById('contrib-goal-id').value;
  const amount  = parseFloat(document.getElementById('contrib-amount').value);
  const asExpense = document.getElementById('contrib-as-expense').checked;
  if (!amount||amount<=0) { showToast('Insere um valor válido'); return; }
  const key = `${APP.currentYear}-${String(APP.currentMonth).padStart(2,'0')}`;
  const snap = await db.ref(`users/${APP.uid}/goals/${goalId}/monthlyAmounts/${key}`).once('value');
  const existing = snap.val()||0;
  await db.ref(`users/${APP.uid}/goals/${goalId}/monthlyAmounts/${key}`).set(existing+amount);

  // FIX: opção de registar como gasto no mês
  if (asExpense) {
    const goalName = document.getElementById('contrib-goal-name').textContent;
    await DB.add(APP.uid,'transactions',{
      name: `Meta: ${goalName}`,
      amount, category:'Poupança', type:'variable',
      date: todayISO(), month:APP.currentMonth, year:APP.currentYear
    });
  }

  closeModal();
  loadGoals();
  if (asExpense) await loadDashboard();
  showToast(`+${fmt(amount)} adicionado${asExpense?' e registado como gasto':''} ✓`);
}

async function deleteGoal(goalId, goalName) {
  const ok = await showConfirm({ icon:'🎯', title:'Apagar meta', message:`Apagar "${goalName}"? Todo o histórico de contribuições será perdido.`, confirmText:'Apagar meta', danger:true });
  if (!ok) return;
  await DB.delete(APP.uid,'goals',goalId);
  loadGoals(); showToast('Meta apagada');
}

async function editGoalTarget(goalId, goalName, currentTarget) {
  const newTotalStr = await showPrompt({ icon:'✏️', title:'Editar objetivo', message:`Novo valor total para "${goalName}":`, placeholder:'0.00', defaultValue:String(currentTarget), inputType:'number' });
  const newTotal = parseFloat(newTotalStr);
  if (!newTotal||newTotal<=0) { showToast('Valor inválido'); return; }
  await DB.update(APP.uid,'goals',goalId,{ total:newTotal });
  loadGoals(); showToast('Meta atualizada ✓');
}


// ═══════════════════════════════════════════════════
//  CONFIGURAÇÕES
// ═══════════════════════════════════════════════════
function loadConfig() {
  document.getElementById('config-name').value   = APP.settings.name||'';
  document.getElementById('config-salary').value = APP.settings.salary||'';
  renderAccountCard();
  renderCategoriesList();
  loadAllPrestacoes();
}

function renderAccountCard() {
  const card   = document.getElementById('account-card');
  const user   = APP.user;
  const isAnon = user?.isAnonymous;
  if (isAnon) {
    card.innerHTML = `
      <h3 class="section-title">Conta</h3>
      <div class="account-anon-info">
        <span class="account-anon-icon">👤</span>
        <div><p style="font-size:14px;font-weight:500;color:var(--color-text);">Sessão anónima</p>
        <p style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">Os dados existem apenas neste dispositivo.</p></div>
      </div>
      <button class="btn-google full-width" style="margin-top:12px;" onclick="upgradeToGoogle()">
        <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Ligar conta Google (mantém dados)
      </button>`;
  } else {
    const name  = user?.displayName||'';
    const email = user?.email||'';
    const photo = user?.photoURL;
    card.innerHTML = `
      <h3 class="section-title">Conta</h3>
      <div class="account-google-info">
        ${photo?`<img src="${photo}" class="account-avatar" alt="Avatar">`:`<div class="account-avatar-placeholder">${name.charAt(0)||'?'}</div>`}
        <div style="flex:1;min-width:0;">
          <p style="font-size:14px;font-weight:500;color:var(--color-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name||'Utilizadora'}</p>
          <p style="font-size:12px;color:var(--color-text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${email}</p>
        </div>
        <span class="google-badge">Google</span>
      </div>
      <button class="btn-outline full-width" style="margin-top:12px;color:var(--color-text-muted);font-size:13px;" onclick="handleSignOut()">Terminar sessão</button>`;
  }
}

async function upgradeToGoogle() {
  try {
    showToast('A abrir login Google…');
    const user = await signInWithGoogle();
    APP.uid = user.uid; APP.user = user;
    renderAccountCard(); showToast('Conta Google ligada ✓ Dados preservados!');
  } catch(e) { console.error('[upgradeToGoogle]', e); showToast('Erro ao ligar conta Google.'); }
}

async function handleSignOut() {
  const ok = await showConfirm({ icon:'👋', title:'Terminar sessão', message:'Tens a certeza? Os teus dados ficam guardados na cloud.', confirmText:'Terminar sessão', danger:true });
  if (!ok) return;
  await signOut(); window.location.reload();
}

async function saveSettings() {
  APP.settings.name   = document.getElementById('config-name').value.trim();
  APP.settings.salary = parseFloat(document.getElementById('config-salary').value)||0;
  await DB.saveSettings(APP.uid, APP.settings);
  updateMonthDisplay();
  showToast('Definições guardadas ✓');
}

function renderCategoriesList() {
  const container = document.getElementById('categories-list');
  const cats = APP.settings.categories||DEFAULT_CATEGORIES;
  container.innerHTML = cats.length
    ? cats.map((c,i)=>`<div class="cat-config-item">
        <span class="cat-config-name">${CATEGORY_ICONS[c]||'📌'} ${c}</span>
        <button class="cat-config-remove" onclick="removeCategory(${i})">✕</button>
      </div>`).join('')
    : '<p class="empty-state" style="padding:12px 0;">Sem categorias.</p>';
}

async function removeCategory(index) {
  const ok = await showConfirm({ icon:'🏷️', title:'Apagar categoria', message:`Apagar "${APP.settings.categories[index]}"? Os lançamentos existentes não são afetados.`, confirmText:'Apagar', danger:true });
  if (!ok) return;
  APP.settings.categories.splice(index,1);
  await DB.saveSettings(APP.uid, APP.settings);
  renderCategoriesList();
}

async function openAddCategory() {
  const name = await showPrompt({ icon:'🏷️', title:'Nova categoria', placeholder:'Ex: Farmácia, Animais, Férias…' });
  if (!name?.trim()) return;
  if (!APP.settings.categories) APP.settings.categories = [...DEFAULT_CATEGORIES];
  if (APP.settings.categories.includes(name.trim())) {
    await showAlert({ icon:'⚠️', title:'Já existe', message:`A categoria "${name.trim()}" já existe na lista.` }); return;
  }
  APP.settings.categories.push(name.trim());
  await DB.saveSettings(APP.uid, APP.settings);
  renderCategoriesList(); showToast('Categoria adicionada ✓');
}

// FIX: Copiar fixos do mês anterior
async function copyFixedFromPrevious() {
  let prevMonth = APP.currentMonth - 1;
  let prevYear  = APP.currentYear;
  if (prevMonth < 1) { prevMonth = 12; prevYear--; }
  const prevFixed = await DB.getByMonth(APP.uid,'fixedExpenses', prevMonth, prevYear);
  if (!prevFixed.length) { await showAlert({ icon:'📋', title:'Sem fixos', message:`Não há gastos fixos em ${MONTH_NAMES[prevMonth-1]} ${prevYear}.` }); return; }
  const ok = await showConfirm({
    icon:'🔄', title:'Copiar fixos',
    message:`Copiar ${prevFixed.length} gasto(s) fixo(s) de ${MONTH_NAMES[prevMonth-1]} para ${MONTH_NAMES[APP.currentMonth-1]}?`,
    confirmText:'Copiar', danger:false
  });
  if (!ok) return;
  const copies = prevFixed.map(({id, createdAt, date, ...rest}) => ({ ...rest, month:APP.currentMonth, year:APP.currentYear, paid:false }));
  await DB.importBatch(APP.uid,'fixedExpenses', copies);
  showToast(`${copies.length} fixo(s) copiado(s) ✓`);
  loadDashboard();
}


// ═══════════════════════════════════════════════════
//  EXPORTAR / IMPORTAR
// ═══════════════════════════════════════════════════
async function exportData() {
  showToast('A preparar exportação…');
  try {
    const [transactions, fixedExpenses, prestacoes, investments, goals] = await Promise.all([
      DB.getAll(APP.uid,'transactions'), DB.getAll(APP.uid,'fixedExpenses'),
      DB.getAllPrestacoes(APP.uid),      DB.getAll(APP.uid,'investments'),
      DB.getAll(APP.uid,'goals'),
    ]);
    const blob = new Blob([JSON.stringify({ exportedAt:new Date().toISOString(), transactions, fixedExpenses, prestacoes, investments, goals }, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href:url, download:`financas-backup-${todayISO()}.json` }).click();
    URL.revokeObjectURL(url);
    showToast('Exportado ✓');
  } catch(e) { showToast('Erro ao exportar'); }
}

async function importExcel(input) {
  const file = input.files?.[0];
  if (!file) return;
  const statusEl = document.getElementById('import-status');
  statusEl.style.color = 'var(--color-text-muted)';

  if (typeof XLSX === 'undefined') {
    statusEl.textContent = '⚠️ Parser Excel não carregado. Verifica a ligação.';
    return;
  }

  statusEl.textContent = '⏳ A ler o ficheiro…';

  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
    const monthSheets = wb.SheetNames.filter(s => MONTH_NAMES.includes(s));

    if (!monthSheets.length) {
      statusEl.textContent = '⚠️ Não reconheço a estrutura desta planilha.';
      return;
    }

    // Confirm before importing
    const ok = await showConfirm({
      icon: '📂',
      title: 'Importar planilha',
      message: `Encontrei ${monthSheets.length} meses. Os dados serão adicionados ao app sem apagar os existentes. Continuar?`,
      confirmText: 'Importar',
      danger: false
    });
    if (!ok) { statusEl.textContent = ''; input.value = ''; return; }

    statusEl.textContent = '⏳ A importar…';

    const fixedBatch = [], txBatch = [], creditBatch = [];
    let totalFixed = 0, totalTx = 0, totalCredit = 0;

    for (const sheetName of monthSheets) {
      const monthIndex = MONTH_NAMES.indexOf(sheetName); // 0-based
      const month = monthIndex + 1;
      // Detect year from sheet name context — use current year as default
      const year = APP.currentYear;

      const ws   = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null });

      // ── Find section start rows ──
      let fixosStart = -1, gastosStart = -1, creditStart = -1;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r[2] === 'Nome' && r[4] === 'Pago?') { fixosStart = i + 1; }
        if (r[9] === 'Nome' && r[10] === 'Data')  { gastosStart = i + 1; }
        if (r[2] === 'Nome' && r[3] === 'Parcelas') { creditStart = i + 1; }
      }

      // ── FIXOS (col indices: 2=Nome, 4=Pago, 5=Tipo, 6=Cat, 7=Valor) ──
      if (fixosStart > 0) {
        for (let i = fixosStart; i < Math.min(fixosStart + 30, rows.length); i++) {
          const r = rows[i];
          if (!r[2] || r[2] === 'Total de Cartão de Crédito') break;
          const nome = String(r[2]).trim();
          const val  = parseFloat(r[7]);
          if (!nome || isNaN(val) || val <= 0) continue;
          fixedBatch.push({
            name: nome, amount: val,
            category: r[6] || 'Outro',
            paymentType: r[5] || 'Débito',
            paid: r[4] === true,
            month, year, type: 'fixed'
          });
          totalFixed++;
        }
      }

      // ── GASTOS DO MÊS (col indices: 9=Nome, 10=Data, 11=Cat, 12=Valor) ──
      if (gastosStart > 0) {
        for (let i = gastosStart; i < Math.min(gastosStart + 60, rows.length); i++) {
          const r = rows[i];
          if (!r[9]) continue;
          const nome = String(r[9]).trim();
          const val  = parseFloat(r[12]);
          if (!nome || isNaN(val) || val <= 0) continue;

          // Parse date
          let dateStr = todayISO();
          if (r[10]) {
            try {
              const d = r[10] instanceof Date ? r[10] : new Date(r[10]);
              if (!isNaN(d)) dateStr = d.toISOString().split('T')[0];
            } catch(e) {}
          }

          txBatch.push({
            name: nome, amount: val,
            category: r[11] || 'Outro',
            date: dateStr, month, year, type: 'variable'
          });
          totalTx++;
        }
      }

      // ── CARTÃO DE CRÉDITO → importar como PRESTAÇÕES ──
      // col indices: 2=Nome, 3=Parcelas, 5=Data início, 6=Categoria, 7=Valor mensal
      if (creditStart > 0) {
        for (let i = creditStart; i < Math.min(creditStart + 30, rows.length); i++) {
          const r = rows[i];
          if (r[2] === null || r[2] === undefined) break;
          const nome = String(r[2]).trim();
          const val  = parseFloat(r[7]);
          if (!nome || isNaN(val) || val <= 0) continue;

          // ── Converter parcelas: pode vir como número, string, ou Date (bug Excel) ──
          let totalMonths = 1;
          const rawParcelas = r[3];
          if (rawParcelas instanceof Date) {
            // Excel serializou o número como data — calcular dias desde Jan 1, 1900
            // datetime(1900,1,6) - datetime(1900,1,1) = 5 dias → 5 parcelas
            const epoch = new Date(1900, 0, 1); // Jan 1, 1900
            const diffDays = Math.round((rawParcelas - epoch) / (1000 * 60 * 60 * 24));
            totalMonths = Math.max(1, diffDays);
          } else if (rawParcelas !== null && rawParcelas !== undefined) {
            totalMonths = Math.max(1, parseInt(rawParcelas) || 1);
          }

          // ── Data de início ──
          let startMonth = month;
          let startYear  = year;
          if (r[5]) {
            try {
              const d = r[5] instanceof Date ? r[5] : new Date(r[5]);
              if (!isNaN(d)) { startMonth = d.getMonth() + 1; startYear = d.getFullYear(); }
            } catch(e) {}
          }

          // ── Calcular data de fim ──
          let endMonth = startMonth + totalMonths - 1;
          let endYear  = startYear;
          while (endMonth > 12) { endMonth -= 12; endYear++; }

          const totalAmount = parseFloat((val * totalMonths).toFixed(2));

          creditBatch.push({
            name: nome, amount: val,
            totalMonths, startMonth, startYear,
            endMonth, endYear, totalAmount,
            category: r[6] || 'Prestações',
            paymentType: 'Crédito',
            paid: {}
          });
          totalCredit++;
        }
      }
    }

    // ── Save to Firebase ──
    const saves = [];
    if (fixedBatch.length)  saves.push(DB.importBatch(APP.uid, 'fixedExpenses', fixedBatch));
    if (txBatch.length)     saves.push(DB.importBatch(APP.uid, 'transactions',  txBatch));
    if (creditBatch.length) saves.push(DB.importBatch(APP.uid, 'prestacoes',   creditBatch));
    await Promise.all(saves);

    const total = totalFixed + totalTx + totalCredit;
    statusEl.style.color = 'var(--color-positive)';
    statusEl.textContent = `✅ Importados: ${totalFixed} fixos · ${totalTx} gastos · ${totalCredit} prestações (${total} total)`;
    showToast(`${total} registos importados ✓`);
    await loadDashboard();

  } catch(e) {
    console.error('[importExcel]', e);
    statusEl.style.color = 'var(--color-primary)';
    statusEl.textContent = '⚠️ Erro ao importar: ' + e.message;
  }

  input.value = '';
}


// ═══════════════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════════════
function openModal(id) {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));
  ['tx-name','tx-amount'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
}


// ═══════════════════════════════════════════════════
//  UTILITÁRIOS
// ═══════════════════════════════════════════════════
function fmt(val) {
  return (APP.settings.currency||'€')+(val||0).toLocaleString('pt-PT',{ minimumFractionDigits:2, maximumFractionDigits:2 });
}
function todayISO() { return new Date().toISOString().split('T')[0]; }
function formatDateLabel(dateStr) {
  if (!dateStr||dateStr==='Sem data') return 'Sem data';
  try { return new Date(dateStr+'T12:00:00').toLocaleDateString('pt-PT',{ weekday:'long', day:'numeric', month:'long' }); }
  catch { return dateStr; }
}


// ═══════════════════════════════════════════════════
//  PRESTAÇÕES
// ═══════════════════════════════════════════════════

// Calcula se uma prestação está ativa num dado mês/ano
function filterActivePrestacoes(all, month, year) {
  return all.filter(p => {
    const startTotal = p.startYear * 12 + p.startMonth;
    const endTotal   = p.endYear   * 12 + p.endMonth;
    const nowTotal   = year * 12 + month;
    return nowTotal >= startTotal && nowTotal <= endTotal;
  });
}

// Label "3ª de 12" para a parcela atual
function prestacaoParcelLabel(p, month, year) {
  const m = month || APP.currentMonth;
  const y = year  || APP.currentYear;
  const startTotal   = p.startYear * 12 + p.startMonth;
  const currentTotal = y * 12 + m;
  const parcelNum    = currentTotal - startTotal + 1;
  return `${parcelNum}ª de ${p.totalMonths}`;
}

// Calcular data de fim de uma prestação
function calcEndDate(startMonth, startYear, totalMonths) {
  let endMonth = startMonth + totalMonths - 1;
  let endYear  = startYear;
  while (endMonth > 12) { endMonth -= 12; endYear++; }
  return { endMonth, endYear };
}

// Render das prestações no dashboard
function renderPrestacoes(prestacoes) {
  const container = document.getElementById('prestacoes-status');
  if (!container) return;
  if (!prestacoes.length) {
    container.innerHTML = '<p class="empty-state">Sem prestações ativas.</p>';
    return;
  }
  const monthKey = `${APP.currentYear}-${String(APP.currentMonth).padStart(2,'0')}`;
  const paid     = prestacoes.filter(p => p.paid?.[monthKey]).length;
  const total    = prestacoes.length;
  const headerHTML = `<div class="fixed-progress-header">
    <span class="fixed-progress-text">${paid} de ${total} pagas</span>
    <div class="fixed-progress-track">
      <div class="fixed-progress-fill" style="width:${total>0?(paid/total*100):0}%"></div>
    </div>
  </div>`;
  container.innerHTML = headerHTML + prestacoes.map(p => {
    const isPaid   = !!(p.paid?.[monthKey]);
    const parcelN  = prestacaoParcelLabel(p);
    const endLabel = `${MONTH_NAMES[p.endMonth-1]} ${p.endYear}`;
    return `<div class="fixed-item">
      <div class="fixed-check ${isPaid?'paid':''}" onclick="togglePrestacaoPaid('${p.id}',${!isPaid},this)"></div>
      <div class="fixed-info">
        <span class="fixed-name ${isPaid?'paid-name':''}">${p.name}</span>
        <span class="prestacao-meta">${parcelN} · última em ${endLabel}</span>
      </div>
      <span class="fixed-amount">${fmt(p.amount)}</span>
    </div>`;
  }).join('');
}

// FIX: Toggle paid com optimistic UI
async function togglePrestacaoPaid(id, paid, checkEl) {
  checkEl.classList.toggle('paid', paid);
  const nameEl = checkEl.parentElement.querySelector('.fixed-name');
  if (nameEl) nameEl.classList.toggle('paid-name', paid);
  const allChecks = document.querySelectorAll('#prestacoes-status .fixed-check');
  const paidCount = [...allChecks].filter(c => c.classList.contains('paid')).length;
  const totalCount = allChecks.length;
  const txt  = document.querySelector('#prestacoes-status .fixed-progress-text');
  const fill = document.querySelector('#prestacoes-status .fixed-progress-fill');
  if (txt)  txt.textContent = `${paidCount} de ${totalCount} pagas`;
  if (fill) fill.style.width = `${totalCount>0?(paidCount/totalCount*100):0}%`;
  const monthKey = `${APP.currentYear}-${String(APP.currentMonth).padStart(2,'0')}`;
  try { await DB.togglePrestacaoPaid(APP.uid, id, monthKey, paid); }
  catch(e) { checkEl.classList.toggle('paid', !paid); showToast('Erro ao guardar.'); }
}

// Abrir modal de nova prestação
function openAddPrestacao() {
  document.getElementById('prest-name').value    = '';
  document.getElementById('prest-amount').value  = '';
  document.getElementById('prest-months').value  = '';
  document.getElementById('prest-payment').value = 'Débito';

  // Preencher select de ano: ano atual -1 até +5
  const yearSel = document.getElementById('prest-start-year');
  yearSel.innerHTML = '';
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 1; y <= thisYear + 5; y++) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    if (y === APP.currentYear) opt.selected = true;
    yearSel.appendChild(opt);
  }

  // Mês de início = mês atual
  document.getElementById('prest-start-month').value = APP.currentMonth;

  document.getElementById('prest-preview').style.display = 'none';
  openModal('modal-add-prestacao');
}

// Preview calculado em tempo real — dispara a cada keystroke
function updatePrestacaoPreview() {
  const amount  = parseFloat(document.getElementById('prest-amount').value);
  const months  = parseInt(document.getElementById('prest-months').value);
  const sMonth  = parseInt(document.getElementById('prest-start-month').value);
  const sYear   = parseInt(document.getElementById('prest-start-year').value);
  const preview = document.getElementById('prest-preview');

  // Esconder preview se campos incompletos ou inválidos
  const valid = amount > 0 && months >= 1 && sMonth >= 1 && sMonth <= 12 && sYear >= 2020;
  if (!valid) { preview.style.display = 'none'; return; }

  const { endMonth, endYear } = calcEndDate(sMonth, sYear, months);
  const totalAmount = parseFloat((amount * months).toFixed(2));
  const startLabel  = `${MONTH_NAMES[sMonth-1]} ${sYear}`;
  const endLabel    = `${MONTH_NAMES[endMonth-1]} ${endYear}`;

  preview.style.display = 'block';
  preview.innerHTML = `
    <div class="prest-preview-row">
      <span class="prest-preview-label">💳 Valor total</span>
      <span class="prest-preview-value accent">${fmt(totalAmount)}</span>
    </div>
    <div class="prest-preview-divider"></div>
    <div class="prest-preview-row">
      <span class="prest-preview-label">📅 Início</span>
      <span class="prest-preview-value">${startLabel}</span>
    </div>
    <div class="prest-preview-row">
      <span class="prest-preview-label">🏁 Última prestação</span>
      <span class="prest-preview-value">${endLabel}</span>
    </div>
    <div class="prest-preview-row">
      <span class="prest-preview-label">📆 Duração</span>
      <span class="prest-preview-value">${months} ${months===1?'mês':'meses'}</span>
    </div>`;
}

// Guardar nova prestação
async function savePrestacao() {
  const btn = document.getElementById('btn-save-prestacao');
  if (btn.disabled) return; // guard duplo clique

  const name    = document.getElementById('prest-name').value.trim();
  const amount  = parseFloat(document.getElementById('prest-amount').value);
  const months  = parseInt(document.getElementById('prest-months').value);
  const sMonth  = parseInt(document.getElementById('prest-start-month').value);
  const sYear   = parseInt(document.getElementById('prest-start-year').value);
  const payment = document.getElementById('prest-payment').value;

  // Validações com feedback claro
  if (!name)                        { showToast('⚠️ Escreve o nome da prestação'); return; }
  if (!amount || amount <= 0)       { showToast('⚠️ Insere o valor mensal'); return; }
  if (!months || months < 1)        { showToast('⚠️ Insere o número de meses'); return; }
  if (!sMonth || !sYear || sYear < 2020) { showToast('⚠️ Verifica a data de início'); return; }

  const { endMonth, endYear } = calcEndDate(sMonth, sYear, months);
  const totalAmount = parseFloat((amount * months).toFixed(2));

  btn.disabled = true; btn.textContent = 'A guardar…';

  try {
    await DB.addPrestacao(APP.uid, {
      name, amount, totalMonths: months,
      startMonth: sMonth, startYear: sYear,
      endMonth, endYear, totalAmount,
      paymentType: payment,
      category: 'Prestações',
      paid: {}
    });
    closeModal();
    await loadDashboard();
    if (document.getElementById('screen-gastos').classList.contains('active')) loadTransactions();
    showToast(`💳 Prestação criada · ${months}× de ${fmt(amount)} = ${fmt(totalAmount)} ✓`);
  } catch(e) {
    console.error('[savePrestacao]', e);
    showToast('Erro ao guardar. Verifica a ligação.');
  } finally {
    btn.disabled = false; btn.textContent = 'Criar prestação';
  }
}

// Apagar prestação (com confirmação)
async function deletePrestacao(id, name) {
  const ok = await showConfirm({
    icon: '💳',
    title: 'Apagar prestação',
    message: `Apagar "${name}"? Irá desaparecer de todos os meses.`,
    confirmText: 'Apagar',
    danger: true
  });
  if (!ok) return;
  await DB.deletePrestacao(APP.uid, id);
  await loadDashboard();
  showToast('Prestação apagada');
}

// Lista completa de prestações (no ecrã Config ou num modal futuro)
async function loadAllPrestacoes() {
  const all       = await DB.getAllPrestacoes(APP.uid);
  const container = document.getElementById('all-prestacoes-list');
  if (!container) return;
  if (!all.length) { container.innerHTML = '<p class="empty-state">Sem prestações criadas.</p>'; return; }
  const now = APP.currentYear * 12 + APP.currentMonth;
  container.innerHTML = all
    .sort((a,b) => (a.startYear*12+a.startMonth) - (b.startYear*12+b.startMonth))
    .map(p => {
      const endTotal   = p.endYear * 12 + p.endMonth;
      const isFinished = endTotal < now;
      const isActive   = !isFinished;
      const safeName   = p.name.replace(/'/g,"\\'");
      return `<div class="prest-list-item ${isFinished?'finished':''}">
        <div class="prest-list-info">
          <span class="prest-list-name">${p.name}</span>
          <span class="prest-list-meta">${fmt(p.amount)}/mês · ${p.totalMonths} meses · total ${fmt(p.totalAmount)}</span>
          <span class="prest-list-dates">${MONTH_NAMES[p.startMonth-1]} ${p.startYear} → ${MONTH_NAMES[p.endMonth-1]} ${p.endYear}
            ${isFinished ? '<span class="prest-badge finished">Terminada</span>' : '<span class="prest-badge active">Ativa</span>'}
          </span>
        </div>
        <button class="cat-config-remove" onclick="deletePrestacao('${p.id}','${safeName}')">✕</button>
      </div>`;
    }).join('');
}
