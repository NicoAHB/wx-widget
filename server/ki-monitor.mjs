// Repository: ../shared; Installer: ./shared. Beide laden unveränderte gemeinsame Module.
import fs from 'node:fs';
const base = fs.existsSync(new URL('./shared/confluence-service.mjs', import.meta.url)) ? './shared/' : '../shared/';
export const { ConfluenceService, kiMessage, serviceSelection } = await import(new URL(base + 'confluence-service.mjs', import.meta.url));
