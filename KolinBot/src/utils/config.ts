import fs from 'fs';
import path from 'path';

interface Config {
  prefix: string;
  token?: string;
  admins: string[];
}

const configPath = path.join(__dirname, '../config.json');
export const config: Config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export function readConfig(): Config {
    return config;
}

export function saveConfig(newConfig: Config) {
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}