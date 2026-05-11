import {DETECTIVES_INFO, FRACTION_INFO} from "./constants/fractions";

export const CHECK_SERVER_ID = ['1405927487095181322']
export const ADMINS_SERVER_ID = [`1316831633466458192`]


export function getStateServerIds()  {
    return Object.values(FRACTION_INFO).filter(i=> i.state && i.discord_id.length != 0 && i.discord_id != FRACTION_INFO['CHP_SERVER'].discord_id).map(i => i.discord_id)
}

export function getDetectivesServerIds() {
    return Object.values(DETECTIVES_INFO).map(i => i.discord_id)
}

export function getCrimeServerIds() {
    return Object.values(FRACTION_INFO).filter(i => !i.state && i.discord_id.length != 0).map(i => i.discord_id);
}

export function getPlayerServerIds() {
    return [...getStateServerIds(), ...getCrimeServerIds()]
}

export function getStateFractionRoles() {
    return Object.values(FRACTION_INFO)
        .filter(i => i.state && i.discord_id.length != 0 && i.discord_id != FRACTION_INFO['CHP_SERVER'].discord_id)
        .map(i => i.chp_role_id)
}

export function getAllServerIds() {
    return [...CHECK_SERVER_ID, ...ADMINS_SERVER_ID, FRACTION_INFO['CHP_SERVER'].discord_id, ...getStateServerIds(), ...getDetectivesServerIds(), ...getCrimeServerIds()]
}


export function getStateHighRoles(): string[] {
  return Object.values(FRACTION_INFO)
    .filter(i => i.state && i.state_high_role_id.length > 0)
    .flatMap(i => i.state_high_role_id);  
}

export function getAdminLogServerIds(): string[] {
  return ADMINS_SERVER_ID;
}

const ADMIN_LOG_CHANNEL_ID = "1501935615376097572"
export function getAdminLogChannelId(): string | null {
  return ADMIN_LOG_CHANNEL_ID || null;
}


export const GOV_PATCH_LOG_CHANNEL_ID = '1380141440944046140'
export const TRANSFER_LOG_CHANNEL_ID = '1499391643076530278'

export const PUNISHMENT_ADMINS_CHANNEL_ID = '1316831634376364056'


export const GOV_ACCESS_PATCH_REQUEST = ['871764495884763177', '674318969116819487', '835224536794267690']
export const DETECTIVE_PATCH_ACCESS_ROLES_ID = ['674313754472742912', '676700617716269076', '673463287215816704']
export const GOV_DELETE_PATCH_ACCESS_ROLE_ID = ['673463285173190656']
export const GOV_DELETE_PATCH_CHANNEL_ID = '1104850449527472209'
export const GOV_NOTIFY_CHANNEL_ID = '1379428209065594931'
export const CHP_INVITE_CHANNEL_ID = '673463233729921035'
export const GOV_NICKNAME_REQUESTS_CHANNEL_ID = '1503078502801477752'
export const GOV_NICKNAME_REQUESTS_ROLES_ID = ['673463287215816704', '674313754472742912', '676700617716269076']
export const ADMIN_NICKNAME_LOGS_CHANNEL_ID = '1503330726643236874'
