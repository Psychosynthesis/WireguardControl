import fs from 'fs';
import path from 'path';
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

// Дописываем в конец конфига
export const appendDataToConfig = async (filePath, data) => {
  const stringToAppend = '\n' + data + '\n';
  try {
    await fs.appendFileSync(filePath, stringToAppend, 'utf-8');
  } catch (error) {
    console.error(`Error on appendDataToConfig to file: "${filePath}":`, error);
    throw error;
  }
}

// Вывод объекта в формате секции файла .conf, без проверок
export const formatObjectToConfigSection = (sectionName, configObject) => {
  if (!sectionName || !Object.keys(configObject).length) {
    console.log('Incorrect data for formatObjectToConfigSection: ', sectionName, configObject);
  }

  let output = `[${sectionName}]\n `;
  Object.entries(configObject).forEach(([key, value]) => { output += `${key} = ${value}\n `; });
  output += '\n ';
  return output;
}

export const formatConfigToString = (configObject) => {
  // configObject = { Interface: { ... }, Peers: [] or Peer: { ... } }
  let output = '';
  for (let section in configObject) {
    if (section.toLowerCase() === 'peers') {
      configObject[section].map((peer) => {
        if ( // Обязательные свойства у любого пира (и на сервере и на клиенте)
          !peer.hasOwnProperty('PublicKey') || !peer.hasOwnProperty('PresharedKey') || !peer.hasOwnProperty('AllowedIPs')
        ) {
          console.log('Incorrect peer in configObject: ', peer);
          return;
        }
        output += formatObjectToConfigSection('Peer', peer);
      });
      continue;
    }
    output += formatObjectToConfigSection(section, configObject[section]);
  }
  return output;
}

export const loadServerConfig = () => {
  const savedSettings = readJSON(path.resolve(process.cwd(), './config.json'));
  const savedInterfaces = readJSON(path.resolve(process.cwd(), './.data/interfaces.json'));
  const { serverPort, allowedOrigins, defaultInterface } = savedSettings;

  global.wgControlServerSettings = { configLoaded: false, interfaces: {} };
  for (let iface in savedInterfaces) {
    global.wgControlServerSettings.interfaces[iface] = { ...savedInterfaces[iface] };
  }

  if (Object.keys(global.wgControlServerSettings.interfaces).length) {
    global.wgControlServerSettings.configLoaded = true;
  }
}
