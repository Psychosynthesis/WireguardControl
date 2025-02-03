import path from 'path';
import { writeFileSync } from 'fs';
import { Readable } from 'stream';

import {
  appendDataToConfig,
  getAllInterfacePeersIPs,
  genNewClientKeys,
  parseWGConfig,
  readJSON,
  saveJSON,
  formatConfigToString,
  formatObjectToConfigSection
} from '../utils/index.js';

// Получить конфиг конкретного интерфейса
// Проверяются только загруженные в память конфиги! Для проверки сохранённых написать другой метод.
export const getInterfaceConfig = async (req, res, next) => {
  const iface = req.query.iface;
  const activeInterfacesList = Object.keys(global.wgControlServerSettings.interfaces);

  if (!iface || !activeInterfacesList.includes(iface)) {
    return res.status(422).json({ success: false, errors: 'Incorrect interface!' });
  }

  try {
    // Парсим конфиг
    const currentConfig = await parseWGConfig(`/etc/wireguard/${iface}.conf`);

    console.log("Busy IP's list: ", getAllInterfacePeersIPs(iface))

    res.status(200).json({ success: true, data: currentConfig });
  } catch (e) {
    console.error('getConfig service error: ', e)
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard config' });
    next(e);
  }
}

// Получаем список доступных интерфейсов
export const getInterfaces = async (req, res, next) => {
  try {
    const activeInterfacesList = Object.keys(global.wgControlServerSettings.interfaces);
    const interfacesListForSelect = activeInterfacesList.map(
      file => ({ checked: file === global.wgControlServerSettings.defaultInterface, value: file })
    );

    res.status(200).json({
      success: true,
      data: interfacesListForSelect
    });
  } catch (e) {
    console.error('getInterfaces service error: ', e)
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard Interfaces' });
    next(e);
  }
}

export const addNewClient = async (req, res, next) => {
  const newIp = req.body?.ip;
  const newName = req.body?.name;
  const iface = req.body?.iface;
  const activeInterfacesList = Object.keys(global.wgControlServerSettings.interfaces);

  if (!newIp) {
    return res.status(400).json({ success: false, errors: 'AllowedIPs must be provided' });
  }

  if (!iface || !activeInterfacesList.includes(iface)) {
    return res.status(422).json({ success: false, errors: 'Incorrect interface!' });
  }

  try {
    const newClientData = await genNewClientKeys();

    await appendDataToConfig(
      '/etc/wireguard/'+iface+'.conf',
      formatObjectToConfigSection('Peer', { PublicKey: newClientData.pubKey, PresharedKey: newClientData.presharedKey, AllowedIPs: newIp }),
    );

    let parsedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
    parsedPeers[newClientData.pubKey] = { // Сохраняем клиента в наших данных
      active: true,
      name: newName ?? '',
      PresharedKey: newClientData.presharedKey
    };
    saveJSON(path.resolve(process.cwd(), './.data/peers.json'), parsedPeers);

    const formattedConfig = formatConfigToString({
      Interface: { PrivateKey: newClientData.randomKey, Address: newIp, DNS: '1.1.1.1' },
      Peer: {
        PresharedKey: newClientData.presharedKey,
        PublicKey: global.wgControlServerSettings.interfaces[iface].pubkey,
        AllowedIPs: '0.0.0.0/0',
        Endpoint: `${global.wgControlServerSettings.endpoint}:${global.wgControlServerSettings.interfaces[iface].port}`,
        PersistentKeepalive: 25
      }
    });

    res.setHeader('Content-Type', 'text/plain;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${newName ? newName + '.conf' : 'Client.conf'}"`);
    res.send(formattedConfig);
    res.end();

    /*
    const readableStream = new Readable();
    readableStream.push(formattedConfig);
    readableStream.push(null);
    readableStream.pipe(res);
    */
    next('route');
  } catch (e) {
    console.error('addNewClient service error: ', e)
    res.status(520).json({ success: false, errors: 'Can`t add new client' });
    next(e)
  }
}
