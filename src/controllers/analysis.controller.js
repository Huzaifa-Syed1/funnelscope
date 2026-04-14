import Analysis from '../models/Analysis.js';
import {
  buildComparisonPayload,
  buildStoredAnalysisPayload,
  normalizeSteps,
  saveAnalysisAndBuildPayload
} from '../services/analysis.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';

console.log('Model loaded:', Analysis ? 'YES' : 'NO');

export const analyzeFunnel = asyncHandler(async (req, res) => {
  const steps = normalizeSteps(req.body.steps);
  const analysis = await saveAnalysisAndBuildPayload(steps);

  res.status(201).json(analysis);
});

export const getAnalysisHistory = asyncHandler(async (_req, res) => {
  const entries = await Analysis.find({}, null, {
    lean: true,
    sort: { createdAt: -1 },
    limit: 20
  });

  res.json({
    items: entries.map((entry) => buildStoredAnalysisPayload(entry))
  });
});

export const deleteAllAnalysisHistory = asyncHandler(async (_req, res) => {
  try {
    console.log('🔥 HIT DELETE ALL ROUTE');
    const result = await Analysis.deleteMany({});
    console.log('✅ Deleted count:', result.deletedCount);

    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount ?? 0
    });
  } catch (error) {
    console.error('❌ DELETE ALL ERROR:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export const deleteAnalysisById = asyncHandler(async (req, res) => {
  try {
    console.log('🔥 HIT DELETE ONE ROUTE:', req.params.id);
    const id = req.params.id;
    const deleted = await Analysis.findByIdAndDelete(id);
    console.log('Delete result:', deleted);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error('❌ DELETE ONE ERROR:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export const compareAnalysis = asyncHandler(async (req, res) => {
  const currentSteps = normalizeSteps(req.body.currentSteps);
  const previousId = typeof req.body.previousId === 'string' ? req.body.previousId.trim() : '';

  if (!previousId) {
    throw new HttpError(400, 'previousId is required to compare analyses.');
  }

  const previousAnalysis = await Analysis.findById(previousId).lean();

  if (!previousAnalysis) {
    throw new HttpError(404, 'The selected historical analysis could not be found.');
  }

  res.json(buildComparisonPayload({
    currentSteps,
    previousAnalysis
  }));
});
