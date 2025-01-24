import cookieParser from 'cookie-parser';
import express, { json, urlencoded } from 'express';
import cors from 'cors';
import { stringify } from 'flatted';

import { setSecurityHeaders, verifyClient } from './middlewares/index.js';

import wireguardRouter from './routes/wireguard.router.js';
import interfaceRouter from './routes/interface.router.js';

export const SERVER_PORT = 8877;
export const ALLOWED_ORIGIN = [ // Важно! Слэш в конце не нужен!
  'http://localhost:'+SERVER_PORT,
  'http://127.0.0.1:'+SERVER_PORT,
  'http://10.8.1.1:'+SERVER_PORT
];

const app = express();
app.disable('x-powered-by'); // Remove unnecs header

app.use(cookieParser());
app.use(setSecurityHeaders);

app.use('/', interfaceRouter);
app.use('/api/wireguard', cors({ origin: ALLOWED_ORIGIN, credentials: true }), verifyClient, wireguardRouter);

app.use((err, req, res, next) => {
  if (!res.headersSent) {
    // if (process.env.NODE_ENV === 'production') {
      console.error(`Unhandled error: ${err.message || stringify(err, null, 2)}`);
    // }
    // Устанавливаем статус ошибки, если он еще не был установлен
    res.status(err.status || 500).json({ success: false, message: 'Something went wrong. Try again later' })
  }
})

app.listen(SERVER_PORT, () => {
  console.log(`Wireguard-control ready on http://localhost:${SERVER_PORT}`)
})
