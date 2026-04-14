import { DEFAULT_FUNNEL_STEPS, PERIOD_OPTIONS } from './config.js';
import { api } from './api.js';
import { clearSession, getSession, getToken, saveSession } from './auth.js';

const state = {
  authMode: 'login',
  history: []
};

const elements = {
  analysisForm: document.querySelector('#analysisForm'),
  stepGrid: document.querySelector('#stepGrid'),
  industryInput: document.querySelector('#industryInput'),
  periodSelect: document.querySelector('#periodSelect'),
  submitBtn: document.querySelector('#submitBtn'),
  formMessage: document.querySelector('#formMessage'),
  authForm: document.querySelector('#authForm'),
  authMessage: document.querySelector('#authMessage'),
  authSubmitBtn: document.querySelector('#authSubmitBtn'),
  authNameInput: document.querySelector('#authNameInput'),
  authEmailInput: document.querySelector('#authEmailInput'),
  authPasswordInput: document.querySelector('#authPasswordInput'),
  authGuestState: document.querySelector('#authGuestState'),
  authSignedInState: document.querySelector('#authSignedInState'),
  authName: document.querySelector('#authName'),
  authEmail: document.querySelector('#authEmail'),
  logoutBtn: document.querySelector('#logoutBtn'),
  nameField: document.querySelector('#nameField'),
  authTabs: document.querySelectorAll('[data-auth-mode]'),
  refreshHistoryBtn: document.querySelector('#refreshHistoryBtn'),
  historyState: document.querySelector('#historyState'),
  historyList: document.querySelector('#historyList'),
  resultsSection: document.querySelector('#resultsSection'),
  resultStatus: document.querySelector('#resultStatus'),
  resultMessage: document.querySelector('#resultMessage'),
  metricsGrid: document.querySelector('#metricsGrid'),
  barsGrid: document.querySelector('#barsGrid'),
  criticalLeakContent: document.querySelector('#criticalLeakContent'),
  numbersContent: document.querySelector('#numbersContent'),
  fixesList: document.querySelector('#fixesList'),
  redFlagsList: document.querySelector('#redFlagsList'),
  metricWatchContent: document.querySelector('#metricWatchContent')
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setMessage(element, type, text) {
  if (!text) {
    element.className = 'message';
    element.textContent = '';
    return;
  }

  element.className = `message is-visible ${type === 'error' ? 'is-error' : 'is-success'}`;
  element.textContent = text;
}

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function buildParagraphs(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function renderStepGrid() {
  elements.stepGrid.innerHTML = DEFAULT_FUNNEL_STEPS.map((step, index) => `
    <article class="step-card">
      <div class="step-index">Step ${index + 1}</div>
      <label class="field">
        <span>Label</span>
        <input type="text" value="${escapeHtml(step.name)}" data-step-name="${index}">
      </label>
      <label class="field">
        <span>Volume</span>
        <input type="number" min="0" placeholder="${step.placeholder}" data-step-value="${index}">
      </label>
    </article>
  `).join('');
}

function renderPeriodOptions() {
  elements.periodSelect.innerHTML = PERIOD_OPTIONS.map((period) => `
    <option value="${escapeHtml(period)}"${period === 'Last 30 days' ? ' selected' : ''}>${escapeHtml(period)}</option>
  `).join('');
}

function collectFunnelSteps() {
  const names = [...document.querySelectorAll('[data-step-name]')];
  const values = [...document.querySelectorAll('[data-step-value]')];

  return names.map((field, index) => ({
    name: field.value.trim() || `Step ${index + 1}`,
    value: Number(values[index].value || 0)
  })).filter((step) => step.value > 0);
}

function setAnalyzeLoading(isLoading) {
  elements.submitBtn.disabled = isLoading;
  elements.submitBtn.classList.toggle('is-loading', isLoading);
  elements.submitBtn.querySelector('.button-label').textContent = isLoading ? 'Analyzing...' : 'Analyze Funnel';
}

function setAuthLoading(isLoading) {
  elements.authSubmitBtn.disabled = isLoading;
  elements.authSubmitBtn.textContent = isLoading
    ? (state.authMode === 'login' ? 'Logging in...' : 'Creating account...')
    : (state.authMode === 'login' ? 'Log in' : 'Create account');
}

function renderAuthState() {
  const session = getSession();

  if (session?.user) {
    elements.authGuestState.hidden = true;
    elements.authSignedInState.hidden = false;
    elements.logoutBtn.hidden = false;
    elements.authName.textContent = session.user.name;
    elements.authEmail.textContent = session.user.email;
    elements.historyState.textContent = 'Saved analyses are available below.';
    return;
  }

  elements.authGuestState.hidden = false;
  elements.authSignedInState.hidden = true;
  elements.logoutBtn.hidden = true;
  elements.historyState.textContent = 'Sign in to save analyses and review past runs here.';
}

function renderAuthMode() {
  const isRegister = state.authMode === 'register';
  elements.nameField.hidden = !isRegister;
  elements.authPasswordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
  elements.authSubmitBtn.textContent = isRegister ? 'Create account' : 'Log in';

  elements.authTabs.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.authMode === state.authMode);
  });
}

function renderLoadingSkeleton() {
  elements.resultsSection.hidden = false;
  elements.resultsSection.classList.add('is-visible');
  elements.resultStatus.textContent = 'Working';
  elements.metricsGrid.innerHTML = '<div class="skeleton metric"></div><div class="skeleton metric"></div><div class="skeleton metric"></div><div class="skeleton metric"></div>';
  elements.barsGrid.innerHTML = '<div class="bar-card"><div class="skeleton line long"></div><div class="skeleton line medium"></div><div class="skeleton line short"></div></div>';
  elements.criticalLeakContent.innerHTML = '<div class="skeleton line long"></div><div class="skeleton line medium"></div>';
  elements.numbersContent.innerHTML = '<div class="skeleton line long"></div><div class="skeleton line long"></div><div class="skeleton line short"></div>';
  elements.fixesList.innerHTML = '<li class="skeleton line long"></li><li class="skeleton line medium"></li><li class="skeleton line short"></li>';
  elements.redFlagsList.innerHTML = '<li class="skeleton line long"></li><li class="skeleton line medium"></li>';
  elements.metricWatchContent.innerHTML = '<div class="skeleton line medium"></div>';
}

function renderMetrics(result) {
  const { metrics, steps } = result.funnel;
  const biggestLeak = metrics.biggestLeak;

  elements.metricsGrid.innerHTML = [
    { label: 'Top of funnel', value: formatNumber(metrics.topOfFunnel) },
    { label: 'Overall conversion', value: `${metrics.overallConversion}%` },
    { label: 'Biggest drop', value: `${biggestLeak.dropOffRate}%` },
    { label: 'Bottom step', value: steps.at(-1)?.name ?? 'N/A' }
  ].map((item) => `
    <article class="metric-card">
      <p class="metric-title">${escapeHtml(item.label)}</p>
      <p class="metric-value">${escapeHtml(item.value)}</p>
    </article>
  `).join('');
}

function renderBars(result) {
  elements.barsGrid.innerHTML = result.funnel.steps.map((step, index) => {
    const previous = result.funnel.steps[index - 1];
    const dropLabel = previous
      ? `${step.conversionFromPrevious}% from ${previous.name}`
      : 'Top of funnel';

    return `
      <article class="bar-card">
        <div class="bar-meta">
          <strong>${escapeHtml(step.name)}</strong>
          <span>${escapeHtml(formatNumber(step.value))} users</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.max(step.shareOfTop, 6)}%"></div>
        </div>
        <span>${escapeHtml(dropLabel)}</span>
      </article>
    `;
  }).join('');
}

function renderList(element, items) {
  element.innerHTML = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
}

function renderResult(result, { source = 'live' } = {}) {
  elements.resultsSection.hidden = false;
  elements.resultsSection.classList.add('is-visible');

  renderMetrics(result);
  renderBars(result);

  elements.criticalLeakContent.innerHTML = buildParagraphs(result.analysis.criticalLeak);
  elements.numbersContent.innerHTML = buildParagraphs(result.analysis.whatNumbersTellUs);
  elements.metricWatchContent.innerHTML = buildParagraphs(result.analysis.metricToWatch);
  renderList(elements.fixesList, result.analysis.fixes);
  renderList(elements.redFlagsList, result.analysis.redFlags);

  const savedText = result.saved
    ? 'Saved to dashboard'
    : (source === 'history' ? 'Loaded from dashboard' : 'Guest run');

  elements.resultStatus.textContent = savedText;

  const suffix = source === 'history'
    ? 'Showing a saved analysis.'
    : (result.saved ? 'This run was stored in MongoDB for the signed-in user.' : 'Sign in to save future analyses automatically.');

  setMessage(
    elements.resultMessage,
    'success',
    `${result.analysis.model} response received. ${suffix}`
  );
}

function buildAnalyzePayload() {
  const funnelSteps = collectFunnelSteps();

  if (funnelSteps.length < 2) {
    throw new Error('Enter at least two funnel steps with values greater than zero.');
  }

  return {
    funnelSteps,
    industry: elements.industryInput.value.trim() || 'SaaS product',
    period: elements.periodSelect.value
  };
}

function normalizeHistoryItem(item) {
  return {
    saved: true,
    funnel: {
      industry: item.context.industry,
      period: item.context.period,
      steps: item.funnelSteps,
      metrics: {
        topOfFunnel: item.funnelSteps[0]?.value ?? 0,
        bottomOfFunnel: item.funnelSteps.at(-1)?.value ?? 0,
        overallConversion: item.context.overallConversion ?? 0,
        biggestLeak: item.context.biggestLeak ?? {
          from: item.funnelSteps[0]?.name ?? 'Top',
          to: item.funnelSteps[1]?.name ?? 'Next',
          dropOffRate: item.funnelSteps[1]?.dropOffRate ?? 0
        }
      }
    },
    analysis: {
      model: item.results.model,
      criticalLeak: item.results.criticalLeak,
      whatNumbersTellUs: item.results.whatNumbersTellUs,
      fixes: item.results.fixes,
      redFlags: item.results.redFlags,
      metricToWatch: item.results.metricToWatch
    }
  };
}

function renderHistory(items) {
  state.history = items;

  if (items.length === 0) {
    elements.historyList.innerHTML = '';
    elements.historyState.textContent = getSession()
      ? 'No saved analyses yet. Run your first signed-in analysis.'
      : 'Sign in to save analyses and review past runs here.';
    return;
  }

  elements.historyState.textContent = 'Click any saved analysis to reload it.';
  elements.historyList.innerHTML = items.map((item) => `
    <button class="history-item" type="button" data-history-id="${item.id}">
      <time datetime="${escapeHtml(item.timestamp)}">${escapeHtml(new Date(item.timestamp).toLocaleString())}</time>
      <strong>${escapeHtml(item.context.industry || 'Product')} | ${escapeHtml(item.context.period || 'Custom period')}</strong>
      <span>${escapeHtml(item.results.criticalLeak)}</span>
    </button>
  `).join('');
}

async function refreshHistory() {
  const token = getToken();
  if (!token) {
    renderHistory([]);
    return;
  }

  try {
    elements.refreshHistoryBtn.disabled = true;
    const payload = await api.analyses(token);
    renderHistory(payload.items);
  } catch (error) {
    renderHistory([]);
    setMessage(elements.resultMessage, 'error', error.message);
  } finally {
    elements.refreshHistoryBtn.disabled = false;
  }
}

async function hydrateSession() {
  const token = getToken();
  if (!token) {
    renderAuthState();
    return;
  }

  try {
    const payload = await api.me(token);
    saveSession({
      token,
      user: payload.user
    });
  } catch {
    clearSession();
  }

  renderAuthState();
  await refreshHistory();
}

async function handleAnalyze(event) {
  event.preventDefault();

  try {
    setMessage(elements.formMessage, '', '');
    setMessage(elements.resultMessage, '', '');
    setAnalyzeLoading(true);
    renderLoadingSkeleton();

    const payload = buildAnalyzePayload();
    const result = await api.analyze(payload, getToken());
    renderResult(result);
    setMessage(elements.formMessage, 'success', 'Analysis completed successfully.');

    if (result.saved) {
      await refreshHistory();
    }

    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setMessage(elements.formMessage, 'error', error.message);
    setMessage(elements.resultMessage, 'error', error.message);
  } finally {
    setAnalyzeLoading(false);
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  try {
    setMessage(elements.authMessage, '', '');
    setAuthLoading(true);

    const payload = state.authMode === 'register'
      ? await api.register({
        name: elements.authNameInput.value.trim(),
        email: elements.authEmailInput.value.trim(),
        password: elements.authPasswordInput.value
      })
      : await api.login({
        email: elements.authEmailInput.value.trim(),
        password: elements.authPasswordInput.value
      });

    saveSession(payload);
    renderAuthState();
    renderHistory([]);
    await refreshHistory();
    setMessage(elements.authMessage, 'success', state.authMode === 'register' ? 'Account created.' : 'Logged in successfully.');
    elements.authForm.reset();
  } catch (error) {
    setMessage(elements.authMessage, 'error', error.message);
  } finally {
    setAuthLoading(false);
  }
}

function handleHistoryClick(event) {
  const button = event.target.closest('[data-history-id]');
  if (!button) {
    return;
  }

  const item = state.history.find((entry) => entry.id === button.dataset.historyId);
  if (!item) {
    return;
  }

  renderResult(normalizeHistoryItem(item), { source: 'history' });
  elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleLogout() {
  clearSession();
  renderAuthState();
  renderHistory([]);
  setMessage(elements.authMessage, 'success', 'You have been logged out.');
}

function bindEvents() {
  elements.analysisForm.addEventListener('submit', handleAnalyze);
  elements.authForm.addEventListener('submit', handleAuthSubmit);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.refreshHistoryBtn.addEventListener('click', refreshHistory);
  elements.historyList.addEventListener('click', handleHistoryClick);

  elements.authTabs.forEach((button) => {
    button.addEventListener('click', () => {
      state.authMode = button.dataset.authMode;
      renderAuthMode();
      setMessage(elements.authMessage, '', '');
    });
  });
}

function init() {
  renderStepGrid();
  renderPeriodOptions();
  renderAuthMode();
  renderAuthState();
  bindEvents();
  hydrateSession();
}

init();
