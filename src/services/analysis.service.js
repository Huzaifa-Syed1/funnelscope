import Analysis from '../models/Analysis.js';
import { HttpError } from '../utils/http-error.js';

const MIN_STEPS = 2;
const MAX_STEPS = 8;
const FALLBACK_RECOMMENDATIONS = [
  'Tighten onboarding copy and reduce friction in the first meaningful action.',
  'Improve UI clarity around the next-step CTA so each transition feels obvious.',
  'Clarify pricing communication before users hit the commitment moment.',
  'Add retention hooks such as reminders, saved progress, or lifecycle nudges.'
];

function round(value, digits = 2) {
  return Number.parseFloat(Number(value).toFixed(digits));
}

function formatPercent(value) {
  return `${round(value)}%`;
}

function normalizeLabel(value, fallback) {
  const cleaned = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
}

function buildLabelKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function uniquePush(target, value) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

export function normalizeSteps(input) {
  if (!Array.isArray(input)) {
    throw new HttpError(400, 'steps must be an array of funnel step objects.');
  }

  if (input.length < MIN_STEPS || input.length > MAX_STEPS) {
    throw new HttpError(400, `Provide between ${MIN_STEPS} and ${MAX_STEPS} funnel steps.`);
  }

  const steps = input.map((step, index) => {
    const label = normalizeLabel(step?.label ?? step?.name, `Step ${index + 1}`);
    const value = Number(step?.value);

    if (!Number.isFinite(value) || value < 0) {
      throw new HttpError(400, `Step "${label}" must include a numeric value greater than or equal to 0.`);
    }

    return {
      label,
      value: round(value, 0)
    };
  });

  if (steps[0].value <= 0) {
    throw new HttpError(400, 'The first funnel step must be greater than 0.');
  }

  return steps;
}

export function buildAnalysisPayload(steps, metadata = {}) {
  const topOfFunnel = steps[0].value;
  const bottomOfFunnel = steps.at(-1)?.value ?? 0;
  const drops = [];
  const growthSteps = [];

  const stepMetrics = steps.map((step, index) => {
    const previous = steps[index - 1] ?? null;
    const rawDropPercent = previous && previous.value > 0
      ? ((previous.value - step.value) / previous.value) * 100
      : 0;
    const dropPercent = round(Math.max(rawDropPercent, 0));
    const widthPercent = round(Math.min((step.value / topOfFunnel) * 100, 100));
    const conversionFromTop = round((step.value / topOfFunnel) * 100);

    if (previous && rawDropPercent >= 0) {
      drops.push({
        from: previous.label,
        to: step.label,
        dropPercent
      });
    }

    if (previous && previous.value > 0 && step.value > previous.value) {
      growthSteps.push({
        from: previous.label,
        to: step.label,
        growthPercent: round(((step.value - previous.value) / previous.value) * 100)
      });
    }

    return {
      label: step.label,
      value: step.value,
      widthPercent,
      conversionFromTop,
      dropPercentFromPrevious: previous ? dropPercent : 0,
      previousLabel: previous?.label ?? null
    };
  });

  const biggestDropEntry = drops.reduce((current, entry) => {
    if (!current || entry.dropPercent > current.dropPercent) {
      return entry;
    }

    return current;
  }, null);

  const conversionRate = round((bottomOfFunnel / topOfFunnel) * 100);
  const biggestDrop = biggestDropEntry?.dropPercent ?? 0;
  const worstStep = biggestDropEntry?.to ?? 'No major leak detected';
  const recommendations = [];
  const alerts = [];
  const severity = conversionRate < 5 || biggestDrop > 50
    ? 'critical'
    : (conversionRate < 15 || biggestDrop >= 20 ? 'warning' : 'healthy');

  let headline = 'This funnel is holding steady and ready for iterative gains.';

  if (conversionRate < 5) {
    headline = 'Your funnel is critically underperforming.';
    uniquePush(alerts, 'Overall conversion is below 5%, so the funnel is leaking demand before revenue can compound.');
  } else if (severity === 'warning') {
    headline = 'This funnel needs optimization before it can scale efficiently.';
  }

  if (biggestDropEntry) {
    if (biggestDrop > 50) {
      uniquePush(alerts, `${biggestDropEntry.from} -> ${biggestDropEntry.to} is a critical leak with a ${formatPercent(biggestDrop)} drop.`);
    } else if (biggestDrop >= 20) {
      uniquePush(alerts, `${biggestDropEntry.from} -> ${biggestDropEntry.to} needs optimization with a ${formatPercent(biggestDrop)} drop.`);
    }
  }

  if (growthSteps.length > 0) {
    uniquePush(
      alerts,
      `Some steps increase instead of decrease (${growthSteps[0].from} -> ${growthSteps[0].to}), which may indicate attribution or event-definition mismatch.`
    );
  }

  const leakLabel = buildLabelKey(`${biggestDropEntry?.from ?? ''} ${biggestDropEntry?.to ?? ''}`);

  if (/(signup|onboard|activate|trial|start|welcome)/.test(leakLabel)) {
    uniquePush(recommendations, 'Improve onboarding flow so users reach the first value moment faster.');
    uniquePush(recommendations, 'Reduce UI ambiguity around the next-step action and simplify the first-run experience.');
  }

  if (/(plan|price|pricing|paid|checkout|billing|purchase|subscribe)/.test(leakLabel)) {
    uniquePush(recommendations, 'Strengthen pricing communication and reinforce value before the purchase decision.');
  }

  if (/(retain|renew|active|engage|usage|customer)/.test(leakLabel) || stepMetrics.at(-1)?.conversionFromTop < 20) {
    uniquePush(recommendations, 'Add retention hooks such as reminders, saved progress, and lifecycle nudges.');
  }

  uniquePush(recommendations, 'Tighten UI clarity around the weakest transition so users know exactly what to do next.');

  while (recommendations.length < 4) {
    uniquePush(recommendations, FALLBACK_RECOMMENDATIONS[recommendations.length]);
  }

  const criticalLeak = biggestDropEntry
    ? `The sharpest leak is between ${biggestDropEntry.from} and ${biggestDropEntry.to}, where ${formatPercent(biggestDrop)} of users drop out.`
    : 'No single catastrophic leak stands out, so focus on incremental improvements across the journey.';

  const insights = metadata.insights ?? [
    headline,
    `Overall conversion is ${formatPercent(conversionRate)} from ${steps[0].label} (${steps[0].value.toLocaleString()}) to ${steps.at(-1)?.label} (${bottomOfFunnel.toLocaleString()}).`,
    criticalLeak,
    `Recommended focus areas: ${recommendations.join(' ')}`,
    alerts.length > 0 ? `Signal check: ${alerts.join(' ')}` : 'Signal check: the funnel has no major structural red flags.'
  ].join('\n');

  return {
    id: metadata.id ?? null,
    createdAt: metadata.createdAt ?? new Date().toISOString(),
    steps,
    stepMetrics: stepMetrics.map((step) => ({
      ...step,
      isBiggestDrop: step.label === worstStep && biggestDrop > 0
    })),
    metrics: {
      topOfFunnel,
      bottomOfFunnel,
      conversionRate,
      biggestDrop,
      worstStep
    },
    insights,
    summary: {
      severity,
      headline,
      criticalLeak,
      recommendations,
      alerts
    }
  };
}

export function buildStoredAnalysisPayload(record) {
  return buildAnalysisPayload(record.steps, {
    id: String(record._id),
    createdAt: record.createdAt,
    insights: record.insights
  });
}

export async function saveAnalysisAndBuildPayload(steps) {
  const analysis = buildAnalysisPayload(steps);

  const record = await Analysis.create({
    steps: analysis.steps,
    metrics: {
      conversionRate: analysis.metrics.conversionRate,
      biggestDrop: analysis.metrics.biggestDrop,
      worstStep: analysis.metrics.worstStep
    },
    insights: analysis.insights
  });

  return buildStoredAnalysisPayload(record.toObject());
}

function buildDelta(currentValue, previousValue) {
  const absoluteChange = round(currentValue - previousValue);

  if (previousValue === 0 && currentValue === 0) {
    return {
      absoluteChange,
      relativeChange: 0,
      direction: 'flat'
    };
  }

  if (previousValue === 0) {
    return {
      absoluteChange,
      relativeChange: null,
      direction: 'up'
    };
  }

  const relativeChange = round((absoluteChange / previousValue) * 100);

  return {
    absoluteChange,
    relativeChange,
    direction: absoluteChange > 0 ? 'up' : (absoluteChange < 0 ? 'down' : 'flat')
  };
}

export function buildComparisonPayload({ currentSteps, previousAnalysis }) {
  const current = buildAnalysisPayload(currentSteps);
  const previous = buildStoredAnalysisPayload(previousAnalysis);
  const previousStepMap = new Map(
    previous.steps.map((step, index) => [buildLabelKey(step.label), { ...step, index }])
  );

  const stepChanges = current.steps.map((step, index) => {
    const previousStep = previousStepMap.get(buildLabelKey(step.label)) ?? previous.steps[index] ?? null;
    const delta = buildDelta(step.value, previousStep?.value ?? 0);

    return {
      label: step.label,
      currentValue: step.value,
      previousValue: previousStep?.value ?? 0,
      absoluteChange: delta.absoluteChange,
      relativeChange: delta.relativeChange,
      direction: delta.direction
    };
  });

  const conversionDeltaPoints = round(current.metrics.conversionRate - previous.metrics.conversionRate);
  const conversionDeltaRelative = previous.metrics.conversionRate === 0
    ? null
    : round((conversionDeltaPoints / previous.metrics.conversionRate) * 100);
  const conversionDirection = conversionDeltaPoints > 0 ? 'up' : (conversionDeltaPoints < 0 ? 'down' : 'flat');
  const biggestImprovement = [...stepChanges].sort((left, right) => right.absoluteChange - left.absoluteChange)[0] ?? null;
  const biggestRegression = [...stepChanges].sort((left, right) => left.absoluteChange - right.absoluteChange)[0] ?? null;

  let summary = `Overall conversion is unchanged at ${formatPercent(current.metrics.conversionRate)} compared with the selected historical analysis.`;

  if (conversionDirection === 'up') {
    summary = `Overall conversion improved by ${formatPercent(Math.abs(conversionDeltaPoints))} compared with the selected historical analysis.`;
  } else if (conversionDirection === 'down') {
    summary = `Overall conversion dropped by ${formatPercent(Math.abs(conversionDeltaPoints))} compared with the selected historical analysis.`;
  }

  return {
    current,
    previous,
    comparison: {
      summary,
      direction: conversionDirection,
      conversionChange: {
        current: current.metrics.conversionRate,
        previous: previous.metrics.conversionRate,
        points: conversionDeltaPoints,
        relativeChange: conversionDeltaRelative
      },
      stepChanges,
      highlights: {
        biggestImprovement,
        biggestRegression
      }
    }
  };
}
