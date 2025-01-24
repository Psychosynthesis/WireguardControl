import { getNameFromSavedData, readJSON, normalizeLineBreaks } from './tools.js';

// Парсим статус
export const parseStatus = (rawStatus) => {
  let parsedStatus = { interface: {}, peers: [] }

  const sections = rawStatus.split(/(?:\s*(interface|peer)\s*:)/gi).filter(line => line);
  for (let i = 0; i < sections.length; i += 2) {
    if (typeof(sections[i + 1]) === 'undefined') continue;
    const sectionName = sections[i].trim().toLowerCase();
    const sectionContent = normalizeLineBreaks(sections[i + 1].trim()).split(/\n/);
    let parsedSection = {};
    sectionContent.forEach((item, i) => {
      if (i === 0) {
        parsedSection.name = item; // У peer первая строка это ключ, у интерфейса это имя файла .conf
      } else {
        parsedSection[item.split(':')[0].trim()] = item.slice(item.indexOf(':')+1).trim();
      }
    });

    if (sectionName === 'peer') {
      parsedSection['public key'] = parsedSection.name;
      parsedSection.name = getNameFromSavedData(parsedSection.name);
      parsedStatus.peers.push(parsedSection);
    } else {
      parsedStatus[sectionName] = parsedSection;
    }
  }

  return parsedStatus;
}
