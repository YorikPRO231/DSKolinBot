import fs from 'fs';
import path from 'path';

export function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);
    
    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });
    
    return arrayOfFiles;
}

export function extractFormId(input: string): string {
  input = input.trim();

  if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;

  const match1 = input.match(/\/d\/e\/([a-zA-Z0-9_-]+)\//);
  if (match1) return match1[1];

  const match2 = input.match(/\/d\/([a-zA-Z0-9_-]+)\//);
  if (match2) return match2[1];

  const match3 = input.match(/\/d\/([a-zA-Z0-9_-]+)$/);
  if (match3) return match3[1];

  return input;
}