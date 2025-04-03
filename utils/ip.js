import path from 'path';
import { isExistAndNotNull } from 'vanicom';

import { getIfaceParams, readJSON } from './index.js';

export const isValidSubnetMask = mask => {
  const regex = /^((255|254|252|248|240|224|192|128|0)\.){3}(255|254|252|248|240|224|192|128|0)$/;
  if (!regex.test(mask)) {
    return false;
  }

  // Проверяем, что маска непрерывная
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

export const getInterfacePeersIPs = iface => {
  const ifaceParams = getIfaceParams(iface);
  if (!ifaceParams.success) {
    return res.status(400).json(ifaceParams);
  }
  const { peers: peersData, ip: serverIP } = ifaceParams.data;

  let parsedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
  let allBusyIPs = [];

  peersData.map(peerKey => {
    if (isExistAndNotNull(parsedPeers[peerKey])) {
      const ipsList = parsedPeers[peerKey].ip.split(','); // В конфиге IPшники могут храниться в формате списка:  '10.8.1.2/32, 0.0.0.0/0',
      let checkedIP = [];

      if (ipsList.length === 1) {
        // Если указан всего один айпишник
        checkedIP.push(ipsList[0].trim().split('/').shift()); // Удаляем маску и пробелы
      } else {
        ipsList.forEach(rawIP => {
          let tempIP = rawIP.trim().split('/').shift(); // Удаляем маску и пробелы
          if (allBusyIPs.includes(tempIP)) {
            console.error('Interface ', iface, ' has a possible conflict of IP: ', tempIP);
          } else {
            checkedIP.push(tempIP);
          }
        });
      }
      allBusyIPs = allBusyIPs.concat(checkedIP);
    }
  });

  allBusyIPs.push(serverIP); // Собственный IP сервера тоже занят

  return allBusyIPs.filter(busyIP => busyIP !== '0.0.0.0'); // Удаляем пиры для которых разрешены любые IP
};

export const getFirstAvailableIP = (occupiedIPs, cidr) => {
  // Преобразуем занятые IP-адреса в числовой формат
  const occupied = occupiedIPs
    .map(ip => {
      const parts = ip.split('.').map(Number);
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    })
    .sort((a, b) => a - b);

  // Определяем диапазон IP-адресов в подсети
  const networkIP = occupied[0] & (~0 << (32 - cidr)); // Первый IP в подсети
  const broadcastIP = networkIP | (~0 >>> cidr); // Последний IP в подсети

  // Ищем первый свободный IP
  for (let i = networkIP + 1; i < broadcastIP; i++) {
    if (!occupied.includes(i)) {
      // Преобразуем числовой IP обратно в строку
      return [(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff].join('.');
    }
  }

  return null; // Если свободных IP нет
};
