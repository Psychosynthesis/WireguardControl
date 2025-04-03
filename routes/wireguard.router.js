import { Router, json } from 'express';

import { verifyClient } from '../middlewares/index.js';
import { getWGStatus, rebootWG } from '../services/wireguard.services.js';

const router = Router({ mergeParams: true });

router.get('/status', getWGStatus);
router.get('/reboot', rebootWG);

export default router;
