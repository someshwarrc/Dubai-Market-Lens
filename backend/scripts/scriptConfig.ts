import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const getScriptSetting = async (name: string): Promise<string | undefined> => {
  const environmentValue = process.env[name]?.trim();
  if (environmentValue) return environmentValue;
  try {
    const settingsPath = join(import.meta.dirname, '..', 'local.settings.json');
    const document = JSON.parse(await readFile(settingsPath, 'utf8')) as { Values?: Record<string, string> };
    return document.Values?.[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
};
