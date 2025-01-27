import path from 'path';
import {
  executeSingleCommand,
  getConfFiles,
  parseStatus
} from '../utils/index.js';

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
