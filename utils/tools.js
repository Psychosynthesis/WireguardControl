import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

import { executeSingleCommand, parseStatus } from './index.js';

// Меняем все переводы строк на одинаковые
export const normalizeLineBreaks = (data) => data.replace(/\r\n/g, '\n');

export const readJSON = (filePath, createIfNotFound = false) => {
  try {
    const savedConfig = readFileSync(filePath, 'utf8');
    return JSON.parse(savedConfig);
  } catch (err) {
    if (err.code === 'ENOENT') {
      if (createIfNotFound) {
        console.log("Try to create: ", filePath);
        try {
          writeFileSync(filePath, '{}', 'utf8');
        } catch (writeErr) {
          console.error(`Error on create file ${filePath}: `, writeErr);
        }
      } else {
        console.log("File not found: ", filePath);
      }
    } else {
      console.error("Function readJSON get error:", err);
    }

    return {};
  }
}

export const saveJSON = (filePath, objToSave) => {
  const json = JSON.stringify(objToSave);
  writeFileSync(filePath, json, 'utf8');
}

export const getNameFromSavedData = (key) => {
  const savedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
  const hasSavedData = Object.keys(savedPeers).length > 0;

  // Подставляем в данные имена из сохранёнок
  if (hasSavedData && savedPeers.hasOwnProperty(key)) {
    return savedPeers[key].name || key;
  }

  return '';
}

export const getStatusFromBash = async () => {
  const rawStatus = await executeSingleCommand('wg');
  if (rawStatus.includes('not found, but')) {
    return { success: false, errors: 'Seems like Wireguard does not installed on server' };
  } else if (rawStatus === '') {
    return { success: false, errors: 'Wireguard is disabled', };
  }
  const parsedStatus = parseStatus(rawStatus);
  return {
    success: true,
    data: { ...parsedStatus }
  }
}
