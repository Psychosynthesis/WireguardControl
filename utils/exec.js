import { spawn } from 'child_process';

// Хелпер для выполнения команд в баше
export const executeSingleCommand = (command, args) => {
  return new Promise((resolve, reject) => {
    // Запускаем команду
    const childProcess = spawn(command, args);

    let stdoutData = '';
    let stderrData = '';

    // Собираем стандартный вывод
    childProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    // Собираем ошибки
    childProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Ожидаем завершения процесса
    childProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`executeSingleCommand end with error ${code}: ${stderrData}`));
      } else {
        resolve(stdoutData.trim());
      }
    });
  });
}

// Генерируем публичный ключ из приватного
export const genPubKey = async (privateKey) => {
  const pubKey = await executeSingleCommand('bash', ['-c', `echo ${privateKey} | wg pubkey`]);
  return pubKey;
}

// Генерируем новую тройку ключей для клиента или сервера
export const genNewClientKeys = async () => {
  const randomKey = await executeSingleCommand('wg', ['genkey']); // Приватный ключ
  const presharedKey = await executeSingleCommand('wg', ['genkey']); // Общий дополнительный ключ
  const pubKey = await genPubKey(randomKey); // Публичный ключ

  return { randomKey, presharedKey, pubKey }
}

export const getServerIP = async () => {
  const externalInterface = await executeSingleCommand('bash', ['-c', `ip route | awk '/default/ {print $5; exit}'`]);
  const command = `ip addr show ${externalInterface} | grep "inet" | grep -v "inet6" | head -n 1 | awk '/inet/ {print $2}' | awk -F/ '{print $1}'`;
  const pubIP = await executeSingleCommand('bash', ['-c', command]);
  return pubIP;
}
