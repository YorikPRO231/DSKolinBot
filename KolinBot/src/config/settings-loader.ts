import fs from 'fs';
import path from 'path';

export interface FactionSettings {
  label: string;
  type: 'government' | 'criminal';
  discord_id: string;
  emoji_id: string;
  roles: {
    faction: string;
    high: string[];
    chp?: string;
    mp?: string;
  };
  channels: {
    logs: string;
    patch_log?: string;
    transfer_log?: string;
  };
}

export interface DetectiveSettings {
  discord_id: string;
  high_role_id: string;
  name_logs_id: string;
  patch_log_channel: string;
    log_channel_id: string;
}

export interface ServerSettings {
  check: string[];
  admins: string[];
  chp: string;
  mp: string;
  test: string;
}

export interface StatePositions {
  branches: string[];
  positions: string[];
  leader_role_id: string;
}

export interface Settings {
  factions: Record<string, FactionSettings>;
  detectives: Record<string, DetectiveSettings>;
  servers: ServerSettings;
  state_positions: Record<string, StatePositions>;
  system_roles: Record<string, string[]>;
  system_channels: Record<string, string>;
}

let settings: Settings | null = null;

declare global {
  var reloadSettings: (() => void) | undefined;
}
export function loadSettings(force = false): Settings {
  const settingsPath = path.join(__dirname, 'settings.json');

  if (!force && settings) {
    return settings;
  }
  
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    settings = JSON.parse(raw) as Settings;
  } catch (error) {
    console.error('[Settings] Failed to load config:', error);
    if (!settings) {
      throw new Error('Failed to load initial settings');
    }
  }
  
  return settings;
}

export function reloadSettings(): void {
  loadSettings(true);
}

export function setupGlobalReload(): void {
  global.reloadSettings = reloadSettings;
}

export function initSettings(): Settings {
  setupGlobalReload();
  return loadSettings();
}

export function getStateServerIds(): string[] {
  const config = loadSettings();
  return Object.values(config.factions)
    .filter((f: FactionSettings) => f.type === 'government' && f.discord_id)
    .map((f: FactionSettings) => f.discord_id);
}

export function getCrimeServerIds(): string[] {
  const config = loadSettings();
  return Object.values(config.factions)
    .filter((f: FactionSettings) => f.type === 'criminal' && f.discord_id)
    .map((f: FactionSettings) => f.discord_id);
}

export function getAllServerIds(): string[] {
  const config = loadSettings();
  return [
    ...config.servers.check,
    ...config.servers.admins,
    config.servers.chp,
    ...getStateServerIds(),
    ...getCrimeServerIds(),
  ];
}

export function getServers(): ServerSettings {
  return loadSettings().servers;
}

export function getSystemChannel(key: string): string {
  return loadSettings().system_channels[key] || '';
}

export function getSystemRole(key: string): string[] {
  return loadSettings().system_roles[key] || [];
}

export function getFactionByKey(key: string): FactionSettings | undefined {
  return loadSettings().factions[key];
}

export function getFactionByDiscordId(discordId: string): [string, FactionSettings] | undefined {
  const factions = loadSettings().factions;
  for (const [key, faction] of Object.entries(factions)) {
    if (faction.discord_id === discordId) return [key, faction];
  }
  return undefined;
}

export function getDetectives(): Record<string, DetectiveSettings> {
  return loadSettings().detectives;
}

export function getDetectivesById(discord_id: string): [string, DetectiveSettings] | undefined {
    const detectives = loadSettings().detectives;
    for (const [key, faction] of Object.entries(detectives)) {
        if (faction.discord_id === discord_id) return [key, faction];
    }
    return undefined;
}

export function getStatePositions(): Record<string, StatePositions> {
  return loadSettings().state_positions;
}

export function getStateHighRoles(): string[] {
  const config = loadSettings();
  return Object.values(config.factions)
    .filter((f: FactionSettings) => f.type === 'government')
    .flatMap((f: FactionSettings) => f.roles.high || []);
}

export function getStateFractionRoles(): string[] {
  const config = loadSettings();
  return Object.values(config.factions)
    .filter((f: any) => f.type === 'government' && f.roles.chp)
    .map((f: any) => f.roles.chp);
}

export function getAdminLogServerIds(): string[] {
  return loadSettings().servers.admins;
}