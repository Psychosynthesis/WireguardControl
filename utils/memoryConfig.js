import path from 'path';
import { isExistAndNotNull } from 'vanicom';

import {
  getStatusFromBash, getAllConfigs, readJSON, saveJSON, COLORS, genPubKey, getServerIP, parseInterfaceConfig
} from './index.js';

export const loadServerConfig = async () => {
  let serverSettings = readJSON(path.resolve(process.cwd(), './config.json'));
  let savedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
  const savedInterfaces = readJSON(path.resolve(process.cwd(), './.data/interfaces.json'), true);

  const interfacesCount = Object.keys(savedInterfaces).length;
  const allConfiguredInterfaces = await getAllConfigs();
  const externalIP = await getServerIP();
  const wgStatus = await getStatusFromBash();
  const { allowedOrigins, defaultInterface } = serverSettings;
  let allActivePeers = []; // Для проверки все ли сохранённые клиенты есть в конфигах

  let configInMemory = {
    wgIsWorking: wgStatus.success,
    configIsOk: true,
    endpoint: externalIP,
    defaultInterface: '',
    interfaces: {},
  };

  if (allConfiguredInterfaces.success) {
    for (let i=0; i < allConfiguredInterfaces.data.length; i++) {
      const confFile = allConfiguredInterfaces.data[i];
      try { // Обрабатываем конфиг интерфейса
        const { interface: currentInterface, peers } = await parseInterfaceConfig(confFile);
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
        const configAdress = currentInterface.Address.trim().split('/');
        const serverIP = configAdress.shift(); // Убираем CIDR
        const serverCIDR = (configAdress.length > 1) ? configAdress[1] : '24'; // Размер подсети
        configInMemory.interfaces[confFile] = { // В .data/interfaces.json данные хранятся в этом же формате
          ip: serverIP,
          cidr: serverCIDR,
          port: currentInterface.ListenPort,
          pubkey,
          peers: interfacePeers
        }
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

  if (interfacesCount === 0 && !wgStatus.success) {
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

  configInMemory.wgIsWorking = wgStatus.success;

  console.log(COLORS.Cyan, ' ');
  console.log(COLORS.Cyan, 'Config loaded in memory: ', configInMemory);
  console.log(COLORS.Reset, ' ');

  global.wgControlServerSettings = { ...configInMemory }
}

export const getActiveInterfaceses = () => {
  return Object.keys(global.wgControlServerSettings.interfaces);
}

export const getDefaultInterface = () => {
  return global.wgControlServerSettings.defaultInterface;
}

export const checkInterface = (iface) => {
  const activeInterfacesList = getActiveInterfaceses();
  return (isExistAndNotNull(iface) && activeInterfacesList.includes(iface))
}

export const getIfaceParams = (iface) => {
  if (checkInterface(iface)) {
    return { success: false, errors: 'Incorrect interface!' };
  }

  return { success: true, data: { ...global.wgControlServerSettings.interfaces[iface] } }
}

export const setWGStatus = (status) => {
  global.wgControlServerSettings.wgIsWorking = status;
}
