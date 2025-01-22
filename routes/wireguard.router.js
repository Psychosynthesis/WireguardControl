import { Router, json } from 'express';

import { verifyClient } from '../middlewares/index.js';
import { getWGStatus, getConfig, getInterfaces, rebootWG } from '../services/wireguard.services.js';

const router = Router({ mergeParams: true });

const jsonParser = json({ limit: "10mb" });

router.get('/status', getWGStatus);
router.get('/reboot', rebootWG);
router.get('/config', getConfig);
router.get('/interfaces', getInterfaces);

export default router
