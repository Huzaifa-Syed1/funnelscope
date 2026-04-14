const API_BASE_URL = '';
const MIN_STEPS = 2;
const MAX_STEPS = 8;
const DEFAULT_STEPS = [
  { label: 'Visitors', value: '18000' },
  { label: 'Signups', value: '3400' },
  { label: 'Activated', value: '1420' },
  { label: 'Paid', value: '280' },
  { label: 'Retained', value: '160' }
];

const state = {
  draftSteps: DEFAULT_STEPS.map((step) => ({ ...step })),
  history: [],
  latestAnalysis: null,
  latestComparison: null,
  chart: null
};

const elements = {
  funnelForm: document.querySelector('#funnelForm'),
  funnelInputs: document.querySelector('#funnelInputs'),
  addStep: document.querySelector('#addStep'),
  analyzeBtn: document.querySelector('#analyzeBtn'),
  analyzeWithPastBtn: document.querySelector('#analyzeWithPastBtn'),
  formMessage: document.querySelector('#formMessage'),
  refreshHistoryBtn: document.querySelector('#refreshHistoryBtn'),
  deleteAll: document.querySelector('#deleteAll'),
  historyMessage: document.querySelector('#historyMessage'),
  historyContainer: document.querySelector('.history-container'),
  historyList: document.querySelector('#historyList'),
  resultsSection: document.querySelector('#resultsSection'),
  analysisMeta: document.querySelector('#analysisMeta'),
  metricCards: document.querySelector('#metricCards'),
  funnelChart: document.querySelector('#funnelChart'),
  insightSummary: document.querySelector('#insightSummary'),
  recommendationList: document.querySelector('#recommendationList'),
  alertList: document.querySelector('#alertList'),
  conversionChart: document.querySelector('#conversionChart'),
  compareSection: document.querySelector('#compareSection'),
  compareStatus: document.querySelector('#compareStatus'),
  compareSummary: document.querySelector('#compareSummary'),
  previousConversion: document.querySelector('#previousConversion'),
  currentConversion: document.querySelector('#currentConversion'),
  conversionDelta: document.querySelector('#conversionDelta'),
  previousDate: document.querySelector('#previousDate'),
  currentDate: document.querySelector('#currentDate'),
  deltaFootnote: document.querySelector('#deltaFootnote'),
  previousMetrics: document.querySelector('#previousMetrics'),
  currentMetrics: document.querySelector('#currentMetrics'),
  stepChangeGrid: document.querySelector('#stepChangeGrid')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('', '&quot;')
    .replaceAll('', '&#39;');
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString();
}

function formatPercent(value) {
  const numeric = Number(value ?? 0);
  return `${numeric.toFixed(2).replace(/\.00$/, '')}%`;
}

function formatDate(value) {
  if (!value) {
    return 'No date';
  }

  return new Date(value).toLocaleString();
}

function formatSigned(value, suffix = '') {
  const numeric = Number(value ?? 0);
  const sign = numeric > 0 ? '+' : (numeric < 0 ? '-' : '');
  const absolute = Math.abs(numeric);
  const formatted = absolute % 1 === 0
    ? absolute.toLocaleString()
    : absolute.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return `${sign}${formatted}${suffix}`;
}

function getDirectionClass(direction) {
  if (direction === 'up') {
    return 'is-up';
  }

  if (direction === 'down') {
    return 'is-down';
  }

  return 'is-flat';
}

function getSeverityClass(severity) {
  if (severity === 'critical') {
    return 'is-critical';
  }

  if (severity === 'warning') {
    return 'is-warning';
  }

  return 'is-healthy';
}

function setNotice(type, message) {
  if (!message) {
    elements.formMessage.className = 'notice';
    elements.formMessage.textContent = '';
    return;
  }

  elements.formMessage.className = `notice is-visible ${type === 'error' ? 'is-error' : 'is-success'}`;
  elements.formMessage.textContent = message;
}

async function request(path, { method = 'GET', body } = {}) {
  if (body) {
    console.log('Sending steps:', body.steps ?? body.currentSteps ?? body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  console.log('Response:', data);

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed with status ${response.status}.`);
  }

  return data;
}

function syncDraftStepsFromDom() {
  const rows = [...elements.funnelInputs.querySelectorAll('[data-step-index]')];
  state.draftSteps = rows.map((row, index) => ({
    label: row.querySelector('[data-role=''step-label'']')?.value?.trim() || `Step ${index + 1}`,
    value: row.querySelector('[data-role=''step-value'']')?.value?.trim() || ''
  }));
}

function renderInputRows() {
  elements.funnelInputs.innerHTML = state.draftSteps.map((step, index) => `
    <article class=''step-row'' data-step-index=''${index}''>
      <div class=''field''>
        <label for=''step-label-${index}''>Step Name</label>
        <input
          id=''step-label-${index}''
          data-role=''step-label''
          type=''text''
          value=''${escapeHtml(step.label)}''
          placeholder=''Visitors''
        >
      </div>
      <div class=''field''>
        <label for=''step-value-${index}''>Step Value</label>
        <input
          id=''step-value-${index}''
          data-role=''step-value''
          type=''number''
          min=''0''
          step=''1''
          value=''${escapeHtml(step.value)}''
          placeholder=''0''
        >
      </div>
      <button
        class=''remove-step-button''
        type=''button''
        data-remove-step=''${index}''
        aria-label=''Remove step ${index + 1}''
        ${state.draftSteps.length <= MIN_STEPS ? 'disabled' : ''}
      >
        Remove
      </button>
    </article>
  `).join('');

  elements.addStep.disabled = state.draftSteps.length >= MAX_STEPS;
}

function collectSteps() {
  syncDraftStepsFromDom();

  if (state.draftSteps.length < MIN_STEPS) {
    throw new Error('At least two funnel steps are required.');
  }

  return state.draftSteps.map((step, index) => {
    const label = step.label.trim();
    const valueText = step.value.trim();

    if (!label) {
      throw new Error(`Step ${index + 1} name cannot be empty.`);
    }

    if (!valueText) {
      throw new Error(`Step ${index + 1} value cannot be empty.`);
    }

    const value = Number(valueText);

    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Step ${index + 1} must use a valid number.`);
    }

    return {
      label,
      value
    };
  });
}

function setAnalyzeLoading(isLoading) {
  elements.analyzeBtn.disabled = isLoading;
  elements.analyzeWithPastBtn.disabled = isLoading;
  elements.addStep.disabled = isLoading || state.draftSteps.length >= MAX_STEPS;
  elements.analyzeBtn.classList.toggle('is-loading', isLoading);

  const label = elements.analyzeBtn.querySelector('.button-label');
  if (label) {
    label.textContent = isLoading ? 'Analyzing...' : 'Analyze Funnel';
  }
}

function renderMetricCards(analysis) {
  const metrics = analysis?.metrics ?? {};
  elements.metricCards.innerHTML = [
    { label: 'Top Funnel', value: formatNumber(metrics.topOfFunnel) },
    { label: 'Conversion %', value: formatPercent(metrics.conversionRate) },
    { label: 'Biggest Drop', value: formatPercent(metrics.biggestDrop) },
    { label: 'Worst Step', value: metrics.worstStep ?? 'N/A' }
  ].map((item) => `
    <article class=''metric-card''>
      <p class=''metric-label''>${escapeHtml(item.label)}</p>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join('');
}

function renderFunnelBars(analysis) {
  const stepMetrics = analysis?.stepMetrics ?? [];

  if (stepMetrics.length === 0) {
    elements.funnelChart.innerHTML = '<article class=''funnel-row''><div class=''step-note''>No funnel data available yet.</div></article>';
    return;
  }

  elements.funnelChart.innerHTML = stepMetrics.map((step) => `
    <article class=''funnel-row''>
      <div class=''funnel-row-head''>
        <strong>${escapeHtml(step.label)}</strong>
        <span class=''delta-pill ${step.isBiggestDrop ? 'is-critical' : 'is-flat'}''>
          ${step.previousLabel ? `${escapeHtml(formatPercent(step.dropPercentFromPrevious))} drop` : 'Top step'}
        </span>
      </div>
      <div class=''funnel-track''>
        <div class=''funnel-fill ${step.isBiggestDrop ? 'is-critical' : ''}'' style=''width:${Math.max(Number(step.widthPercent ?? 0), 8)}%''>
          <span class=''bar-value''>${escapeHtml(formatNumber(step.value))}</span>
        </div>
      </div>
      <div class=''step-note''>${escapeHtml(formatPercent(step.conversionFromTop))} of top funnel remains</div>
    </article>
  `).join('');
}

function renderInsights(analysis) {
  const insights = String(analysis?.insights ?? 'No insights available yet.');
  const recommendations = analysis?.summary?.recommendations ?? [];
  const alerts = analysis?.summary?.alerts ?? [];

  elements.insightSummary.innerHTML = insights
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  elements.recommendationList.innerHTML = (recommendations.length > 0 ? recommendations : ['Run an analysis to see recommendations.'])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  elements.alertList.innerHTML = (alerts.length > 0 ? alerts : ['No active alerts.'])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
}

function renderPieChart(analysis) {
  const top = Number(analysis?.metrics?.topOfFunnel ?? 0);
  const converted = Math.min(Number(analysis?.metrics?.bottomOfFunnel ?? 0), top);
  const dropped = Math.max(top - converted, 0);

  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }

  if (!window.Chart) {
    return;
  }

  state.chart = new window.Chart(elements.conversionChart, {
    type: 'pie',
    data: {
      labels: ['Converted', 'Dropped Off'],
      datasets: [{
        data: [converted, dropped],
        backgroundColor: ['#6effc6', '#ff6c87'],
        borderColor: ['rgba(110,255,198,0.18)', 'rgba(255,108,135,0.18)'],
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#f3fff9',
            padding: 18
          }
        }
      }
    }
  });
}

function renderAnalysis(analysis, sourceLabel) {
  state.latestAnalysis = analysis;
  elements.resultsSection.hidden = false;
  elements.analysisMeta.className = `status-pill ${getSeverityClass(analysis?.summary?.severity)}`;
  elements.analysisMeta.textContent = `${analysis?.summary?.headline ?? 'Analysis ready'} | ${sourceLabel}`;

  renderMetricCards(analysis);
  renderFunnelBars(analysis);
  renderInsights(analysis);
  renderPieChart(analysis);
}

function populateInputsFromAnalysis(analysis) {
  const steps = analysis?.steps ?? [];

  if (steps.length < MIN_STEPS) {
    return;
  }

  state.draftSteps = steps.map((step) => ({
    label: step.label ?? 'Step',
    value: String(step.value ?? '')
  }));
  renderInputRows();
}

function renderHistory() {
  elements.deleteAll.disabled = state.history.length === 0;

  if (state.history.length === 0) {
    elements.historyMessage.textContent = 'No saved analyses yet. Run an analysis to build history.';
    elements.historyList.innerHTML = '';
    return;
  }

  elements.historyMessage.textContent = 'Saved analyses are ready to load or compare.';
  elements.historyList.innerHTML = state.history.map((item) => `
    <div class=''history-item'' data-history-id=''${escapeHtml(item.id)}''>
      <time datetime=''${escapeHtml(item.createdAt)}''>${escapeHtml(formatDate(item.createdAt))}</time>
      <strong>${escapeHtml(formatPercent(item.metrics?.conversionRate))} conversion</strong>
      <div class=''history-meta''>
        <span class=''tag''>${escapeHtml(item.metrics?.worstStep ?? 'N/A')}</span>
      </div>
      <div class=''history-actions''>
        <button class=''ghost-button'' type=''button'' data-action=''load'' data-id=''${escapeHtml(item.id)}''>Load</button>
        <button class=''secondary-button'' type=''button'' data-action=''compare'' data-id=''${escapeHtml(item.id)}''>Compare</button>
        <button class=''delete-one'' type=''button'' data-id=''${escapeHtml(item.id)}''>Delete</button>
      </div>
    </div>
  `).join('');

  bindDeleteButtons();
}

function renderCompareMetrics(target, analysis) {
  const metrics = analysis?.metrics ?? {};
  target.innerHTML = [
    { label: 'Top Funnel', value: formatNumber(metrics.topOfFunnel) },
    { label: 'Conversion %', value: formatPercent(metrics.conversionRate) },
    { label: 'Biggest Drop', value: formatPercent(metrics.biggestDrop) },
    { label: 'Worst Step', value: metrics.worstStep ?? 'N/A' }
  ].map((item) => `
    <article class=''compare-metric''>
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join('');
}

function renderComparison(payload) {
  const comparison = payload?.comparison ?? {};
  const current = payload?.current ?? {};
  const previous = payload?.previous ?? {};
  const conversionChange = comparison.conversionChange ?? {};
  const directionClass = getDirectionClass(comparison.direction);

  state.latestComparison = payload;
  elements.compareSection.hidden = false;
  elements.compareStatus.className = `status-pill ${directionClass === 'is-up' ? 'is-healthy' : (directionClass === 'is-down' ? 'is-critical' : 'is-warning')}`;
  elements.compareStatus.textContent = comparison.direction === 'up'
    ? 'Improved'
    : (comparison.direction === 'down' ? 'Worse' : 'Flat');
  elements.compareSummary.textContent = comparison.summary ?? 'No comparison summary available.';
  elements.previousConversion.textContent = formatPercent(previous.metrics?.conversionRate);
  elements.currentConversion.textContent = formatPercent(current.metrics?.conversionRate);
  elements.conversionDelta.textContent = formatSigned(conversionChange.points, '%');
  elements.previousDate.textContent = `Saved ${formatDate(previous.createdAt)}`;
  elements.currentDate.textContent = `Current ${formatDate(current.createdAt)}`;
  elements.deltaFootnote.textContent = conversionChange.relativeChange === null || conversionChange.relativeChange === undefined
    ? 'No prior conversion baseline'
    : `${formatSigned(conversionChange.relativeChange, '%')} relative change`;

  renderCompareMetrics(elements.previousMetrics, previous);
  renderCompareMetrics(elements.currentMetrics, current);

  const stepChanges = comparison.stepChanges ?? [];
  elements.stepChangeGrid.innerHTML = stepChanges.length > 0
    ? stepChanges.map((step) => `
      <article class=''step-change-card''>
        <div class=''step-change-head''>
          <strong>${escapeHtml(step.label)}</strong>
          <span class=''delta-pill ${getDirectionClass(step.direction)}''>${escapeHtml(step.relativeChange === null || step.relativeChange === undefined ? 'New baseline' : formatSigned(step.relativeChange, '%'))}</span>
        </div>
        <div class=''step-change-foot''>
          ${escapeHtml(formatNumber(step.previousValue))} -> ${escapeHtml(formatNumber(step.currentValue))} |
          ${escapeHtml(formatSigned(step.absoluteChange))} users
        </div>
      </article>
    `).join('')
    : '<article class=''step-change-card''><div class=''step-change-foot''>No step comparison data available.</div></article>';
}

async function loadHistory() {
  try {
    elements.refreshHistoryBtn.disabled = true;
    elements.deleteAll.disabled = true;
    const data = await request('/analysis/history');
    state.history = Array.isArray(data.items) ? data.items : [];
    renderHistory();
  } catch (error) {
    console.error('History load failed:', error);
    state.history = [];
    renderHistory();
    setNotice('error', error.message);
  } finally {
    elements.refreshHistoryBtn.disabled = false;
    elements.deleteAll.disabled = state.history.length === 0;
  }
}

function resetHistoryViewsIfEmpty() {
  if (state.history.length > 0) {
    return;
  }

  elements.compareSection.hidden = true;
}

function bindDeleteButtons() {
  document.querySelectorAll('.delete-one').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      console.log('Deleting ID:', id);

      if (!id) {
        console.error('No ID found for delete');
        return;
      }

      if (!confirm('Are you sure you want to delete this analysis?')) {
        return;
      }

      try {
        const res = await fetch(`/analysis/${id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        console.log('Delete response:', data);

        if (res.ok) {
          state.history = state.history.filter((item) => item.id !== id);
          btn.closest('.history-item')?.remove();

          if (state.history.length === 0) {
            elements.historyContainer.innerHTML = '';
            elements.historyMessage.textContent = 'No saved analyses yet. Run an analysis to build history.';
            elements.deleteAll.disabled = true;
            resetHistoryViewsIfEmpty();
          }

          setNotice('success', 'Analysis deleted successfully.');
        } else {
          alert('Delete failed');
        }
      } catch (err) {
        console.error('Delete error:', err);
      }
    };
  });
}

async function deleteAllHistory() {
  if (!confirm('Delete ALL history?')) {
    return;
  }

  try {
    console.log('🚀 Calling delete all API');
    elements.deleteAll.disabled = true;
    const res = await fetch('/analysis/history', {
      method: 'DELETE'
    });
    const data = await res.json();
    console.log('📦 Response:', data);

    if (res.ok && data.success) {
      state.history = [];
      elements.historyContainer.innerHTML = '';
      elements.historyMessage.textContent = 'No saved analyses yet. Run an analysis to build history.';
      resetHistoryViewsIfEmpty();
      alert('All history deleted successfully');
      setNotice('success', 'All history deleted successfully.');
    } else {
      alert(`Delete failed: ${data.message || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('Frontend delete error:', err);
    alert('Delete request failed');
  } finally {
    elements.deleteAll.disabled = state.history.length === 0;
  }
}

async function runCompare(previousId, currentSteps) {
  const data = await request('/analysis/compare', {
    method: 'POST',
    body: {
      currentSteps,
      previousId
    }
  });

  renderComparison(data);
}

async function analyzeCurrentFunnel({ compareWithPast = false } = {}) {
  try {
    setNotice('', '');
    setAnalyzeLoading(true);

    const steps = collectSteps();
    const previousId = compareWithPast ? (state.history[0]?.id ?? null) : null;
    const analysis = await request('/analyze', {
      method: 'POST',
      body: { steps }
    });

    renderAnalysis(analysis, 'Latest saved analysis');
    await loadHistory();

    if (compareWithPast && previousId) {
      await runCompare(previousId, analysis.steps);
      elements.compareSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setNotice('success', 'Analysis complete and compared with the latest saved analysis.');
      return;
    }

    setNotice(
      'success',
      compareWithPast
        ? 'Analysis complete. No previous history exists yet, so only the latest dashboard was rendered.'
        : 'Analysis complete and saved successfully.'
    );
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error('Analyze failed:', error);
    setNotice('error', error.message);
  } finally {
    setAnalyzeLoading(false);
  }
}

async function compareWithHistory(previousId) {
  try {
    setNotice('', '');
    const currentSteps = collectSteps();
    await runCompare(previousId, currentSteps);
    setNotice('success', 'Comparison generated successfully.');
    elements.compareSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error('Compare failed:', error);
    setNotice('error', error.message);
  }
}

function handleHistoryClick(event) {
  const button = event.target.closest('[data-action]');

  if (!button) {
    return;
  }

  const item = state.history.find((entry) => entry.id === button.dataset.id);

  if (!item) {
    return;
  }

  if (button.dataset.action === 'load') {
    populateInputsFromAnalysis(item);
    renderAnalysis(item, 'Loaded from history');
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  compareWithHistory(item.id);
}

function handleInputActions(event) {
  const removeButton = event.target.closest('[data-remove-step]');

  if (!removeButton) {
    return;
  }

  syncDraftStepsFromDom();
  state.draftSteps.splice(Number(removeButton.dataset.removeStep), 1);

  if (state.draftSteps.length < MIN_STEPS) {
    state.draftSteps = DEFAULT_STEPS.slice(0, MIN_STEPS).map((step) => ({ ...step }));
  }

  renderInputRows();
}

function handleAddStep() {
  syncDraftStepsFromDom();

  if (state.draftSteps.length >= MAX_STEPS) {
    return;
  }

  state.draftSteps.push({
    label: `Step ${state.draftSteps.length + 1}`,
    value: ''
  });
  renderInputRows();
}

function bindEvents() {
  elements.funnelForm.addEventListener('submit', (event) => {
    event.preventDefault();
    analyzeCurrentFunnel();
  });

  elements.addStep.addEventListener('click', handleAddStep);
  elements.analyzeWithPastBtn.addEventListener('click', () => {
    analyzeCurrentFunnel({ compareWithPast: true });
  });
  elements.refreshHistoryBtn.addEventListener('click', loadHistory);
  elements.deleteAll.onclick = deleteAllHistory;
  elements.funnelInputs.addEventListener('click', handleInputActions);
  elements.historyList.addEventListener('click', handleHistoryClick);
}

function init() {
  renderInputRows();
  renderHistory();
  bindEvents();
  loadHistory();
}

init();
