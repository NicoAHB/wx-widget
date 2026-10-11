// Identischer Quellkern im Checkout und im geprüften Installer-Bündel.
import fs from 'node:fs';
const moduleUrl = new URL(fs.existsSync(new URL('./shared/market-intervals.mjs', import.meta.url)) ? './shared/market-intervals.mjs' : '../shared/market-intervals.mjs', import.meta.url);
const module = await import(moduleUrl);
export const PATTERN_STEPS = module.PATTERN_STEPS, intervalEnd = module.intervalEnd;
