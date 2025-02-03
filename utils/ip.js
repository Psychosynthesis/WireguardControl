import fs from 'fs';
import path from 'path';
import { isExistAndNotNull } from 'vanicom';
import { readJSON } from './tools.js';

export const isValidSubnetMask = (mask) => {
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
}

export const getAllInterfacePeersIPs = (iface) => {
  const activeInterfacesList = Object.keys(global.wgControlServerSettings.interfaces);
  if (!iface || !activeInterfacesList.includes(iface)) {
    console.error('Incorrect interface for getAllInterfacePeersIPs: ', iface);
    return [];
  }

  let parsedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
  let allBusyIPs = [];
  global.wgControlServerSettings.interfaces[iface].peers.map(peerKey => {
    if (isExistAndNotNull(parsedPeers[peerKey])) {
      const ipsList = parsedPeers[peerKey].ip.split(','); // В конфиге IPшники могут храниться в формате списка:  '10.8.1.2/32, 0.0.0.0/0',
      let checkedIP = [];

      if (ipsList.length === 1) { // Если указан всего один айпишник
        checkedIP.push(ipsList[0].trim().split('/').shift()); // Удаляем маску и пробелы
      } else {
        ipsList.forEach(rawIP => {
          let tempIP = rawIP.trim().split('/').shift(); // Удаляем маску и пробелы
          if (allBusyIPs.includes(tempIP)) {
            console.error('Interface ', iface, ' has a possible conflict of IP: ', tempIP)
          } else {
            checkedIP.push(tempIP);
          }
        })
      }
      allBusyIPs = allBusyIPs.concat(checkedIP);
    }
  })

  return allBusyIPs.filter(busyIP => busyIP !== '0.0.0.0'); // Удаляем пиры для которых разрешены любые IP
}
