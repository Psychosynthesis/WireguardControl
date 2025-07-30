import { Request, Response, NextFunction } from 'express';

import { ifaceCorrect } from '@utils';

export const checkInterface = (req: Request, res: Response, next: NextFunction) => {
  const ifacePOST = req.body?.iface;
  const ifaceGET = req.query?.iface;

  if (!ifaceCorrect(ifacePOST) && !ifaceCorrect(ifaceGET)) {
    return res.status(422).json({ success: false, errors: 'Incorrect interface!' });
  } else {
    return next();
  }
};
