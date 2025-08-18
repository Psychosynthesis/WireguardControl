import path from 'path';
import { readJSON } from 'boma';
import { isExistAndNotNull } from 'vanicom';
import { getIfaceParams } from './index.js';

// Типы данных
type Peer = {
  name: string;
  active: boolean;
  ip: string;
  PresharedKey?: string;
};

type PeersData = Record<string, Peer>;

export const isValidSubnetMask = (mask: string): boolean => {
  const regex = /^((255|254|252|248|240|224|192|128|0)\.){3}(255|254|252|248|240|224|192|128|0)$/;
  if (!regex.test(mask)) {
    return false;
  }

  const parts = mask.split('.').map(Number);
  let foundZero = false;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 0) {
      foundZero = true;
    } else if (foundZero && parts[i] !== 0) {
      return false; // После 0 не должно быть других чисел
    }
  }

  return true;
};

export const getInterfacePeersIPs = (iface: string): string[] => {
  const ifaceParams: AppResult = getIfaceParams(iface) as AppResult;
  if (!ifaceParams.success) {
    throw new Error(`Ошибка получения параметров интерфейса: ${ifaceParams.error}`);
  }

  const { peers: peersData, ip: serverIP } = ifaceParams.data;
  const parsedPeers: PeersData = readJSON({
    filePath: path.resolve(process.cwd(), './.data/peers.json'),
    parseJSON: true,
    createIfNotFound: {},
  });
  const busyIPs = new Set<string>();

  for (const peerKey of peersData) {
    const peer = parsedPeers[peerKey];
    if (!isExistAndNotNull(peer)) continue;

    // В конфиге IPшники могут храниться в формате списка:  '10.8.1.2/32, 0.0.0.0/0',
    const ipsList = peer.ip.split(',').map(ip => ip.trim().split('/')[0]); // Разбиваем в массив, удаляем маску и пробелы

    for (const rawIP of ipsList) {
      const cleanedIP = rawIP.trim();
      if (cleanedIP === '0.0.0.0') continue; // Удаляем пиры для которых разрешены любые IP

      if (busyIPs.has(cleanedIP)) {
        console.error(`Interface ${iface} has a possible conflict of IP: ${cleanedIP}`);
      }
      busyIPs.add(cleanedIP);
    }
  }

  busyIPs.add(serverIP);
  return Array.from(busyIPs);
};

export const getFirstAvailableIP = (occupiedIPs: string[], cidr: number): string | null => {
  // Конвертируем IP в числовой формат и фильтруем только валидные
  const occupiedNumbers = occupiedIPs
    .map(ip => {
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) return null;
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    })
    .filter((ip): ip is number => ip !== null)
    .sort((a, b) => a - b);

  // Определяем диапазон IP-адресов в подсети (границы сети)
  const networkIP = occupiedNumbers[0] & (~0 << (32 - cidr));
  const broadcastIP = networkIP | (~0 >>> cidr);
  const occupiedSet = new Set(occupiedNumbers);

  // Ищем первый свободный IP
  for (let ipNum = networkIP + 1; ipNum < broadcastIP; ipNum++) {
    if (!occupiedSet.has(ipNum)) {
      return [
        // Преобразуем числовой IP обратно в строку
        (ipNum >>> 24) & 0xff,
        (ipNum >>> 16) & 0xff,
        (ipNum >>> 8) & 0xff,
        ipNum & 0xff,
      ].join('.');
    }
  }

  return null; // Если свободных IP нет
};
