import path from 'path';
import { isExistAndNotNull } from 'vanicom';
import { getIfaceParams, readJSON } from './index.js';
export const isValidSubnetMask = mask => {
    const regex = /^((255|254|252|248|240|224|192|128|0)\.){3}(255|254|252|248|240|224|192|128|0)$/;
    if (!regex.test(mask)) {
        return false;
    }
    const parts = mask.split('.').map(Number);
    let foundZero = false;
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === 0) {
            foundZero = true;
        }
        else if (foundZero && parts[i] !== 0) {
            return false;
        }
    }
    return true;
};
export const getInterfacePeersIPs = iface => {
    const ifaceParams = getIfaceParams(iface);
    if (!ifaceParams.success) {
        return res.status(400).json(ifaceParams);
    }
    const { peers: peersData, ip: serverIP } = ifaceParams.data;
    let parsedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
    let allBusyIPs = [];
    peersData.map(peerKey => {
        if (isExistAndNotNull(parsedPeers[peerKey])) {
            const ipsList = parsedPeers[peerKey].ip.split(',');
            let checkedIP = [];
            if (ipsList.length === 1) {
                checkedIP.push(ipsList[0].trim().split('/').shift());
            }
            else {
                ipsList.forEach(rawIP => {
                    let tempIP = rawIP.trim().split('/').shift();
                    if (allBusyIPs.includes(tempIP)) {
                        console.error('Interface ', iface, ' has a possible conflict of IP: ', tempIP);
                    }
                    else {
                        checkedIP.push(tempIP);
                    }
                });
            }
            allBusyIPs = allBusyIPs.concat(checkedIP);
        }
    });
    allBusyIPs.push(serverIP);
    return allBusyIPs.filter(busyIP => busyIP !== '0.0.0.0');
};
export const getFirstAvailableIP = (occupiedIPs, cidr) => {
    const occupied = occupiedIPs
        .map(ip => {
        const parts = ip.split('.').map(Number);
        return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    })
        .sort((a, b) => a - b);
    const networkIP = occupied[0] & (~0 << (32 - cidr));
    const broadcastIP = networkIP | (~0 >>> cidr);
    for (let i = networkIP + 1; i < broadcastIP; i++) {
        if (!occupied.includes(i)) {
            return [(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff].join('.');
        }
    }
    return null;
};
