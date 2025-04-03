import express, { Router } from 'express';

const router = Router({ mergeParams: true });

router.use('/', express.static('./public/'));
router.use('/assets', express.static('./public/assets'));

export default router;
