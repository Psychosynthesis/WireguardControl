import fs from 'fs';

import { getNameFromSavedData, normalizeLineBreaks } from './index.js';

declare type ConfigSectionsLines = {
  interface: Object;
  peers: any[];
};

// Парсим статус из вывода консоли
export const parseStatus = (rawStatus: string) => {
  let parsedStatus: ConfigSectionsLines = { interface: {}, peers: [] };

  const sections = rawStatus.split(/(?:\s*(interface|peer)\s*:)/gi).filter(line => line);
  for (let i = 0; i < sections.length; i += 2) {
    if (typeof sections[i + 1] === 'undefined') continue;
    const sectionName = sections[i].trim().toLowerCase();
    const sectionContent = normalizeLineBreaks(sections[i + 1].trim()).split(/\n/);
    let parsedSection: { [key: string]: any } = { name: '' };
    sectionContent.forEach((item: string, i: number) => {
      if (i === 0) {
        parsedSection.name = item; // У peer первая строка это ключ, у интерфейса это имя файла .conf
      } else {
        parsedSection[item.split(':')[0].trim()] = item.slice(item.indexOf(':') + 1).trim();
      }
    });

    if (sectionName === 'peer') {
      parsedSection['public key'] = parsedSection.name;
      parsedSection.name = getNameFromSavedData(parsedSection.name);
      parsedStatus.peers.push(parsedSection);
    } else {
      // @ts-ignore
      parsedStatus[sectionName] = parsedSection;
    }
  }

  return parsedStatus;
};

// Разбиваем конфиг по секциям
export const splitBySections = (content: string) => {
  const result: ConfigSectionsLines & { [key: string]: any } = { interface: {}, peers: [] };
  if (typeof content !== 'string' || !content.length) {
    return result;
  }
  const sections = content.split(/\[(.+?)\]/g);
  for (let i = 1; i < sections.length; i += 2) {
    // Перебор начинается с 1 потому что первым элементом в названии секции всегда будет '['
    const sectionName = sections[i].trim().toLowerCase();
    const sectionContent = normalizeLineBreaks(sections[i + 1].trim());
    if (sectionName === 'peer') {
      result.peers.push(sectionContent);
    } else {
      // Здесь реализация такова, чтобы поддерживать возможные секции кроме [Interface]
      // В идеале дописать и уточнить, возможно объединить с parseInterfaceConfig
      result[sectionName] = sectionContent;
    }
  }
  return result;
};

// Парсинг линии конфига
const parseLine = (line: string) => {
  const trimmedLine = line.trim();
  if (!trimmedLine.startsWith('#') && !trimmedLine.startsWith(';')) {
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      return { [key]: value };
    }
  }
};

// Парсинг конфига указанного интерфейса
export const parseInterfaceConfig = (iface: string) => {
  if (!iface || typeof iface !== 'string') {
    throw new Error('Interface must be a string!');
  }

  const interfacePath = `/etc/wireguard/${iface}.conf`;

  // Проверка существования файла
  if (!fs.existsSync(interfacePath)) {
    throw new Error('Incorrect interface!');
  }

  console.log('Try to parse interface ' + interfacePath);

  try {
    // Синхронное чтение файла
    const data = fs.readFileSync(interfacePath, 'utf8');
    const splittedData = splitBySections(data);
    const configObject: ConfigSectionsLines = { interface: {}, peers: [] };

    // Обработка всех секций
    for (const section in splittedData) {
      const sectionName = section.toLowerCase();
      switch (sectionName) {
        case 'peers':
          // Обработка пиров
          configObject.peers = splittedData[section].map((peerData: string) => {
            const peer: any = {};
            peerData.split('\n').forEach(line => {
              Object.assign(peer, parseLine(line));
            });
            peer.name = getNameFromSavedData(peer.PublicKey);
            return peer;
          });
          break;

        case 'interface':
          // Обработка остальных секций
          splittedData[section].split('\n').forEach((line: string) => {
            // @ts-ignore (код далее должен работать для любых кастомных секций, но лень типизировать)
            configObject[section] = { ...configObject[section], ...parseLine(line) };
          });
      }
    }

    return configObject;
  } catch (error: any) {
    throw new Error(`Failed to parse config file: ${error.message}`);
  }
};
