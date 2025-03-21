import cookieParser from 'cookie-parser';
import express, { json, urlencoded } from 'express';
import cors from 'cors';
import path from 'path';
import { stringify } from 'flatted';

import { setSecurityHeaders, verifyClient } from './middlewares/index.js';
import { loadServerConfig, getFrontendConfig } from './utils/index.js';

import configRouter from './routes/config.router.js';
import wireguardRouter from './routes/wireguard.router.js';
import frontendRouter from './routes/frontend.router.js';

await loadServerConfig(); // Загружаем конфиги
const { frontServerPort, allowedOrigins } = getFrontendConfig();
// Важно! Слэш в конце адреса в allowedOrigins не нужен!

const app = express();
app.disable('x-powered-by'); // Remove unnecs header

app.use(cookieParser());
app.use(setSecurityHeaders);

app.use('/', frontendRouter);
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

app.listen(frontServerPort, () => {
  console.log(`Wireguard-control ready on http://localhost:${frontServerPort}`)
})
