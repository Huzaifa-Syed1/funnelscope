import { Router } from 'express';

import {
  compareAnalysis,
  deleteAllAnalysisHistory,
  deleteAnalysisById,
  getAnalysisHistory
} from '../controllers/analysis.controller.js';

const router = Router();

router.get('/history', getAnalysisHistory);
router.delete('/history', deleteAllAnalysisHistory);
router.post('/compare', compareAnalysis);
router.delete('/:id', deleteAnalysisById);

export default router;
