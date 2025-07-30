import path from 'path';
import Crypt from '@gratio/crypt';
import { getFrontendConfig, executeSingleCommand, getStatusFromBash, getAllConfigs, setWGStatus, ifaceCorrect } from '../utils/index.js';
const { encryptMsg } = Crypt.serverCrypt;
export const getWGStatus = async (req, res, next) => {
    try {
        const parsedStatus = await getStatusFromBash();
        const { frontendPasskey } = getFrontendConfig();
        const cipher = encryptMsg({ message: parsedStatus, pass: frontendPasskey });
        res.status(200).json(cipher);
    }
    catch (e) {
        console.error('getWGStatus service error: ', e);
        res.status(520).json({ success: false, errors: 'Can`t get Wireguard status' });
        next(e);
    }
};
export const rebootWGinterface = async (req, res, next) => {
    const iface = req.query.iface;
    try {
        let wgStatus = await executeSingleCommand('wg');
        if (wgStatus === '') {
            setWGStatus(false);
            console.log('WG is down, try restart');
            await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
        }
        else {
            setWGStatus(true);
            console.log('WG look like working, try down');
            await executeSingleCommand('bash', ['-c', `wg-quick down ${iface}`]);
            wgStatus = await executeSingleCommand('wg');
            if (wgStatus === '') {
                setWGStatus(false);
                console.log('WG is down, try restart');
                await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
            }
            else {
                return res.status(500).json({ success: false, errors: 'Can`t turn off Wireguard' });
            }
        }
        setWGStatus(true);
        console.log('WG look like successful restarted');
        res.status(200).json({
            data: 'WG Restarted',
            success: true,
        });
    }
    catch (e) {
        console.error('rebootWG service error: ', e);
        const errText = process.env.NODE_ENV === 'production' ? 'Some problem during Wireguard reboot' : 'rebootWG service error: ' + e.message;
        res.status(520).json({ success: false, errors: errText });
        next(e);
    }
};
