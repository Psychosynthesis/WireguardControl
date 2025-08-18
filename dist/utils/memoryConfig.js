import fs from 'fs';
import path from 'path';
import { readJSON, saveJSON } from 'boma';
import { isExistAndNotNull } from 'vanicom';
import { getStatusFromBash, getAllConfigs, COLORS, genPubKey, getServerIP, parseInterfaceConfig } from './index.js';
const PEERS_PATH = path.resolve(process.cwd(), './.data/peers.json');
const loadFrontendConfig = () => {
    const configPath = path.resolve(process.cwd(), './config.json');
    const exampleConfigPath = path.resolve(process.cwd(), 'config.example.json');
    if (!fs.existsSync(configPath)) {
        console.log('config.json not found');
        if (fs.existsSync(exampleConfigPath)) {
            fs.renameSync(exampleConfigPath, configPath);
            console.log('config.example.json renamed in config.json');
        }
        else {
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
    const config = readJSON({ filePath: configPath, createIfNotFound: {}, parseJSON: true });
    return config;
};
export const loadServerConfig = async () => {
    let frontendSettings = await loadFrontendConfig();
    let savedPeers = readJSON({ filePath: PEERS_PATH, createIfNotFound: {}, parseJSON: true });
    const savedInterfaces = readJSON({ filePath: path.resolve(process.cwd(), './.data/interfaces.json'), createIfNotFound: {}, parseJSON: true });
    const interfacesCount = Object.keys(savedInterfaces).length;
    const allConfiguredInterfaces = await getAllConfigs();
    const externalIP = await getServerIP();
    const wgStatus = await getStatusFromBash();
    const { allowedOrigins, defaultInterface, frontServerPort, frontendPasskey } = frontendSettings;
    let configInMemory = {
        allowedOrigins,
        frontServerPort,
        frontendPasskey,
        wgIsWorking: wgStatus.success,
        configIsOk: true,
        endpoint: externalIP,
        defaultInterface: '',
        interfaces: {},
    };
    let allActivePeers = [];
    if (allConfiguredInterfaces.success) {
        for (let i = 0; i < allConfiguredInterfaces.data.length; i++) {
            const confFile = allConfiguredInterfaces.data[i];
            try {
                const { interface: currentInterface, peers } = await parseInterfaceConfig(confFile);
                const pubkey = await genPubKey(currentInterface.PrivateKey);
                const interfacePeers = [];
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
                const configAdress = currentInterface.Address.trim().split('/');
                const serverIP = configAdress.shift();
                const serverCIDR = configAdress.length > 1 ? configAdress[1] : '24';
                configInMemory.interfaces[confFile] = {
                    ip: serverIP,
                    cidr: serverCIDR,
                    port: currentInterface.ListenPort,
                    pubkey,
                    peers: interfacePeers,
                };
                allActivePeers = [...allActivePeers, ...interfacePeers];
                if (isExistAndNotNull(defaultInterface) && confFile === defaultInterface) {
                    configInMemory.defaultInterface = confFile;
                }
            }
            catch (err) {
                console.error(`loadServerConfig fail on parse .conf file ${confFile}.conf: `, err);
            }
        }
        Object.keys(savedPeers).map(peerKey => {
            if (!allActivePeers.includes(peerKey))
                savedPeers[peerKey].active = false;
        });
        saveJSON(PEERS_PATH, savedPeers, true);
    }
    const correctParsedIfaces = Object.keys(configInMemory.interfaces);
    if (interfacesCount === 0 && !wgStatus.success) {
        configInMemory.configIsOk = false;
        console.error('No saved settings are found and WG is off.');
    }
    if (!correctParsedIfaces.length) {
        configInMemory.configIsOk = false;
        console.error('No .conf files correct parsed from /etc/wireguard');
    }
    else if (!isExistAndNotNull(defaultInterface) ||
        !correctParsedIfaces.includes(defaultInterface)) {
        const newDefaultInt = configInMemory.interfaces[correctParsedIfaces[0]];
        frontendSettings.defaultInterface = newDefaultInt;
        saveJSON(path.resolve(process.cwd(), './config.json'), frontendSettings, true);
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
    return global.wgControlServerSettings.endpoint;
};
export const setWGStatus = status => {
    global.wgControlServerSettings.wgIsWorking = status;
};
