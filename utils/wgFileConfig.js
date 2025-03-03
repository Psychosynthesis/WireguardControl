import fs from 'fs';

// Дописываем в конец конфига
export const appendDataToConfig = async (filePath, data) => {
  const stringToAppend = '\n' + data + '\n';
  try {
    await fs.appendFileSync(filePath, stringToAppend, 'utf-8');
  } catch (error) {
    console.error(`Error on appendDataToConfig to file: "${filePath}":`, error);
    throw error;
  }
}

// Вывод объекта в формате секции файла .conf, без проверок
export const formatObjectToConfigSection = (sectionName, configObject) => {
  if (!sectionName || !Object.keys(configObject).length) {
    console.log('Incorrect data for formatObjectToConfigSection: ', sectionName, configObject);
  }

  let output = `[${sectionName}]\n `;
  Object.entries(configObject).forEach(([key, value]) => { output += `${key} = ${value}\n`; });
  output += '\n';
  return output;
}

// Преобразуем конфиг в строку формата .conf
export const formatConfigToString = (configObject) => {
  // configObject = { Interface: { ... }, Peers: [] or Peer: { ... } }
  let output = '';
  for (let section in configObject) {
    if (section.toLowerCase() === 'peers') {
      configObject[section].map((peer) => {
        if ( // Обязательные свойства у любого пира (и на сервере и на клиенте)
          !peer.hasOwnProperty('PublicKey') || !peer.hasOwnProperty('PresharedKey') || !peer.hasOwnProperty('AllowedIPs')
        ) {
          console.log('Incorrect peer in configObject: ', peer);
          return;
        }
        output += formatObjectToConfigSection('Peer', peer);
      });
      continue;
    }
    output += formatObjectToConfigSection(section, configObject[section]);
  }
  return output;
}

// Получаем список интерфейсов (все файлы .conf)
export const getAllConfigs = async () => {
  const allConfFiles = await new Promise((resolve, reject) => {
    fs.readdir('/etc/wireguard', (err, files) => {
      if (err) {
        reject(err);
      } else {
        const confFiles = [];
        files.map(file => {
          file.endsWith('.conf') && confFiles.push(file.replace(/\.[^.]*$/, ''));
        });
        resolve(confFiles);
      }
    });
  });

  if (!Array.isArray(allConfFiles)) {
    console.error('getAllConfigs error when getting the configs files: ', allConfFiles)
    return { success: false, errors: 'Error when get configs' };
  } else if (!allConfFiles.length) {
    return { success: false, errors: 'Seems like Wireguard is not configured yet (no .conf files in /etc/wireguard)' };
  }

  return { success: true, data: allConfFiles };
}
