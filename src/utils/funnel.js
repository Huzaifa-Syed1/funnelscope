import { HttpError } from './http-error.js';

export const REQUIRED_HEADERS = [
  'The Critical Leak',
  'What The Numbers Tell Us',
  '3 Fixes To Do This Week',
  'Red Flags',
  'One Metric To Watch'
];

export function cleanText(value, fallback, maxLength = 80) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maxLength);
}

export function normalizeFunnelSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) {
    throw new HttpError(400, 'funnelSteps must be an array of step objects.');
  }

  const steps = rawSteps.map((step, index) => {
    const value = Number(step?.value);
    if (!Number.isFinite(value) || value < 0) {
      throw new HttpError(400, `Step ${index + 1} must have a numeric value greater than or equal to 0.`);
    }

    return {
      name: cleanText(step?.name, `Step ${index + 1}`, 32),
      value: Math.round(value)
    };
  }).filter((step) => step.value > 0);

  if (steps.length < 2) {
    throw new HttpError(400, 'Enter at least two funnel steps with values greater than 0.');
  }

  return steps;
}

export function buildFunnelMetrics(steps) {
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];

  const metrics = steps.map((step, index) => {
    if (index === 0) {
      return {
        ...step,
        conversionFromPrevious: 100,
        dropOffRate: 0,
        shareOfTop: 100
      };
    }

    const previousStep = steps[index - 1];
    const conversionFromPrevious = previousStep.value > 0 ? (step.value / previousStep.value) * 100 : 0;
    const dropOffRate = previousStep.value > 0 ? ((previousStep.value - step.value) / previousStep.value) * 100 : 0;
    const shareOfTop = firstStep.value > 0 ? (step.value / firstStep.value) * 100 : 0;

    return {
      ...step,
      conversionFromPrevious: Number(conversionFromPrevious.toFixed(1)),
      dropOffRate: Number(dropOffRate.toFixed(1)),
      shareOfTop: Number(shareOfTop.toFixed(1))
    };
  });

  let biggestLeak = {
    from: metrics[0].name,
    to: metrics[1].name,
    dropOffRate: metrics[1].dropOffRate,
    conversionRate: metrics[1].conversionFromPrevious
  };

  const anomalies = [];

  for (let index = 1; index < metrics.length; index += 1) {
    const previousStep = metrics[index - 1];
    const currentStep = metrics[index];

    if (currentStep.dropOffRate > biggestLeak.dropOffRate) {
      biggestLeak = {
        from: previousStep.name,
        to: currentStep.name,
        dropOffRate: currentStep.dropOffRate,
        conversionRate: currentStep.conversionFromPrevious
      };
    }

    if (currentStep.value > previousStep.value) {
      anomalies.push(`${currentStep.name} is higher than ${previousStep.name}, which usually signals tracking or event-definition drift.`);
    }
  }

  const overallConversion = firstStep.value > 0 ? Number(((lastStep.value / firstStep.value) * 100).toFixed(1)) : 0;

  return {
    steps: metrics,
    topOfFunnel: firstStep.value,
    bottomOfFunnel: lastStep.value,
    overallConversion,
    biggestLeak,
    anomalies
  };
}

function splitSectionToItems(text, fallbackMessage) {
  const normalizedItems = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
    .filter(Boolean);

  if (normalizedItems.length > 0) {
    return normalizedItems;
  }

  const sentenceItems = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentenceItems.length > 0 ? sentenceItems : [fallbackMessage];
}

export function parseAnalysisSections(rawText) {
  const buckets = new Map(REQUIRED_HEADERS.map((header) => [header, []]));
  let currentHeader = null;

  for (const line of rawText.split(/\r?\n/)) {
    const headerMatch = line.trim().match(/^###\s*(.+)$/);

    if (headerMatch && buckets.has(headerMatch[1])) {
      currentHeader = headerMatch[1];
      continue;
    }

    if (currentHeader) {
      buckets.get(currentHeader).push(line);
    }
  }

  const section = (header, fallback) => {
    const value = buckets.get(header).join('\n').trim();
    return value || fallback;
  };

  const criticalLeak = section('The Critical Leak', 'No critical leak returned.');
  const whatNumbersTellUs = section('What The Numbers Tell Us', 'No explanation returned.');
  const fixesSource = section('3 Fixes To Do This Week', 'No fixes returned.');
  const redFlagsSource = section('Red Flags', 'No red flags returned.');
  const metricToWatch = section('One Metric To Watch', 'No metric recommendation returned.');

  return {
    criticalLeak,
    whatNumbersTellUs,
    fixes: splitSectionToItems(fixesSource, 'No fixes returned.').slice(0, 3),
    redFlags: splitSectionToItems(redFlagsSource, 'No red flags returned.').slice(0, 4),
    metricToWatch,
    markdown: REQUIRED_HEADERS.map((header) => `### ${header}\n${section(header, '')}`.trim()).join('\n\n')
  };
}
