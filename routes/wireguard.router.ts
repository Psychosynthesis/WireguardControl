import { Router } from 'express';

import { checkInterface } from '@middlewares';
import { getWGStatus, rebootWGinterface } from '@services';

const router = Router({ mergeParams: true });

router.get('/status', getWGStatus);
router.get('/reboot', checkInterface, rebootWGinterface);

export default router;
