import { Router, json } from 'express';

import { verifyClient } from '../middlewares/index.js';
import { addNewClient, getInterfaceConfig, getInterfaces } from '../services/config.services.js';

const router = Router({ mergeParams: true });

const jsonParser = json({ limit: "10mb" });

router.get('/', getInterfaceConfig); // Получить конфиг конкретного интерфейса (config?iface=wg)
router.get('/interfaces', getInterfaces);
router.post('/client/add', jsonParser, addNewClient);

export default router
