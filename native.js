/* Bridge to the Android app (Capacitor shell). Does nothing in a normal browser.
   In the app, reminders are real Android alarms scheduled ahead of time, so they ring even when the app is closed. */
(function (root) {
  'use strict';
  const C = root.Capacitor;
  const isNative = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  function plugin(name) {
    if (!isNative) return null;
    return (C.Plugins && C.Plugins[name]) || (typeof C.registerPlugin === 'function' ? C.registerPlugin(name) : null);
  }
  const LN = plugin('LocalNotifications'), App = plugin('App'), FS = plugin('Filesystem'), Share = plugin('Share');

  const SMALL_ICON = 'ic_stat_ggs', ICON_COLOR = '#0E7C7B';

  // Stable 31-bit id from a string key, so rescheduling replaces rather than duplicates.
  function idOf(key) { let x = 2166136261; for (let i = 0; i < key.length; i++) { x ^= key.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 1) || 1; }

  async function init(handlers) {
    if (!LN) return;
    try {
      await LN.createChannel({ id: 'ggs-leave', name: 'Leave reminders', description: 'When to leave for class', importance: 5, visibility: 1, vibration: true });
      await LN.createChannel({ id: 'ggs-info', name: 'Group and exam questions', description: 'Evening questions about tomorrow', importance: 4, visibility: 1, vibration: true });
    } catch (e) {}
    try { await LN.registerActionTypes({ types: [{ id: 'group', actions: [{ id: 'A', title: 'Group A' }, { id: 'B', title: 'Group B' }] }] }); } catch (e) {}
    LN.addListener('localNotificationActionPerformed', ev => {
      const n = ev.notification || {}, x = n.extra || {};
      if (x.kind === 'group' && (ev.actionId === 'A' || ev.actionId === 'B')) handlers.onGroup && handlers.onGroup(x.set, x.date, ev.actionId);
      else handlers.onOpen && handlers.onOpen(x.hash || 'today');
    });
    if (App) {
      App.addListener('resume', () => handlers.onResume && handlers.onResume());
      App.addListener('appUrlOpen', () => handlers.onResume && handlers.onResume());
    }
  }

  async function status() {
    const out = { notify: 'unknown', exact: 'unknown', pending: [], app: null };
    if (!LN) return out;
    try { out.notify = (await LN.checkPermissions()).display; } catch (e) {}
    try { out.exact = (await LN.checkExactNotificationSetting()).exact_alarm; } catch (e) { out.exact = 'granted'; }
    try { out.pending = (await LN.getPending()).notifications || []; } catch (e) {}
    try { out.app = App ? await App.getInfo() : null; } catch (e) {}
    return out;
  }
  async function requestNotify() { if (!LN) return 'denied'; try { return (await LN.requestPermissions()).display; } catch (e) { return 'denied'; } }
  async function openExactSettings() { if (LN) try { await LN.changeExactNotificationSetting(); } catch (e) {} }

  // items: [{key, at(ms), title, body, channel, urgent, group:{set,date}, hash}]
  async function replaceAll(items) {
    if (!LN) return 0;
    const now = Date.now();
    const list = items.filter(i => i.at > now + 5000).sort((a, b) => a.at - b.at).slice(0, 220).map(i => ({
      id: idOf(i.key), title: i.title, body: i.body, largeBody: i.body,
      schedule: { at: new Date(i.at), allowWhileIdle: true },
      channelId: i.channel || 'ggs-leave', smallIcon: SMALL_ICON, iconColor: ICON_COLOR,
      actionTypeId: i.group ? 'group' : undefined, autoCancel: true,
      extra: i.group ? { kind: 'group', set: i.group.set, date: i.group.date, hash: 'today' } : { kind: 'leave', hash: i.hash || 'today' }
    }));
    try {
      const pend = (await LN.getPending()).notifications || [];
      if (pend.length) await LN.cancel({ notifications: pend.map(n => ({ id: n.id })) });
    } catch (e) {}
    if (list.length) await LN.schedule({ notifications: list });
    return list.length;
  }
  async function test() {
    if (!LN) return;
    await LN.schedule({ notifications: [{ id: idOf('test') , title: 'Leave now · Test', body: 'This is how a "Leave now" alert looks.', schedule: { at: new Date(Date.now() + 4000), allowWhileIdle: true }, channelId: 'ggs-leave', smallIcon: SMALL_ICON, iconColor: ICON_COLOR }] });
  }
  async function shareFile(name, text, mime) {
    if (!FS || !Share) throw new Error('Sharing is not available');
    const r = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await Share.share({ title: name, url: r.uri, dialogTitle: 'Save ' + name });
  }
  // Open an outside link in the matching Android app (Maps, browser).
  function openExternal(url) { root.location.href = url; }

  root.Native = { isNative, init, status, requestNotify, openExactSettings, replaceAll, test, shareFile, openExternal, idOf };
})(typeof self !== 'undefined' ? self : globalThis);
