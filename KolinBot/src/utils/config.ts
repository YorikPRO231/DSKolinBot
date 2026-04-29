import {DETECTIVES_INFO, FRACTION_INFO} from "./constants/fractions";

export const CHECK_SERVER_ID = ['1405927487095181322']
export const ADMINS_SERVER_ID = [`1316831633466458192`]
export const EMERGENCY_SERVER_ID = [`1467227742037741846`]
export const TRANSFER_LOG_CHANNEL_ID = `1494095206994411731`


export function getStateServerIds()  {
    return Object.values(FRACTION_INFO).filter(i=> i.state).map(i => i.discord_id)
}

export function getDetectivesServerIds() {
    return Object.values(DETECTIVES_INFO).map(i => i.discord_id)
}

export function getCrimeServerIds() {
    return Object.values(FRACTION_INFO).filter(i => !i.state).map(i => i.discord_id);
}

export function getPlayerServerIds() {
    return [...getStateServerIds(), ...getCrimeServerIds(), ...EMERGENCY_SERVER_ID]
}

export function getAllServerIds() {
    return [...CHECK_SERVER_ID, ...ADMINS_SERVER_ID, ...EMERGENCY_SERVER_ID, ...getStateServerIds(), ...getDetectivesServerIds(), ...getCrimeServerIds()]
}

export const GOV_PATCH_LOG_CHANNEL_ID = '1498404696212373712'

export const STATE_HIGH_MEMBER_ROLES_ID = [`1498674203203997716`]