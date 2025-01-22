import fs from 'fs';

const normalizeLineBreaks = (data) => data.replace(/\r\n/g, '\n');

const splitBySections = (content) => {
  const result = { Peers: [] };
  if (typeof(content) !== 'string' || !content.length) { return result; }
  const sections = content.split(/\[(.+?)\]/g);
  for (let i = 1; i < sections.length; i += 2) {
    const sectionName = sections[i].trim();
    const sectionContent = normalizeLineBreaks(sections[i + 1].trim());
    if (sectionName === 'Peer') {
      result.Peers.push(sectionContent);
    } else {
      result[sectionName] = sectionContent;
    }
  }

  return result;
}

const parseLine = (line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('#') && !trimmedLine.startsWith(';')) {
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        return { [key]: value }
      }
    }
};

export const parseWGConfig = (filePath) => {
  return new Promise((resolve, reject) => {
      if (typeof filePath !== 'string') {
        reject(new Error('filePath must be a string'));
        return;
      }

    try {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const splittedData = splitBySections(data); // Разбиваем конфиг по сециям
        const configObject = { Peers: Array(splittedData.Peers.length) };
        for (let section in splittedData) {
          if (section === 'Peers') {
            splittedData.Peers.forEach((item, i) => {
              item.split('\n').forEach(line => {
                configObject.Peers[i] = { ...configObject.Peers[i], ...parseLine(line) }
              });
            });
          } else {
            splittedData[section].split('\n').forEach(line => {
              configObject[section] = { ...configObject[section], ...parseLine(line) }
            });
          }
        }

        resolve(configObject);
      });

    } catch (error) {
      reject(new Error(`Failed to parse config file: ${error.message}`));
    }
  });
};
