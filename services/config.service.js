import path from 'path';
import { writeFileSync, readFileSync } from 'fs';
import { Readable } from 'stream';
import { readJSON, saveJSON } from 'boma';
import Crypt from '@gratio/crypt';
import { isExistAndNotNull } from 'vanicom';

import {
  appendDataToConfig,
  getFrontendConfig,
  ifaceCorrect,
  getActiveInterfaceses,
  getDefaultInterface,
  getInterfacePeersIPs,
  getIfaceParams,
  getCurrentEndpoint,
  getFirstAvailableIP,
  genNewClientKeys,
  parseInterfaceConfig,
  formatConfigToString,
  formatObjectToConfigSection,
  transCyrilic,
  removePeerFromConfig
} from '../utils/index.js';

const { encryptMsg } = Crypt.serverCrypt;

const PEERS_PATH = path.resolve(process.cwd(), './.data/peers.json');


// Получить конфиг конкретного интерфейса (api/config?iface=wg)
// Проверяются только загруженные в память конфиги! Для проверки сохранённых написать другой метод.
export const getInterfaceConfig = async (req, res, next) => {
  const iface = req.query.iface;
  try {
    // Парсим конфиг
    let currentConfig = await parseInterfaceConfig(iface);
    currentConfig['interface']['External IP'] = getCurrentEndpoint();
    const { frontendPasskey } = getFrontendConfig();
    const cipher = encryptMsg({ message: currentConfig, pass: frontendPasskey });
    res.status(200).json(cipher);
  } catch (e) {
    console.error('getConfig service error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard config' });
    next(e);
  }
};

// Получаем список доступных интерфейсов
export const getInterfaces = async (req, res, next) => {
  try {
    const activeInterfacesList = getActiveInterfaceses();
    const defaultIface = getDefaultInterface();
    const interfacesListForSelect = activeInterfacesList.map(file => ({ checked: file === defaultIface, value: file }));
    res.status(200).json({
      success: true,
      data: interfacesListForSelect,
    });
  } catch (e) {
    console.error('getInterfaces service error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard Interfaces' });
    next(e);
  }
};

// Получаем первый свободный IP для интерфейса
export const getFirstFreeIP = async (req, res, next) => {
  const iface = req.query.iface;
  try {
    const ifaceParams = getIfaceParams(iface);
    if (!ifaceParams.success) {
      return res.status(422).json(ifaceParams);
    }
    const busyIPs = getInterfacePeersIPs(iface);
    const { cidr: serverCIDR } = ifaceParams.data;
    res.status(200).json({
      success: true,
      data: getFirstAvailableIP(busyIPs, serverCIDR),
    });
  } catch (e) {
    console.error('getFirstFreeIP service error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t get new free IP' });
    next(e);
  }
};

export const addNewClient = async (req, res, next) => {
  const requestedIP = req.body?.ip;
  const newName = req.body?.name;
  const iface = req.body?.iface;

  try {
    const ifaceParams = getIfaceParams(iface);
    if (!ifaceParams.success) {
      return res.status(400).json(ifaceParams);
    }
    const { cidr: serverCIDR, pubkey: serverPubKey, port: serverWGPort } = ifaceParams.data;
    const busyIPs = getInterfacePeersIPs(iface);

    if (isExistAndNotNull(requestedIP) && busyIPs.includes(requestedIP)) {
      return res.status(400).json({ success: false, errors: 'Requested IP for new client is already in use' });
    }

    const newClientData = await genNewClientKeys();
    const newIP = requestedIP || getFirstAvailableIP(busyIPs, serverCIDR);

    await appendDataToConfig(
      '/etc/wireguard/' + iface + '.conf',
      formatObjectToConfigSection('Peer', { PublicKey: newClientData.pubKey, PresharedKey: newClientData.presharedKey, AllowedIPs: newIP })
    );

    let parsedPeers = readJSON({ filePath: PEERS_PATH, parseJSON: true, createIfNotFound: {} });
    parsedPeers[newClientData.pubKey] = {
      // Сохраняем клиента в наших данных
      name: newName ?? '',
      active: true,
      ip: newIP,
      PresharedKey: newClientData.presharedKey,
    };
    saveJSON(PEERS_PATH, parsedPeers, true);

    const formattedConfig = formatConfigToString({
      Interface: { PrivateKey: newClientData.randomKey, Address: newIP, DNS: '10.8.1.1' },
      Peer: {
        PresharedKey: newClientData.presharedKey,
        PublicKey: serverPubKey,
        AllowedIPs: '0.0.0.0/0',
        Endpoint: `${getCurrentEndpoint()}:${serverWGPort}`,
        PersistentKeepalive: 25,
      },
    });

    res.setHeader('Content-Type', 'text/plain;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${newName ? transCyrilic(newName) + '.conf' : 'Client.conf'}"`);
    res.send(formattedConfig);
    res.end();
    next('route');
  } catch (e) {
    console.error('addNewClient service error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t add new client' });
    next(e);
  }
};


// Удаление клиента из конфига
export const removeClient = async (req, res, next) => {
  const iface = req.body?.iface;
  const pubKey = req.body?.pubKey;

  if (!pubKey || typeof pubKey !== 'string' || pubKey.trim().length !== 44) {
    return res.status(422).json({ success: false, errors: 'Incorrect public key!' });
  }

  try {
    const peerFound = removePeerFromConfig(iface, pubKey);
    if (!peerFound) {
      return res.status(404).json({ success: false, errors: 'Peer not found in config' });
    }
    // Удаление из файла peers.json
    let peersData = readJSON({ filePath: PEERS_PATH, parseJSON: true, createIfNotFound: {} });

    if (peersData[pubKey]) {
      delete peersData[pubKey];
      saveJSON(PEERS_PATH, peersData, true);
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('removeClient service error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t remove client' });
    next(e);
  }
};
