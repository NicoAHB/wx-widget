// Gemeinsame Sendefreigabe, keine Analyse-Engine und keine Telegram-Zugangsdaten.
export function analysisChannelState({ serviceConfigured=false, target=null, localOn=true, localEpoch=0, localSince=0 }={}) {
  const coordinated=serviceConfigured&&target&&typeof target.on==='boolean'&&Number.isInteger(target.epoch);
  return { on:coordinated?target.on:localOn!==false, coordinated:!!coordinated,
    stamp:coordinated?`service:${target.epoch}`:`local:${localEpoch}`,
    since:coordinated?(Number.isFinite(target.since)?target.since:0):(Number.isFinite(localSince)?localSince:0) };
}
export const analysisChannelAllows=(channel,at)=>channel.on&&Number.isFinite(at)&&at>=channel.since;
