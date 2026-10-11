// Gemeinsames unverändertes Modul: Repository ../shared, bestehender Installer ./shared.
import fs from 'node:fs';
const base = fs.existsSync(new URL('./shared/telegram-format.mjs', import.meta.url)) ? './shared/' : '../shared/';
export const { formatMessage, telegramFields, telegramPlain, finishTelegram, telegramFormatRejected, TELEGRAM_CAPTION_LIMIT } = await import(new URL(base + 'telegram-format.mjs', import.meta.url));
