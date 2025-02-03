import fs from 'fs';
import path from 'path';
import { isExistAndNotNull } from 'vanicom';

import { getStatusFromBash, getNameFromSavedData, normalizeLineBreaks, readJSON, saveJSON } from './tools.js';
import { COLORS, genPubKey, getServerIP } from './exec.js';

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


// Получаем список интерфейсов (все файлы .conf)
export const getAllConfigs = async () => {
  const allConfFiles = await new Promise((resolve, reject) => {
    fs.readdir('/etc/wireguard', (err, files) => {
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

  if (!Array.isArray(allConfFiles)) {
    console.error('getAllConfigs error when getting the configs files: ', allConfFiles)
    return { success: false, errors: 'Error when get configs' };
  } else if (!allConfFiles.length) {
    return { success: false, errors: 'Seems like Wireguard is not configured yet (no .conf files in /etc/wireguard)' };
  }

  return { success: true, data: allConfFiles };
}

export const loadServerConfig = async () => {
  let serverSettings = readJSON(path.resolve(process.cwd(), './config.json'));
  let savedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
  const savedInterfaces = readJSON(path.resolve(process.cwd(), './.data/interfaces.json'), true);

  const interfacesCount = Object.keys(savedInterfaces).length;
  const allConfiguredInterfaces = await getAllConfigs();
  const externalIP = await getServerIP();
  const status = await getStatusFromBash();
  const { allowedOrigins, defaultInterface } = serverSettings;
  let allActivePeers = []; // Для проверки все ли сохранённые клиенты есть в конфигах

  let configInMemory = {
    wgIsWorking: status.success,
    configIsOk: true,
    endpoint: externalIP,
    defaultInterface: '',
    interfaces: {},
  };

  if (allConfiguredInterfaces.success) {
    for (let i=0; i < allConfiguredInterfaces.data.length; i++) {
      const confFile = allConfiguredInterfaces.data[i];
      try { // Обрабатываем конфиг интерфейса
        const { interface: currentInterface, peers } = await parseWGConfig(`/etc/wireguard/${confFile}.conf`);
        const pubkey = await genPubKey(currentInterface.PrivateKey);

        const interfacePeers = []; // Все активные клиенты интерфейса

        // Актуализируем данные по сохранённым пирам из конфига интерфейса на случай
        // если конфиг менялся при перезагрузке WireguardControl
        peers.map(peer => {
          interfacePeers.push(peer.PublicKey);
          savedPeers = {
            ...savedPeers,
            [peer.PublicKey]: {
              name: isExistAndNotNull(savedPeers[peer.PublicKey].name) ? savedPeers[peer.PublicKey].name : '',
              active: true,
              ip: peer.AllowedIPs,
              PresharedKey: peer.presharedKey
            }
          }
        });

        // Здесь сохраняем в память все параметры интерфейсов к которым хотим иметь доступ
        // В .data/interfaces.json они хранятся в этом же формате
        configInMemory.interfaces[confFile] = { pubkey, port: currentInterface.ListenPort, peers: interfacePeers }
        allActivePeers = [...allActivePeers, ...interfacePeers] // Добавляем в список активных пиры интерфейса из конфига

        // Указываем дефолтный интерфейс
        if (isExistAndNotNull(defaultInterface) && (confFile === defaultInterface)) {
          configInMemory.defaultInterface = confFile;
        }
      } catch (err) {
        console.error(`loadServerConfig fail on parse .conf file ${confFile}.conf: `, err)
      }
    }

    // Перебираем все сохранённые пиры
    Object.keys(savedPeers).map(peerKey => {
      if (!allActivePeers.includes(peerKey)) savedPeers[peerKey].active = false;
    })

    saveJSON(path.resolve(process.cwd(), './.data/peers.json'), savedPeers); // Сохраняем данные о пирах
  }

  const correctParsedIfaces = Object.keys(configInMemory.interfaces);

  if (interfacesCount === 0 && !status.success) {
    configInMemory.configIsOk = false;
    console.error('No saved settings are found and WG is off.');
  }

  if (!correctParsedIfaces.length) {
    configInMemory.configIsOk = false;
    console.error('No .conf files correct parsed from /etc/wireguard');
  } else if ( // Есть корректные конфиги, но дефолтный интерфейс не корректен
    !isExistAndNotNull(defaultInterface) || !correctParsedIfaces.includes(defaultInterface)
  ) {
    const newDefaultInt = configInMemory.interfaces[correctParsedIfaces[0]];
    serverSettings.defaultInterface = newDefaultInt;
    saveJSON(path.resolve(process.cwd(), './config.json'), serverSettings);
    console.log('defaultInterface from ./config.json missing or incorrect, set new: ', newDefaultInt);
  }

  console.log(COLORS.Reset, ' ');
  console.log(COLORS.Cyan, 'Config loaded in memory: ', configInMemory);
  console.log(COLORS.Reset, ' ');

  global.wgControlServerSettings = { ...configInMemory }
}
