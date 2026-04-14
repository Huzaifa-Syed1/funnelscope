import { listAnalysesForUser } from '../services/analysis.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const listAnalyses = asyncHandler(async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 30) : 12;

  const items = await listAnalysesForUser(req.user._id, limit);

  res.json({
    success: true,
    items: items.map((item) => ({
      id: item._id.toString(),
      userId: item.userId?.toString?.() ?? req.user._id.toString(),
      createdAt: item.createdAt,
      timestamp: item.createdAt,
      funnelSteps: item.funnelSteps,
      result: item.result,
      context: item.result?.context ?? null,
      results: item.result?.analysis ?? null
    }))
  });
});
