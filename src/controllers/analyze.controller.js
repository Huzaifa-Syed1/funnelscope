import { buildSystemInstructions, buildAnalysisPrompt } from '../services/prompt.service.js';
import { generateFunnelAnalysis } from '../services/openai.service.js';
import { saveAnalysisIfPossible } from '../services/analysis.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { buildFunnelMetrics, cleanText, normalizeFunnelSteps, parseAnalysisSections } from '../utils/funnel.js';

export const analyzeFunnel = asyncHandler(async (req, res) => {
  const steps = normalizeFunnelSteps(req.body.funnelSteps ?? req.body.steps);
  const industry = cleanText(req.body.industry, 'SaaS product', 80);
  const period = cleanText(req.body.period, 'Last 30 days', 40);

  const metrics = buildFunnelMetrics(steps);
  const prompt = buildAnalysisPrompt({
    steps: metrics.steps,
    industry,
    period,
    metrics
  });

  const aiResult = await generateFunnelAnalysis({
    prompt,
    systemInstructions: buildSystemInstructions()
  });

  const structured = parseAnalysisSections(aiResult.text);
  const resultPayload = {
    context: {
      industry,
      period,
      metrics: {
        topOfFunnel: metrics.topOfFunnel,
        bottomOfFunnel: metrics.bottomOfFunnel,
        overallConversion: metrics.overallConversion,
        biggestLeak: metrics.biggestLeak,
        anomalies: metrics.anomalies
      }
    },
    analysis: {
      model: aiResult.model,
      responseId: aiResult.responseId,
      criticalLeak: structured.criticalLeak,
      whatNumbersTellUs: structured.whatNumbersTellUs,
      fixes: structured.fixes,
      redFlags: structured.redFlags,
      metricToWatch: structured.metricToWatch,
      markdown: structured.markdown
    },
    usage: aiResult.usage ?? null
  };

  const savedAnalysis = await saveAnalysisIfPossible({
    userId: req.user?._id ?? null,
    funnelSteps: metrics.steps,
    result: resultPayload
  });

  res.json({
    success: true,
    message: 'Analysis generated successfully.',
    ok: true,
    funnel: {
      industry,
      period,
      steps: metrics.steps,
      metrics: {
        topOfFunnel: metrics.topOfFunnel,
        bottomOfFunnel: metrics.bottomOfFunnel,
        overallConversion: metrics.overallConversion,
        biggestLeak: metrics.biggestLeak,
        anomalies: metrics.anomalies
      }
    },
    analysis: {
      model: aiResult.model,
      responseId: aiResult.responseId,
      criticalLeak: structured.criticalLeak,
      whatNumbersTellUs: structured.whatNumbersTellUs,
      fixes: structured.fixes,
      redFlags: structured.redFlags,
      metricToWatch: structured.metricToWatch,
      markdown: structured.markdown
    },
    saved: Boolean(savedAnalysis),
    analysisId: savedAnalysis?._id ?? null,
    timestamp: savedAnalysis?.createdAt ?? new Date().toISOString()
  });
});
