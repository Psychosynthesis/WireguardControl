import cookieParser from 'cookie-parser';
import express, { json, urlencoded } from 'express';
import cors from 'cors';
import path from 'path';
import { stringify } from 'flatted';

import { setSecurityHeaders, verifyClient } from './middlewares/index.js';
import { readJSON, loadServerConfig } from './utils/index.js';

import configRouter from './routes/config.router.js';
import wireguardRouter from './routes/wireguard.router.js';
import interfaceRouter from './routes/interface.router.js';

const savedSettings = readJSON(path.resolve(process.cwd(), './config.json'));
const { serverPort, allowedOrigins } = savedSettings;
// Важно! Слэш в конце адреса в allowedOrigins не нужен!

loadServerConfig();

const app = express();
app.disable('x-powered-by'); // Remove unnecs header

app.use(cookieParser());
app.use(setSecurityHeaders);

app.use('/', interfaceRouter);
app.use('/api/config', cors({ origin: allowedOrigins, credentials: true }), verifyClient, configRouter);
app.use('/api/wireguard', cors({ origin: allowedOrigins, credentials: true }), verifyClient, wireguardRouter);

app.use((err, req, res, next) => {
  if (!res.headersSent) {
    // if (process.env.NODE_ENV === 'production') {
      console.error(`Unhandled error: ${err.message || stringify(err, null, 2)}`);
    // }
    // Устанавливаем статус ошибки, если он еще не был установлен
    res.status(err.status || 500).json({ success: false, message: 'Something went wrong. Try again later' })
  }
})

app.listen(serverPort, () => {
  console.log(`Wireguard-control ready on http://localhost:${serverPort}`)
})
