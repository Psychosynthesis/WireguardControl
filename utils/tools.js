import fs from 'fs';

export const readJSON = (filePath) => {
  const savedConfig = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(savedConfig);
}
