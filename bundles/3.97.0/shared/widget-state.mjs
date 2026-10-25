// 3.54.0: einheitliche Meldung für einen Teil-Ausfall; andere Widgets bleiben bedienbar.
export function networkState({ online, error } = {}) {
  if (online === false) return { kind: 'offline', text: 'Das Gerät meldet keine Internetverbindung.' };
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return { kind: 'timeout', text: 'Die Antwort steht aus. Verbindung oder Dienst prüfen; Übernahme bleibt unbestätigt.' };
  return { kind: 'unreachable', text: 'Der Dienst ist nicht erreichbar. Verbindung, Browser-Zugriff oder Dienst prüfen.' };
}
export function createWidgetBoundary(root, label, retry) {
  const doc = root.ownerDocument, box = doc.createElement('div'), title = doc.createElement('strong'), message = doc.createElement('p'), button = doc.createElement('button'); let failed = false;
  box.className = 'widget-failure'; box.hidden = true; box.setAttribute('role', 'alert'); title.textContent = `${label} vorübergehend nicht verfügbar`; message.textContent = 'Dieser Bereich konnte nicht aktualisiert werden. Die übrige App bleibt bedienbar.'; button.type = 'button'; button.className = 'button ghost'; button.textContent = 'Erneut versuchen'; box.append(title, message, button); root.prepend(box);
  const run = fn => { if (failed) return undefined; try { return fn(); } catch { failed = true; root.dataset.widgetFailure = '1'; box.hidden = false; return undefined; } };
  button.addEventListener('click', () => { failed = false; delete root.dataset.widgetFailure; box.hidden = true; run(retry); });
  return { run, get failed() { return failed; } };
}
