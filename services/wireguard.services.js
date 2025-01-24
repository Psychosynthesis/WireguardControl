import path from 'path';
import { isExistAndNotNull } from 'vanicom';
import { executeSingleCommand, getConfFiles, parseWGConfig, readJSON, normalizeLineBreaks, parseStatus } from '../utils/index.js';

export const getWGStatus = async (req, res, next) => {
  try {
    const rawStatus = await executeSingleCommand('wg');
    if (rawStatus.includes('not found, but')) {
      return res.status(200).json({ success: true, data: 'Seems like Wireguard does not installed on server' });
    } else if (rawStatus === '') {
      return res.status(200).json({ success: true, data: 'Wireguard is disabled', });
    }
    const parsedStatus = parseStatus(rawStatus);

    res.status(200).json({ success: true, data: parsedStatus });
  } catch (e) {
    console.error('getWGStatus service error: ', e)
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard status' });
    next(e);
  }
}

export const rebootWG = async (req, res, next) => {
  const iface = req.query.iface;
  if (!iface) {
    return res.status(400).json({ success: false, errors: 'Interface must be provided!' });
  }
  try {
    const confFiles = await getConfFiles('/etc/wireguard');
    if (!confFiles.includes(iface)) {
      return res.status(422).json({ success: false, errors: 'Incorrect interface!' });
    }
    let wgStatus = await executeSingleCommand('wg');
    if (wgStatus === '') { // Wireguard не запущен
      console.log('WG is down, try restart');
      await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
    } else {
      console.log('WG look like working, try down');
      await executeSingleCommand('bash', ['-c', `wg-quick down ${iface}`]);
      wgStatus = await executeSingleCommand('wg'); // Повторно проверяем статус, должно быть ''
      if (wgStatus === '') {
        console.log('WG is down, try restart');
        await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
      } else {
        return res.status(500).json({ success: false, errors: 'Can`t turn off Wireguard' });
      }
    }
    console.log('WG look like successful restarted');
    res.status(200).json({
      data: 'WG Restarted',
      success: true,
    });
  } catch (e) {
    console.error('rebootWG service error: ', e);
    const errText = (process.env.NODE_ENV === 'production') ? 'Some problem during Wireguard reboot' : 'rebootWG service error: ' + e.message
    res.status(520).json({ success: false, errors: errText });
    next(e)
  }
}

export const getConfig = async (req, res, next) => {
  const iface = req.query.iface;
  if (!iface) {
    return res.status(400).json({ success: false, errors: 'Interface must be provided!' });
  }

  try {
    const confFiles = await getConfFiles('/etc/wireguard');
    if (!confFiles.includes(iface)) {
      return res.status(422).json({ success: false, errors: 'Incorrect interface!' });
    }
    const currentConfig = await parseWGConfig(`/etc/wireguard/${iface}.conf`);

    res.status(200).json({ success: true, data: currentConfig });
  } catch (e) {
    console.error('getConfig service error: ', e)
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard config' });
    next(e);
  }
}

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

export const getRandomKey = async (req, res, next) => {
  try {
    const randomKey = await executeSingleCommand('wg', ['genkey']);
    if (!randomKey) {
      console.log('Something went wrong, cant get randomKey: ', randomKey);
      return res.status(500).json({ success: false, errors: 'Something went wrong, can`t get random key' });
    }

    res.status(200).json({
      data: randomKey,
    });
  } catch (e) {
    console.error('getRandomKey service error: ', e)
    res.status(520).json({ success: false, errors: 'Can`t get random key' });
    next(e)
  }
}

export const getPubKey = async (req, res, next) => {
  try {
    const pubKey = await executeSingleCommand('bash', ['-c', 'echo "kOd3FVBggwpjD3AlZKXUxNTzJT0+f3MJdUdR8n6ZBn8=" | wg pubkey']);
    if (!pubKey) {
      console.log('Something went wrong, cant get pubKey: ', pubKey);
      return res.status(500).json({ success: false, errors: 'Something went wrong, can`t get public key' });
    }

    res.status(200).json({
      data: pubKey,
    });
  } catch (e) {
    console.error('getPubKey service error: ', e)
    res.status(520).json({ success: false, errors: 'Can`t get public key' });
    next(e);
  }
}
