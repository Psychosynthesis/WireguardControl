import { Router, json } from 'express';

import { verifyClient } from '../middlewares/index.js';
import { addNewClient, getInterfaceConfig, getInterfaces, getFirstFreeIP } from '../services/config.services.js';

const router = Router({ mergeParams: true });

const jsonParser = json({ limit: '10mb' });

// Получить конфиг конкретного интерфейса (api/config?iface=wg)
router.get('/', getInterfaceConfig);
// Проверяются только загруженные в память конфиги! Для проверки сохранённых написать отдельный метод.
router.get('/interfaces', getInterfaces);
router.get('/freeIP', getFirstFreeIP); // Получаем первый свободный IP для интерфейса
router.post('/client/add', jsonParser, addNewClient);

export default router;
