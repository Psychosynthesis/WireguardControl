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
        reject(new Error(`Процесс завершился с ошибкой ${code}: ${stderrData}`));
      } else {
        resolve(stdoutData.trim());
      }
    });
  });
}
