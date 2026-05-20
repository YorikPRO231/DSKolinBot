import { MSK_OFFSET } from "../config";

export function getMoscowDate(date?: Date): Date {
  const now = date || new Date();
  return new Date(now.getTime() + MSK_OFFSET);
}

export function getMoscowTimeString(date?: Date): string {
  const mskTime = getMoscowDate(date);
  
  const year = mskTime.getUTCFullYear();
  const month = String(mskTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(mskTime.getUTCDate()).padStart(2, '0');
  const hours = String(mskTime.getUTCHours()).padStart(2, '0');
  const minutes = String(mskTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(mskTime.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(mskTime.getUTCMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
}

export function formatDate(timestamp: number): string {
  const mskDate = getMoscowDate(new Date(timestamp));
  
  const year = mskDate.getUTCFullYear();
  const month = String(mskDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(mskDate.getUTCDate()).padStart(2, '0');
  const hours = String(mskDate.getUTCHours()).padStart(2, '0');
  const minutes = String(mskDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(mskDate.getUTCSeconds()).padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds} (МСК)`;
}

export function getDateForFilename(date?: Date): string {
  const mskDate = getMoscowDate(date);
  
  const year = mskDate.getUTCFullYear();
  const month = String(mskDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(mskDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}