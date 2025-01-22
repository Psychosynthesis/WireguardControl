import { isExistAndNotNull } from 'vanicom';
import { executeSingleCommand, getConfFiles, parseWGConfig } from '../utils/index.js';

export const getWGStatus = async (req, res, next) => {
  try {
    const wgStatus = await executeSingleCommand('wg');
    if (wgStatus.includes('not found, but')) {
      return res.status(200).json({ success: true, data: 'Seems like Wireguard does not installed on server' });
    } else if (wgStatus === '') {
      return res.status(200).json({ success: true, data: 'Wireguard is disabled', });
    }

    res.status(200).json({ success: true, data: wgStatus });
  } catch (e) {
    console.error('getWGStatus service error: ', e)
    res.status(400).json({ success: false, errors: 'Can`t get Wireguard status' });
    next(e);
  }
}

export const rebootWG = async (req, res, next) => {
  try {
    let wgStatus = await executeSingleCommand('wg');
    if (wgStatus === '') { // Wireguard не запущен
      console.log('WG is down, try restart');
      await executeSingleCommand('bash', ['-c', `wg-quick up wg`]);
    } else {
      console.log('WG look like working, try down');
      await executeSingleCommand('bash', ['-c', `wg-quick down wg`]);
      wgStatus = await executeSingleCommand('wg'); // Повторно проверяем статус, должно быть ''
      if (wgStatus === '') {
        console.log('WG is down, try restart');
        await executeSingleCommand('bash', ['-c', `wg-quick up wg`]);
      } else {
        return res.status(400).json({ success: false, errors: 'Can`t turn off Wireguard' });
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
    res.status(400).json({ success: false, errors: errText });
    next(e)
  }
}

export const getConfig = async (req, res, next) => {
  try {
    const wgConfig = await getConfFiles('/etc/wireguard/wg.conf');

    res.status(200).json({ success: true, data: wgConfig });
  } catch (e) {
    console.error('getConfig service error: ', e)
    res.status(400).json({ success: false, errors: 'Can`t get Wireguard config' });
    next(e);
  }
}

export const getInterfaces = async (req, res, next) => {
  try {
    const confFiles = await parseWGConfig('/etc/wireguard');

    res.status(200).json({ success: true, data: confFiles });
  } catch (e) {
    console.error('getInterfaces service error: ', e)
    res.status(400).json({ success: false, errors: 'Can`t get Wireguard Interfaces' });
    next(e);
  }
}

export const getRandomKey = async (req, res, next) => {
  try {
    const randomKey = await executeSingleCommand('wg', ['genkey']);
    if (!randomKey) {
      console.log('Something went wrong, cant get randomKey: ', randomKey);
      return res.status(400).json({ success: false, errors: 'Something went wrong, can`t get random key' });
    }

    res.status(200).json({
      data: randomKey,
    });
  } catch (e) {
    console.error('getRandomKey service error: ', e)
    res.status(400).json({ success: false, errors: 'Can`t get random key' });
    next(e)
  }
}

export const getPubKey = async (req, res, next) => {
  try {
    const pubKey = await executeSingleCommand('bash', ['-c', 'echo "kOd3FVBggwpjD3AlZKXUxNTzJT0+f3MJdUdR8n6ZBn8=" | wg pubkey']);
    if (!pubKey) {
      console.log('Something went wrong, cant get pubKey: ', pubKey);
      return res.status(400).json({ success: false, errors: 'Something went wrong, can`t get public key' });
    }

    res.status(200).json({
      data: pubKey,
    });
  } catch (e) {
    console.error('getPubKey service error: ', e)
    res.status(400).json({ success: false, errors: 'Can`t get public key' });
    next(e);
  }
}
