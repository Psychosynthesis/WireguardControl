import crypto from 'crypto';

import { getFrontendConfig } from './index.js';

const pack = buffer => Buffer.from(buffer).toString('base64'); // Из буфера в base64
const unpack = packed => Buffer.from(packed, 'base64'); // Из base64 в буфер
const generateKey = () => crypto.randomBytes(16); // 128-битный ключ

// Функция шифрования
const encrypt = (data, key, iv) => {
  const cipher = crypto.createCipheriv('aes-128-ctr', key, iv);
  const bufFromData = Buffer.from(data, 'utf8');
  let encrypted = Buffer.concat([cipher.update(bufFromData), cipher.final()]);
  return encrypted; // Возвращает Buffer
};

// Функция расшифровки
const decrypt = (encryptedData, key, iv) => {
  const decipher = crypto.createDecipheriv('aes-128-ctr', key, iv);
  let decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8'); // Возвращает строку
};

export const encryptMsg = async msg => {
  const iv = generateKey();
  const stringToCrypt = typeof msg === 'string' ? msg : JSON.stringify(msg);
  const { frontendPasskey } = getFrontendConfig();
  const encryptedData = await encrypt(stringToCrypt, unpack(frontendPasskey), iv);
  return {
    data: pack(encryptedData), // Данные в base64
    v: pack(iv),
  };
};

export const decryptMsg = msg => {
  const { data, v } = msg;
  const { frontendPasskey } = getFrontendConfig();
  return decrypt(unpack(data), unpack(frontendPasskey), unpack(v));
};
