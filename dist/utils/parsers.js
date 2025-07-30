import fs from 'fs';
import { getNameFromSavedData, readJSON, normalizeLineBreaks } from './index.js';
export const parseStatus = rawStatus => {
    let parsedStatus = { interface: {}, peers: [] };
    const sections = rawStatus.split(/(?:\s*(interface|peer)\s*:)/gi).filter(line => line);
    for (let i = 0; i < sections.length; i += 2) {
        if (typeof sections[i + 1] === 'undefined')
            continue;
        const sectionName = sections[i].trim().toLowerCase();
        const sectionContent = normalizeLineBreaks(sections[i + 1].trim()).split(/\n/);
        let parsedSection = {};
        sectionContent.forEach((item, i) => {
            if (i === 0) {
                parsedSection.name = item;
            }
            else {
                parsedSection[item.split(':')[0].trim()] = item.slice(item.indexOf(':') + 1).trim();
            }
        });
        if (sectionName === 'peer') {
            parsedSection['public key'] = parsedSection.name;
            parsedSection.name = getNameFromSavedData(parsedSection.name);
            parsedStatus.peers.push(parsedSection);
        }
        else {
            parsedStatus[sectionName] = parsedSection;
        }
    }
    return parsedStatus;
};
export const splitBySections = content => {
    const result = { peers: [] };
    if (typeof content !== 'string' || !content.length) {
        return result;
    }
    const sections = content.split(/\[(.+?)\]/g);
    for (let i = 1; i < sections.length; i += 2) {
        const sectionName = sections[i].trim().toLowerCase();
        const sectionContent = normalizeLineBreaks(sections[i + 1].trim());
        if (sectionName === 'peer') {
            result.peers.push(sectionContent);
        }
        else {
            result[sectionName] = sectionContent;
        }
    }
    return result;
};
const parseLine = line => {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('#') && !trimmedLine.startsWith(';')) {
        const match = trimmedLine.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            return { [key]: value };
        }
    }
};
export const parseInterfaceConfig = iface => {
    if (!iface || typeof iface !== 'string') {
        return new Promise.reject(new Error('Interface must be a string!'));
    }
    const interfacePath = `/etc/wireguard/${iface}.conf`;
    const interfaceExist = fs.existsSync(interfacePath);
    if (!interfaceExist) {
        return new Promise.reject(new Error('Incorrect interface!'));
    }
    console.log('Try to parse interface ' + interfacePath);
    return new Promise((resolve, reject) => {
        try {
            fs.readFile(`/etc/wireguard/${iface}.conf`, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                const splittedData = splitBySections(data);
                const configObject = { peers: Array(splittedData.peers.length) };
                for (let section in splittedData) {
                    if (section.toLowerCase() === 'peers') {
                        splittedData.peers.forEach((item, i) => {
                            item.split('\n').forEach(line => {
                                configObject.peers[i] = { ...configObject.peers[i], ...parseLine(line) };
                            });
                            configObject.peers[i].name = getNameFromSavedData(configObject.peers[i].PublicKey);
                        });
                    }
                    else {
                        splittedData[section].split('\n').forEach(line => {
                            configObject[section] = { ...configObject[section], ...parseLine(line) };
                        });
                    }
                }
                resolve(configObject);
            });
        }
        catch (error) {
            reject(new Error(`Failed to parse config file: ${error.message}`));
        }
    });
};
