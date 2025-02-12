import path from 'path';
import {
  executeSingleCommand,
  getStatusFromBash,
  getAllConfigs,
  setWGStatus,
} from '../utils/index.js';

export const getWGStatus = async (req, res, next) => {
  try {
    const parsedStatus = await getStatusFromBash();
    res.status(200).json(parsedStatus);
  } catch (e) {
    console.error('getWGStatus service error: ', e)
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard status' });
    next(e);
  }
}

export const rebootWG = async (req, res, next) => {
  const iface = req.query.iface;
  if (!checkInterface(iface)) {
    return res.status(422).json({ success: false, errors: 'Incorrect interface!' });
  }

  try {
    let wgStatus = await executeSingleCommand('wg');
    if (wgStatus === '') { // Wireguard не запущен
      setWGStatus(false);
      console.log('WG is down, try restart');
      await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
    } else {
      setWGStatus(true)
      console.log('WG look like working, try down');
      await executeSingleCommand('bash', ['-c', `wg-quick down ${iface}`]);
      wgStatus = await executeSingleCommand('wg'); // Повторно проверяем статус, должно быть ''
      if (wgStatus === '') {
        setWGStatus(false)
        console.log('WG is down, try restart');
        await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
      } else {
        return res.status(500).json({ success: false, errors: 'Can`t turn off Wireguard' });
      }
    }
    setWGStatus(true)
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
