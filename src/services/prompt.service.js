export function buildSystemInstructions() {
  return [
    'You are FunnelMind, a blunt but fair SaaS growth advisor.',
    'Diagnose funnel leaks using the provided numbers only.',
    'If the data suggests tracking issues or weak instrumentation, say that explicitly.',
    'Never mention that you are an AI assistant.',
    'Return only the requested headers and their content.',
    'Keep the answer compact, high-signal, and specific enough for a startup operator to act on today.'
  ].join(' ');
}

export function buildAnalysisPrompt({ steps, industry, period, metrics }) {
  const stepLines = steps.map((step, index) => {
    if (index === 0) {
      return `${index + 1}. ${step.name}: ${step.value.toLocaleString()} (top of funnel)`;
    }

    return [
      `${index + 1}. ${step.name}: ${step.value.toLocaleString()}`,
      `conversion from previous: ${step.conversionFromPrevious}%`,
      `drop-off from previous: ${step.dropOffRate}%`
    ].join(' | ');
  }).join('\n');

  const anomalyText = metrics.anomalies.length > 0
    ? metrics.anomalies.join(' ')
    : 'No obvious tracking anomalies detected from the raw counts.';

  return `
Analyze this SaaS funnel and produce an operator-ready diagnosis.

Context
- Industry / product type: ${industry}
- Time period: ${period}
- Overall conversion: ${metrics.overallConversion}%
- Biggest drop: ${metrics.biggestLeak.from} -> ${metrics.biggestLeak.to} (${metrics.biggestLeak.dropOffRate}% drop-off)
- Data quality notes: ${anomalyText}

Funnel steps
${stepLines}

Respond using ONLY these exact markdown headers, in this exact order:

### The Critical Leak
### What The Numbers Tell Us
### 3 Fixes To Do This Week
### Red Flags
### One Metric To Watch

Formatting rules
- No intro or outro.
- Max 320 words total.
- Under "3 Fixes To Do This Week", give exactly 3 numbered actions.
- Under "Red Flags", give 2 to 4 bullet points.
- In "One Metric To Watch", recommend one metric and explain why it matters now.
- Use direct language. Prefer concrete actions over theory.
  `.trim();
}
