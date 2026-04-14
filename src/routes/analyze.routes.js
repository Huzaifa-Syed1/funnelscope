import { Router } from 'express';

import { analyzeFunnel } from '../controllers/analysis.controller.js';

const router = Router();

router.post('/', analyzeFunnel);

export default router;
