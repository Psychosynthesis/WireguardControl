import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { executeSingleCommand, parseStatus } from './index.js';
export const normalizeLineBreaks = data => data.replace(/\r\n/g, '\n');
export const readJSON = (filePath, createIfNotFound = false) => {
    try {
        const savedConfig = readFileSync(filePath, 'utf8');
        return JSON.parse(savedConfig);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            if (createIfNotFound) {
                console.log('Try to create: ', filePath);
                try {
                    writeFileSync(filePath, '{}', 'utf8');
                }
                catch (writeErr) {
                    console.error(`Error on create file ${filePath}: `, writeErr);
                }
            }
            else {
                console.log('File not found: ', filePath);
            }
        }
        else {
            console.error('Function readJSON get error:', err);
        }
        return {};
    }
};
export const saveJSON = (filePath, objToSave) => {
    const json = JSON.stringify(objToSave);
    writeFileSync(filePath, json, 'utf8');
};
export const getNameFromSavedData = key => {
    const savedPeers = readJSON(path.resolve(process.cwd(), './.data/peers.json'), true);
    const hasSavedData = Object.keys(savedPeers).length > 0;
    if (hasSavedData && savedPeers.hasOwnProperty(key)) {
        return savedPeers[key].name || '[UNNAMED PEER]';
    }
    return '';
};
export const getStatusFromBash = async () => {
    const rawStatus = await executeSingleCommand('wg');
    if (rawStatus.includes('not found, but')) {
        return { success: false, errors: 'Seems like Wireguard does not installed on server' };
    }
    else if (rawStatus === '') {
        return { success: false, errors: 'Wireguard is disabled' };
    }
    const parsedStatus = parseStatus(rawStatus);
    return {
        success: true,
        data: { ...parsedStatus },
    };
};
export const transCyrilic = (str) => {
    return str.replace(/[ЁёА-я]/g, c => ({ 'Ё': 'Yo', 'ё': 'yo', 'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v', 'Г': 'G', 'г': 'g', 'Д': 'D', 'д': 'd',
        'Е': 'E', 'е': 'e', 'Ж': 'Zh', 'ж': 'zh', 'З': 'Z', 'з': 'z', 'И': 'I', 'и': 'i', 'Й': 'Y', 'й': 'y', 'К': 'K', 'к': 'k',
        'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'N', 'н': 'n', 'О': 'O', 'о': 'o', 'П': 'P', 'п': 'p', 'Р': 'R', 'р': 'r',
        'С': 'S', 'с': 's', 'Т': 'T', 'т': 't', 'У': 'U', 'у': 'u', 'Ф': 'F', 'ф': 'f', 'Х': 'Kh', 'х': 'kh', 'Ц': 'Ts', 'ц': 'ts',
        'Ч': 'Ch', 'ч': 'ch', 'Ш': 'Sh', 'ш': 'sh', 'Щ': 'Shch', 'щ': 'shch', 'Ъ': '', 'ъ': '', 'Ы': 'Y', 'ы': 'y', 'Ь': '', 'ь': '',
        'Э': 'E', 'э': 'e', 'Ю': 'Yu', 'ю': 'yu', 'Я': 'Ya', 'я': 'ya', ' ': '_' })[c] || c);
};
