import fs from 'fs';
import { getNameFromSavedData, normalizeLineBreaks } from './index.js';
export const parseStatus = (rawStatus) => {
    let parsedStatus = { interface: {}, peers: [] };
    const sections = rawStatus.split(/(?:\s*(interface|peer)\s*:)/gi).filter(line => line);
    for (let i = 0; i < sections.length; i += 2) {
        if (typeof sections[i + 1] === 'undefined')
            continue;
        const sectionName = sections[i].trim().toLowerCase();
        const sectionContent = normalizeLineBreaks(sections[i + 1].trim()).split(/\n/);
        let parsedSection = { name: '' };
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
export const splitBySections = (content) => {
    const result = { interface: {}, peers: [] };
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
const parseLine = (line) => {
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
export const parseInterfaceConfig = (iface) => {
    if (!iface || typeof iface !== 'string') {
        throw new Error('Interface must be a string!');
    }
    const interfacePath = `/etc/wireguard/${iface}.conf`;
    if (!fs.existsSync(interfacePath)) {
        throw new Error('Incorrect interface!');
    }
    console.log('Try to parse interface ' + interfacePath);
    try {
        const data = fs.readFileSync(interfacePath, 'utf8');
        const splittedData = splitBySections(data);
        const configObject = { interface: {}, peers: [] };
        for (const section in splittedData) {
            const sectionName = section.toLowerCase();
            switch (sectionName) {
                case 'peers':
                    configObject.peers = splittedData[section].map((peerData) => {
                        const peer = {};
                        peerData.split('\n').forEach(line => {
                            Object.assign(peer, parseLine(line));
                        });
                        peer.name = getNameFromSavedData(peer.PublicKey);
                        return peer;
                    });
                    break;
                case 'interface':
                    splittedData[section].split('\n').forEach((line) => {
                        configObject[section] = { ...configObject[section], ...parseLine(line) };
                    });
            }
        }
        return configObject;
    }
    catch (error) {
        throw new Error(`Failed to parse config file: ${error.message}`);
    }
};
