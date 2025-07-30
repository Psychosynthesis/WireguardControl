import fs from 'fs';
import path from 'path';
import { isExistAndNotNull } from 'vanicom';

import { getStatusFromBash, getAllConfigs, readJSON, saveJSON, COLORS, genPubKey, getServerIP, parseInterfaceConfig } from './index.js';

const loadFrontendConfig = () => {
  // Хелпер для загрузки конфига сервера веб-морды
  const configPath = path.resolve(process.cwd(), './config.json');
  const exampleConfigPath = path.resolve(process.cwd(), 'config.example.json');
  if (!fs.existsSync(configPath)) {
    // Конфига нет
    console.log('config.json not found');
    if (fs.existsSync(exampleConfigPath)) {
      // Пытаемся читать дефолтный
      fs.renameSync(exampleConfigPath, configPath);
      console.log('config.example.json renamed in config.json');
    } else {
      console.log(COLORS.Red, ' ');
      console.error(`No one config files found! Create a config.json file in the project root with the next params: {
  "defaultInterface": (string),
  "frontServerPort": (number),
  "allowedOrigins": [string, string]
}`);
      console.log(COLORS.Reset, ' ');
      throw new Error('Config files not found');
    }
  }

  const config = readJSON(configPath, true);
  return config;
};

export const loadServerConfig = async () => {
  let frontendSettings = await loadFrontendConfig(); // Вывалится с ошибкой, если никакого конфига не будет найдено
  let savedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
  const savedInterfaces = readJSON(path.resolve(process.cwd(), './.data/interfaces.json'), true);

  const interfacesCount = Object.keys(savedInterfaces).length;
  const allConfiguredInterfaces = await getAllConfigs();
  const externalIP = await getServerIP();
  const wgStatus = await getStatusFromBash();

  const { allowedOrigins, defaultInterface, frontServerPort, frontendPasskey } = frontendSettings;
  // Важно! Слэш в конце адреса в allowedOrigins не нужен!

  let configInMemory = {
    allowedOrigins, // Нужно для конфигурации веб-морды
    frontServerPort,
    frontendPasskey,
    wgIsWorking: wgStatus.success,
    configIsOk: true,
    endpoint: externalIP,
    defaultInterface: '',
    interfaces: {},
  };

  let allActivePeers = []; // Для проверки все ли сохранённые клиенты есть в конфигах

  if (allConfiguredInterfaces.success) {
    for (let i = 0; i < allConfiguredInterfaces.data.length; i++) {
      const confFile = allConfiguredInterfaces.data[i];
      try {
        // Обрабатываем конфиг интерфейса
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
              name: savedPeers[peer.PublicKey]?.name ? savedPeers[peer.PublicKey].name : '',
              active: true,
              ip: peer.AllowedIPs,
              PresharedKey: peer.presharedKey,
            },
          };
        });

        // Здесь сохраняем в память все параметры интерфейсов к которым хотим иметь доступ
        const configAdress = currentInterface.Address.trim().split('/');
        const serverIP = configAdress.shift(); // Убираем CIDR
        const serverCIDR = configAdress.length > 1 ? configAdress[1] : '24'; // Размер подсети
        configInMemory.interfaces[confFile] = {
          // В .data/interfaces.json данные хранятся в этом же формате
          ip: serverIP, // Внутренний адрес сервера внутри VPN из конфига currentInterface (каждый конфиг это файл .conf)
          cidr: serverCIDR,
          port: currentInterface.ListenPort, // Порт который слушает интерфейс
          pubkey,
          peers: interfacePeers,
        };
        allActivePeers = [...allActivePeers, ...interfacePeers]; // Добавляем в список активных пиры интерфейса из конфига

        // Указываем дефолтный интерфейс
        if (isExistAndNotNull(defaultInterface) && confFile === defaultInterface) {
          configInMemory.defaultInterface = confFile;
        }
      } catch (err) {
        console.error(`loadServerConfig fail on parse .conf file ${confFile}.conf: `, err);
      }
    }

    // Перебираем все сохранённые пиры
    Object.keys(savedPeers).map(peerKey => {
      if (!allActivePeers.includes(peerKey)) savedPeers[peerKey].active = false;
    });

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
  } else if (
    // Есть корректные конфиги, но дефолтный интерфейс не корректен
    !isExistAndNotNull(defaultInterface) ||
    !correctParsedIfaces.includes(defaultInterface)
  ) {
    const newDefaultInt = configInMemory.interfaces[correctParsedIfaces[0]];
    frontendSettings.defaultInterface = newDefaultInt;

    saveJSON(path.resolve(process.cwd(), './config.json'), frontendSettings);
    console.log('defaultInterface from ./config.json missing or incorrect, set new: ', newDefaultInt);
  }

  configInMemory.wgIsWorking = wgStatus.success;

  console.log('\n', COLORS.Cyan, 'Config loaded in memory: ', configInMemory, '\n', COLORS.Reset);

  global.wgControlServerSettings = { ...configInMemory };
};

export const getActiveInterfaceses = () => {
  return Object.keys(global.wgControlServerSettings.interfaces);
};

export const getDefaultInterface = () => {
  return global.wgControlServerSettings.defaultInterface;
};

export const getFrontendConfig = () => {
  return {
    allowedOrigins: global.wgControlServerSettings.allowedOrigins,
    frontServerPort: global.wgControlServerSettings.frontServerPort,
    frontendPasskey: global.wgControlServerSettings.frontendPasskey,
  };
};

export const ifaceCorrect = iface => {
  const activeInterfacesList = getActiveInterfaceses();
  return isExistAndNotNull(iface) && activeInterfacesList.includes(iface);
};

export const getIfaceParams = iface => {
  if (!ifaceCorrect(iface)) {
    return { success: false, errors: 'Incorrect interface!' };
  }

  return { success: true, data: { ...global.wgControlServerSettings.interfaces[iface] } };
};

export const getCurrentEndpoint = () => {
  // Получение текущего внешнего IP сервера на котором запущены
  return global.wgControlServerSettings.endpoint;
};

export const setWGStatus = status => {
  global.wgControlServerSettings.wgIsWorking = status;
};
