import fs from 'fs';
import { getNameFromSavedData, readJSON, normalizeLineBreaks } from './tools.js';

// Разбиваем конфиг по секциям
export const splitBySections = (content) => {
  const result = { peers: [] };
  if (typeof(content) !== 'string' || !content.length) { return result; }
  const sections = content.split(/\[(.+?)\]/g);
  for (let i = 1; i < sections.length; i += 2) { // Перебор начинается с 1 потому что первым элементом будет '['
    const sectionName = sections[i].trim().toLowerCase();
    const sectionContent = normalizeLineBreaks(sections[i + 1].trim());
    if (sectionName === 'peer') {
      result.peers.push(sectionContent);
    } else {
      result[sectionName] = sectionContent;
    }
  }
  return result;
}

// Парсинг линии конфига
const parseLine = (line) => {
  const trimmedLine = line.trim();
  if (!trimmedLine.startsWith('#') && !trimmedLine.startsWith(';')) {
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      return { [key]: value }
    }
  }
};

export const parseWGConfig = (filePath) => {
  return new Promise((resolve, reject) => {
    if (typeof filePath !== 'string') {
      reject(new Error('filePath must be a string'));
      return;
    }

    try {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const splittedData = splitBySections(data); // Разбиваем конфиг по сециям
        const configObject = { peers: Array(splittedData.peers.length) };

        for (let section in splittedData) { // Парсим секции
          if (section.toLowerCase() === 'peers') {
            splittedData.peers.forEach((item, i) => {
              // Парсим данные по каждому пиру
              item.split('\n').forEach(line => {
                configObject.peers[i] = { ...configObject.peers[i], ...parseLine(line) }
              });

              configObject.peers[i].name = getNameFromSavedData(configObject.peers[i].PublicKey);
            });
          } else {
            splittedData[section].split('\n').forEach(line => {
              configObject[section] = { ...configObject[section], ...parseLine(line) }
            });
          }
        }

        resolve(configObject);
      });

    } catch (error) {
      reject(new Error(`Failed to parse config file: ${error.message}`));
    }
  });
};

// Получаем список интерфейсов (все файлы .conf)
export const getConfFiles = (directoryPath) => {
  return new Promise((resolve, reject) => {
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        reject(err);
      } else {
        const confFiles = [];
        files.map(file => {
          file.endsWith('.conf') && confFiles.push(file.replace(/\.[^.]*$/, ''));
        });
        resolve(confFiles);
      }
    });
  });
}

// Дописываем конфиг
export const appendDataToConfig = async (filePath, data) => {
  const stringToAppend = '\n' + data + '\n';
  try {
    await fs.appendFileSync(filePath, stringToAppend, 'utf-8');
    console.log(`Строка успешно добавлена в файл "${filePath}"`);
  } catch (error) {
    console.error(`Ошибка при добавлении строки в файл "${filePath}":`, error);
    throw error;
  }
}
