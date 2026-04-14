import { Router } from 'express';

import { listAnalyses } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/', listAnalyses);

export default router;
