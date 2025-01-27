import path from 'path';
import { writeFileSync } from 'fs';
import { Readable } from 'stream';

import { isExistAndNotNull } from 'vanicom';
import {
  appendDataToConfig,
  genNewClientKeys,
  getConfFiles,
  parseWGConfig,
  readJSON,
  saveJSON,
  formatConfigToString,
  formatObjectToConfigSection
} from '../utils/index.js';

// Получить конфиг конкретного интерфейса
export const getInterfaceConfig = async (req, res, next) => {
  const iface = req.query.iface;
  if (!iface) {
    return res.status(400).json({ success: false, errors: 'Interface must be provided!' });
  }

  try {
    const confFiles = await getConfFiles('/etc/wireguard');
    if (!confFiles.includes(iface)) {
      return res.status(422).json({ success: false, errors: 'Incorrect interface!' });
    }

    // Парсим конфиг
    const currentConfig = await parseWGConfig(`/etc/wireguard/${iface}.conf`);


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
    const parsedSettings = readJSON(path.resolve(process.cwd(), './config.json'));
    const confFiles = await getConfFiles('/etc/wireguard');

    if (!Array.isArray(confFiles) || Object.keys(parsedSettings).length == 0) {
      console.error('getInterfaces error when getting the configs files, or system settings. Parsed settings is: ', parsedSettings)
      return res.status(500).json({ success: false, errors: 'Error when get configs' });
    } else if (!confFiles.length) {
      return res.status(500).json({ success: false, errors: 'Seems like Wireguard is not configured yet' });
    }
    const iFaces = [];
    confFiles.map(file => {
      iFaces.push({ checked: confFiles.length === 1 || file === parsedSettings.defaultInterface, value: file });
    })

    res.status(200).json({ success: true, data: iFaces });
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

  if (!newIp || !iface) {
    return res.status(400).json({ success: false, errors: 'AllowedIPs and Interface must be provided' });
  }

  try {
    const newClientData = await genNewClientKeys();

    await appendDataToConfig(
      '/etc/wireguard/'+iface+'.conf',
      formatObjectToConfigSection('Peer', { PublicKey: newClientData.pubKey, PresharedKey: newClientData.presharedKey, AllowedIPs: newIp }),
    );

    let parsedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
    parsedPeers[newClientData.pubKey] = { name: newName ?? '', PresharedKey: newClientData.presharedKey };
    saveJSON(path.resolve(process.cwd(), './.data/peers.json'), parsedPeers);

    const formattedConfig = formatConfigToString({
      Interface: { PrivateKey: newClientData.randomKey, Address: newIp, DNS: '1.1.1.1' },
      Peer: {
        PresharedKey: newClientData.presharedKey,
        PublicKey: global.wgControlServerSettings.interfaces[iface].pubkey,
        AllowedIPs: '0.0.0.0/0',
      }
    });

    res.setHeader('Content-Type', 'text/plain;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${newName ? newName + '.conf' : 'Client.conf'}"`);
    console.log("Заголовки установлены.");
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
