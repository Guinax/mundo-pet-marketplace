// Preferência local persistente por administrador e dispositivo.
// O disparo de vendas depende de uma integração Web Push no servidor.
const key = userId => 'mundopet.admin.saleAlerts.' + userId;
export function adminAlertsEnabled(userId) {
  try { return Boolean(userId) && localStorage.getItem(key(userId)) === 'on'; }
  catch { return false; }
}
export function adminAlertsPermission() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}
export async function enableAdminAlerts(userId) {
  if (!userId) throw new Error('Entre na conta administrativa.');
  if (typeof Notification === 'undefined') throw new Error('Este navegador não oferece notificações.');
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') throw new Error('Autorize as notificações nas configurações do Android ou navegador.');
  try { localStorage.setItem(key(userId), 'on'); }
  catch { throw new Error('Não foi possível salvar a configuração neste dispositivo.'); }
}
export function disableAdminAlerts(userId) {
  if (!userId) return;
  localStorage.removeItem(key(userId));
}
