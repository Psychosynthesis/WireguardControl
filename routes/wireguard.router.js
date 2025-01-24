import { Router, json } from 'express';

import { verifyClient } from '../middlewares/index.js';
import { addNewClient, getWGStatus, getInterfaceConfig, getInterfaces, rebootWG } from '../services/wireguard.services.js';

const router = Router({ mergeParams: true });

const jsonParser = json({ limit: "10mb" });

router.get('/status', getWGStatus);
router.get('/reboot', rebootWG);
router.get('/config', getInterfaceConfig); // Получить конфиг конкретного интерфейса (config?iface=wg)
router.get('/interfaces', getInterfaces);

router.post('/client/add', jsonParser, addNewClient);

export default router
