import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// Меняем все переводы строк на одинаковые
export const normalizeLineBreaks = (data) => data.replace(/\r\n/g, '\n');

export const readJSON = (filePath) => {
  try {
    const savedConfig = readFileSync(filePath, 'utf8');
    return JSON.parse(savedConfig);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log("Ошибка: Файл не найден.");
    } else {
      console.error("Произошла ошибка:", err);
    }

    return {};
  }
}

export const saveJSON = (filePath, objToSave) => {
  const json = JSON.stringify(objToSave);
  writeFileSync(filePath, json, 'utf8');
}

export const getNameFromSavedData = (key) => {
  const savedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'));
  const hasSavedData = Object.keys(savedPeers).length > 0;

  // Подставляем в данные имена из сохранёнок
  if (hasSavedData && savedPeers.hasOwnProperty(key)) {
    return savedPeers[key].name || key;
  }

  return '';
}
