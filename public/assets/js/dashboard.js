const DEFAULT_STEPS = [
  { label: 'Visitors', value: '18000' },
  { label: 'Signups', value: '3400' },
  { label: 'Activated', value: '1420' },
  { label: 'Paid', value: '280' },
  { label: 'Retained', value: '160' }
];

const MAX_STEPS = 8;
const MIN_STEPS = 2;
const API_BASE_URL = 'http://localhost:3000';

const state = {
  draftSteps: [...DEFAULT_STEPS],
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
  historyMessage: document.querySelector('#historyMessage'),
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
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function formatPercent(value) {
  return `${Number(value).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatSigned(value, suffix = '') {
  const absolute = Math.abs(Number(value));
  const sign = Number(value) > 0 ? '+' : (Number(value) < 0 ? '-' : '');
  const formatted = absolute % 1 === 0 ? absolute.toLocaleString() : absolute.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${sign}${formatted}${suffix}`;
}

function formatRelativeChange(value) {
  if (value === null || value === undefined) {
    return 'New baseline';
  }

  return formatSigned(value, '%');
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function setNotice(element, type, text) {
  if (!text) {
    element.className = 'notice';
    element.textContent = '';
    return;
  }

  element.className = `notice is-visible ${type === 'error' ? 'is-error' : 'is-success'}`;
  element.textContent = text;
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

function getDirectionClass(direction) {
  if (direction === 'down') {
    return 'is-down';
  }

  if (direction === 'up') {
    return 'is-up';
  }

  return 'is-flat';
}

function request(path, { method = 'GET', body } = {}) {
  const url = `${API_BASE_URL}${path}`;

  if (body) {
    console.log('Sending steps:', body.steps ?? body.currentSteps ?? body);
  }

  return fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (response) => {
    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      throw new Error(payload?.error ?? `Request failed with status ${response.status}.`);
    }

    console.log('Response:', payload);
    return payload;
  });
}

const api = {
  analyze(payload) {
    return request('/analyze', {
      method: 'POST',
      body: payload
    });
  },

  history() {
    return request('/analysis/history');
  },

  compare(payload) {
    return request('/analysis/compare', {
      method: 'POST',
      body: payload
    });
  }
};

function syncDraftStepsFromDom() {
  const rows = [...elements.stepRows.querySelectorAll('[data-step-index]')];
  state.draftSteps = rows.map((row, index) => ({
    label: row.querySelector('[data-field="label"]').value.trim() || `Step ${index + 1}`,
    value: row.querySelector('[data-field="value"]').value.trim()
  }));
}

function renderStepRows() {
  elements.stepRows.innerHTML = state.draftSteps.map((step, index) => `
    <article class="step-row" data-step-index="${index}">
      <div class="field">
        <label for="step-label-${index}">Step Label</label>
        <input
          id="step-label-${index}"
          data-field="label"
          type="text"
          value="${escapeHtml(step.label)}"
          placeholder="Visitors"
        >
      </div>
      <div class="field">
        <label for="step-value-${index}">Volume</label>
        <input
          id="step-value-${index}"
          data-field="value"
          type="number"
          min="0"
          value="${escapeHtml(step.value)}"
          placeholder="0"
        >
      </div>
      <button
        class="remove-step-button"
        type="button"
        data-remove-step="${index}"
        ${state.draftSteps.length <= MIN_STEPS ? 'disabled' : ''}
        aria-label="Remove step ${index + 1}"
      >
        ×
      </button>
    </article>
  `).join('');

  elements.addStepBtn.disabled = state.draftSteps.length >= MAX_STEPS;
}

function collectValidatedSteps() {
  syncDraftStepsFromDom();

  const steps = state.draftSteps.map((step, index) => ({
    label: step.label.trim() || `Step ${index + 1}`,
    value: Number(step.value)
  }));

  if (steps.length < MIN_STEPS) {
    throw new Error('Add at least two funnel steps before analyzing.');
  }

  if (steps.some((step) => !Number.isFinite(step.value) || step.value < 0)) {
    throw new Error('Each step must include a number greater than or equal to 0.');
  }

  if (steps[0].value <= 0) {
    throw new Error('The top-of-funnel step must be greater than 0.');
  }

  return steps;
}

function setAnalyzeLoading(isLoading) {
  elements.analyzeBtn.disabled = isLoading;
  elements.analyzeWithPastBtn.disabled = isLoading;
  elements.analyzeBtn.classList.toggle('is-loading', isLoading);
  elements.analyzeBtn.querySelector('.button-label').textContent = isLoading ? 'Analyzing...' : 'Analyze Funnel';
}

function renderHistory() {
  if (state.history.length === 0) {
    elements.historyList.innerHTML = '';
    elements.historyMessage.textContent = 'No analyses saved yet. Run your first funnel to start building history.';
    return;
  }

  elements.historyMessage.textContent = 'Load a past analysis or compare it against your current funnel.';
  elements.historyList.innerHTML = state.history.map((item) => `
    <article class="history-card">
      <time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatDate(item.createdAt))}</time>
      <strong>${escapeHtml(formatPercent(item.metrics.conversionRate))} conversion</strong>
      <div class="history-meta">
        <span class="tag">${escapeHtml(item.metrics.worstStep)}</span>
        <span class="tag">${escapeHtml(formatPercent(item.metrics.biggestDrop))} biggest drop</span>
      </div>
      <div class="history-actions">
        <button class="ghost-button" type="button" data-action="load" data-id="${escapeHtml(item.id)}">Load</button>
        <button class="secondary-button" type="button" data-action="compare" data-id="${escapeHtml(item.id)}">Compare</button>
      </div>
    </article>
  `).join('');
}

function renderMetricCards(analysis) {
  elements.metricCards.innerHTML = [
    { label: 'Top of Funnel', value: formatNumber(analysis.metrics.topOfFunnel) },
    { label: 'Overall Conversion', value: formatPercent(analysis.metrics.conversionRate) },
    { label: 'Biggest Drop', value: formatPercent(analysis.metrics.biggestDrop) },
    { label: 'Worst Step', value: analysis.metrics.worstStep }
  ].map((item) => `
    <article class="metric-card">
      <p class="metric-label">${escapeHtml(item.label)}</p>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join('');
}

function renderFunnel(analysis) {
  elements.funnelChart.innerHTML = analysis.stepMetrics.map((step) => `
    <article class="funnel-row">
      <div class="funnel-row-head">
        <strong>${escapeHtml(step.label)}</strong>
        <span class="delta-pill ${step.isBiggestDrop ? 'is-critical' : 'is-flat'}">
          ${step.previousLabel ? `${escapeHtml(formatPercent(step.dropPercentFromPrevious))} drop` : 'Top step'}
        </span>
      </div>
      <div class="funnel-track">
        <div class="funnel-fill ${step.isBiggestDrop ? 'is-critical' : ''}" style="width:${Math.max(step.widthPercent, 10)}%">
          <span class="bar-value">${escapeHtml(formatNumber(step.value))}</span>
        </div>
      </div>
      <div class="step-note">
        ${escapeHtml(formatPercent(step.conversionFromTop))} of top funnel remains at this stage
      </div>
    </article>
  `).join('');
}

function renderInsightBlocks(analysis) {
  elements.insightSummary.innerHTML = analysis.insights
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  elements.recommendationList.innerHTML = analysis.summary.recommendations
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  const alerts = analysis.summary.alerts.length > 0
    ? analysis.summary.alerts
    : ['No major structural risks were detected in this run.'];

  elements.alertList.innerHTML = alerts
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
}

function renderPieChart(analysis) {
  const top = analysis.metrics.topOfFunnel;
  const converted = Math.min(analysis.metrics.bottomOfFunnel, top);
  const dropped = Math.max(top - converted, 0);

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new window.Chart(elements.conversionChart, {
    type: 'pie',
    data: {
      labels: ['Converted', 'Dropped Off'],
      datasets: [{
        data: [converted, dropped],
        backgroundColor: ['#6effc6', '#ff6c87'],
        borderColor: ['rgba(110,255,198,0.16)', 'rgba(255,108,135,0.16)'],
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
            boxWidth: 16,
            padding: 18,
            font: {
              family: 'Aptos'
            }
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context.raw);
              return `${context.label}: ${value.toLocaleString()}`;
            }
          }
        }
      }
    }
  });
}

function renderAnalysis(analysis, sourceLabel = 'Saved analysis') {
  state.latestAnalysis = analysis;
  elements.resultsSection.hidden = false;
  elements.analysisMeta.className = `status-pill ${getSeverityClass(analysis.summary.severity)}`;
  elements.analysisMeta.textContent = `${analysis.summary.headline} • ${sourceLabel}`;

  renderMetricCards(analysis);
  renderFunnel(analysis);
  renderInsightBlocks(analysis);
  renderPieChart(analysis);
}

function buildCompareMetricMarkup(analysis) {
  return [
    { label: 'Top of Funnel', value: formatNumber(analysis.metrics.topOfFunnel) },
    { label: 'Bottom of Funnel', value: formatNumber(analysis.metrics.bottomOfFunnel) },
    { label: 'Biggest Drop', value: formatPercent(analysis.metrics.biggestDrop) },
    { label: 'Worst Step', value: analysis.metrics.worstStep }
  ].map((item) => `
    <article class="compare-metric">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join('');
}

function renderComparison(comparison) {
  state.latestComparison = comparison;
  elements.compareSection.hidden = false;

  const directionClass = getDirectionClass(comparison.comparison.direction);
  const conversionPoints = comparison.comparison.conversionChange.points;
  const relativeChange = comparison.comparison.conversionChange.relativeChange;

  elements.compareStatus.className = `status-pill ${directionClass === 'is-up' ? 'is-healthy' : (directionClass === 'is-down' ? 'is-critical' : 'is-warning')}`;
  elements.compareStatus.textContent = comparison.comparison.direction === 'up'
    ? 'Improved vs history'
    : (comparison.comparison.direction === 'down' ? 'Worse vs history' : 'Flat vs history');

  elements.compareSummary.textContent = comparison.comparison.summary;
  elements.previousConversion.textContent = formatPercent(comparison.previous.metrics.conversionRate);
  elements.currentConversion.textContent = formatPercent(comparison.current.metrics.conversionRate);
  elements.conversionDelta.textContent = formatSigned(conversionPoints, '%');
  elements.previousDate.textContent = `Saved ${formatDate(comparison.previous.createdAt)}`;
  elements.currentDate.textContent = `Current run ${formatDate(comparison.current.createdAt)}`;
  elements.deltaFootnote.textContent = relativeChange === null
    ? 'No prior conversion baseline'
    : `${formatSigned(relativeChange, '%')} relative change`;

  elements.previousMetrics.innerHTML = buildCompareMetricMarkup(comparison.previous);
  elements.currentMetrics.innerHTML = buildCompareMetricMarkup(comparison.current);

  elements.stepChangeGrid.innerHTML = comparison.comparison.stepChanges.map((step) => `
    <article class="step-change-card">
      <div class="step-change-head">
        <strong>${escapeHtml(step.label)}</strong>
        <span class="delta-pill ${getDirectionClass(step.direction)}">${escapeHtml(formatRelativeChange(step.relativeChange))}</span>
      </div>
      <div class="step-change-foot">
        ${escapeHtml(formatNumber(step.previousValue))} → ${escapeHtml(formatNumber(step.currentValue))} |
        ${escapeHtml(formatSigned(step.absoluteChange))} users
      </div>
    </article>
  `).join('');
}

async function loadHistory() {
  try {
    elements.refreshHistoryBtn.disabled = true;
    const payload = await api.history();
    state.history = payload.items ?? [];
    renderHistory();
  } catch (error) {
    state.history = [];
    renderHistory();
    setNotice(elements.formMessage, 'error', error.message);
  } finally {
    elements.refreshHistoryBtn.disabled = false;
  }
}

async function analyzeCurrentFunnel({ compareWithPast = false } = {}) {
  try {
    setNotice(elements.formMessage, '', '');
    setAnalyzeLoading(true);

    const previousId = compareWithPast ? (state.history[0]?.id ?? null) : null;
    const steps = collectValidatedSteps();
    const analysis = await api.analyze({ steps });

    renderAnalysis(analysis, compareWithPast ? 'Analyzed with past compare ready' : 'Latest saved analysis');
    await loadHistory();

    if (compareWithPast && previousId) {
      const comparison = await api.compare({
        currentSteps: analysis.steps,
        previousId
      });

      renderComparison(comparison);
      elements.compareSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setNotice(elements.formMessage, 'success', 'Analysis complete and compared with the latest saved history.');
      return;
    }

    if (compareWithPast) {
      setNotice(elements.formMessage, 'success', 'Analysis complete. No previous saved analysis exists yet, so only the current run was rendered.');
    } else {
      setNotice(elements.formMessage, 'success', 'Analysis complete and saved to history.');
    }

    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setNotice(elements.formMessage, 'error', error.message);
  } finally {
    setAnalyzeLoading(false);
  }
}

async function compareAgainstHistory(previousId) {
  try {
    const currentSteps = (() => {
      try {
        return collectValidatedSteps();
      } catch {
        if (state.latestAnalysis) {
          return state.latestAnalysis.steps;
        }

        throw new Error('Enter a valid current funnel or run an analysis before comparing.');
      }
    })();

    const comparison = await api.compare({
      currentSteps,
      previousId
    });

    renderComparison(comparison);
    elements.compareSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setNotice(elements.formMessage, 'success', 'Comparison generated successfully.');
  } catch (error) {
    setNotice(elements.formMessage, 'error', error.message);
  }
}

function handleHistoryAction(event) {
  const button = event.target.closest('[data-action]');

  if (!button) {
    return;
  }

  const item = state.history.find((entry) => entry.id === button.dataset.id);

  if (!item) {
    return;
  }

  if (button.dataset.action === 'load') {
    renderAnalysis(item, 'Loaded from history');
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  compareAgainstHistory(item.id);
}

function handleStepListClick(event) {
  const removeButton = event.target.closest('[data-remove-step]');

  if (!removeButton) {
    return;
  }

  syncDraftStepsFromDom();
  state.draftSteps.splice(Number(removeButton.dataset.removeStep), 1);

  if (state.draftSteps.length < MIN_STEPS) {
    state.draftSteps = [...DEFAULT_STEPS.slice(0, MIN_STEPS)];
  }

  renderStepRows();
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
  renderStepRows();
}

function bindEvents() {
  elements.funnelForm.addEventListener('submit', (event) => {
    event.preventDefault();
    analyzeCurrentFunnel();
  });

  elements.analyzeWithPastBtn.addEventListener('click', () => {
    analyzeCurrentFunnel({ compareWithPast: true });
  });

  elements.addStepBtn.addEventListener('click', handleAddStep);
  elements.refreshHistoryBtn.addEventListener('click', loadHistory);
  elements.stepRows.addEventListener('click', handleStepListClick);
  elements.historyList.addEventListener('click', handleHistoryAction);
}

function init() {
  renderStepRows();
  bindEvents();
  loadHistory();
}

init();
