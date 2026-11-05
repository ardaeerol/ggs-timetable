/* Shared engine for the page and the service worker.
   No DOM access here: schedule data, dates, travel times, alerts, storage, calendar export. */
(function (root) {
  'use strict';

  // ---------- Term ----------
  const TERM = {
    name: 'Winter Term 2026/27',
    lectureStart: '2026-10-12',
    lectureEnd: '2027-02-13',
    breaks: [{ from: '2026-12-21', to: '2027-01-02', label: 'Christmas break' }]
  };

  // ---------- Places (approximate coordinates; editable addresses) ----------
  const BUILDINGS = {
    A:   { name: 'Architecture building (A)', address: 'Straße des 17. Juni 152, 10623 Berlin', lat: 52.5137, lng: 13.3247 },
    EB:  { name: 'Erweiterungsbau (EB)', address: 'Straße des 17. Juni 145, 10623 Berlin', lat: 52.5130, lng: 13.3283 },
    MAR: { name: 'Marchstraße building (MAR)', address: 'Marchstraße 23, 10587 Berlin', lat: 52.5166, lng: 13.3237 },
    FH:  { name: 'Fraunhofer building (FH)', address: 'Fraunhoferstraße 33-36, 10587 Berlin', lat: 52.5161, lng: 13.3215 },
    KAI: { name: 'KAI building', address: 'Kaiserin-Augusta-Allee 104, 10553 Berlin', lat: 52.5257, lng: 13.3192 },
    PTZ: { name: 'Production Technology Center (PTZ)', address: 'Pascalstraße 8-9, 10587 Berlin', lat: 52.5195, lng: 13.3215 },
    PC:  { name: 'Physical Chemistry building (PC)', address: 'Straße des 17. Juni 124, 10623 Berlin', lat: 52.5127, lng: 13.3236 },
    HFT: { name: 'Hochfrequenztechnik building (HFT)', address: 'Einsteinufer 25, 10587 Berlin', lat: 52.5174, lng: 13.3228 },
    MA:  { name: 'Mathematics building (MA)', address: 'Straße des 17. Juni 136, 10623 Berlin', lat: 52.5122, lng: 13.3265 },
    H:   { name: 'Main building (H)', address: 'Straße des 17. Juni 135, 10623 Berlin', lat: 52.5125, lng: 13.3269 },
    MENSA: { name: 'Mensa TU Hardenbergstraße', address: 'Hardenbergstraße 34, 10623 Berlin', lat: 52.5097, lng: 13.3262 }
  };

  const GROUP_SETS = {
    geodb:  { name: 'Geodatabases exercise' },
    geoinf: { name: 'Geoinformatics exercise' },
    adj:    { name: 'Adjustment Theory I exercise' }
  };

  function c(id, title, type, lecturer, day, start, end, room, building, startDate, group) {
    return { id, title, type, lecturer, day, start, end, room, building, startDate, enabled: true,
      group: group || null, notes: '', link: '', address: '', lat: null, lng: null };
  }

  const SEED_COURSES = [
    c('adj-l',  'Adjustment Theory I', 'Lecture', 'Neitzel', 1, '10:00', '12:00', 'A 151', 'A', '2026-10-19'),
    c('pcv-l',  'Photogrammetric Computer Vision', 'Lecture', 'Hellwich', 1, '14:00', '18:00', 'PC 203', 'PC', '2026-10-12'),
    c('gi-l',   'Geoinformatics', 'Lecture', 'Kada', 2, '08:00', '10:00', 'MAR 0.002 (EG re.)', 'MAR', '2026-10-13'),
    c('gdb-a',  'Spatial Schema Design and Querying (Geodatabases)', 'Exercise', 'Löwner', 2, '10:00', '12:00', 'EB 431D', 'EB', '2026-10-13', { set: 'geodb', option: 'A' }),
    c('gdb-l',  'Spatial Data Modeling and Management (Geodatabases)', 'Lecture', 'Kada', 2, '12:00', '14:00', 'FH 311', 'FH', '2026-10-13'),
    c('gdb-b',  'Spatial Schema Design and Querying (Geodatabases)', 'Exercise', 'Löwner', 2, '14:00', '16:00', 'EB 431D', 'EB', '2026-10-13', { set: 'geodb', option: 'B' }),
    c('sg-ex',  'Introduction to Space Geodesy', 'Exercise', 'Heinkelmann', 3, '10:00', '12:00', 'PTZ S001', 'PTZ', '2026-10-14'),
    c('sg-l',   'Introduction to Space Geodesy', 'Lecture', 'Schuh / Oberst / Wickert', 3, '14:00', '16:00', 'A 815', 'A', '2026-10-14'),
    c('pcv-ex', 'Photogrammetric Computer Vision', 'Exercise', 'Lakshmanan', 3, '16:00', '18:00', 'HFT-TA 131', 'HFT', '2026-10-14'),
    c('gi-a',   'Geoinformatics', 'Exercise', 'Kaufhold / Wamhoff', 4, '08:00', '10:00', 'EB 431D', 'EB', '2026-10-15', { set: 'geoinf', option: 'A' }),
    c('gi-b',   'Geoinformatics', 'Exercise', 'Kaufhold / Wamhoff', 4, '14:00', '16:00', 'EB 431D', 'EB', '2026-10-15', { set: 'geoinf', option: 'B' }),
    c('adj-a',  'Adjustment Theory I', 'Exercise', 'Neitzel / Weisbrich', 5, '08:00', '10:00', 'EB 431D', 'EB', '2026-10-16', { set: 'adj', option: 'A' }),
    c('adj-b',  'Adjustment Theory I', 'Exercise', 'Neitzel / Weisbrich', 5, '10:00', '12:00', 'EB 431D', 'EB', '2026-10-16', { set: 'adj', option: 'B' })
  ];

  function defaultState() {
    return {
      version: 1,
      courses: JSON.parse(JSON.stringify(SEED_COURSES)),
      exams: [],
      overrides: {},          // "courseId|YYYY-MM-DD" -> { cancelled, room, start, end, note }
      groupDefault: {},       // setId -> 'A' | 'B'
      addresses: [
        { id: 'home', label: 'Home', text: '', lat: null, lng: null },
        { id: 'second', label: 'Second address', text: '', lat: null, lng: null }
      ],
      defaultAddress: 'home',
      settings: {
        useLocation: true,
        notify: true,
        bufferMin: 5,        // walk from the stop to the room
        leadFirst: 60,       // first reminder: this many minutes before you must leave
        leadSecond: 30,
        groupAskTime: '19:00',
        examEveTime: '19:00',
        mensaId: null
      }
    };
  }

  // ---------- Dates (device local time, the phone is in Berlin) ----------
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function at(dateStr, hhmm) { const d = parseYmd(dateStr); const [h, m] = hhmm.split(':').map(Number); d.setHours(h, m, 0, 0); return d; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
  function inBreak(dateStr) { return TERM.breaks.some(b => dateStr >= b.from && dateStr <= b.to); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  // ---------- Occurrences ----------
  function groupChoiceFor(answers, state, setId, dateStr) {
    return (answers && answers[setId + '|' + dateStr]) || state.groupDefault[setId] || null;
  }

  // All class meetings between two dates (inclusive), with overrides and groups applied.
  function occurrences(state, answers, fromDate, toDate, opts) {
    opts = opts || {};
    const out = [];
    for (let d = new Date(fromDate); ymd(d) <= ymd(toDate); d = addDays(d, 1)) {
      const ds = ymd(d);
      if (ds < TERM.lectureStart || ds > TERM.lectureEnd || inBreak(ds)) continue;
      const wd = d.getDay();
      for (const crs of state.courses) {
        if (!crs.enabled && !opts.includeDisabled) continue;
        if (crs.day !== wd || ds < (crs.startDate || TERM.lectureStart)) continue;
        const ov = state.overrides[crs.id + '|' + ds] || {};
        let pending = false, chosen = null;
        if (crs.group) {
          chosen = groupChoiceFor(answers, state, crs.group.set, ds);
          if (chosen && chosen !== crs.group.option && !opts.allGroups) continue;
          pending = !chosen;
        }
        const start = ov.start || crs.start, end = ov.end || crs.end;
        out.push({
          id: crs.id + '|' + ds, course: crs, date: ds,
          start: at(ds, start), end: at(ds, end),
          room: ov.room || crs.room, cancelled: !!ov.cancelled, note: ov.note || '',
          changed: !!(ov.room || ov.start || ov.end), pending, chosen, override: ov
        });
      }
    }
    out.sort((a, b) => a.start - b.start || a.course.title.localeCompare(b.course.title));
    return out;
  }

  function placeOf(state, crs) {
    if (crs.building === 'OTHER') return { name: crs.address || 'Custom place', address: crs.address, lat: crs.lat, lng: crs.lng };
    return BUILDINGS[crs.building] || BUILDINGS.H;
  }

  // ---------- Travel ----------
  function haversineKm(a, b) {
    const R = 6371, toR = x => x * Math.PI / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  // Rough public-transport estimate used when BVG is unreachable.
  function estimateMinutes(from, to) {
    const km = haversineKm(from, to);
    if (km < 1.2) return Math.max(5, Math.round(km * 13)); // walking
    return Math.round(10 + km * 3.2);
  }

  const BVG = 'https://v6.bvg.transport.rest';

  async function bvgJourney(from, to, arriveBy) {
    const p = new URLSearchParams({
      'from.latitude': from.lat, 'from.longitude': from.lng, 'from.address': from.label || 'Start',
      'to.latitude': to.lat, 'to.longitude': to.lng, 'to.address': to.address || to.name || 'Destination',
      arrival: arriveBy.toISOString(), results: '1', stopovers: 'false', remarks: 'false'
    });
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 12000) : null;
    try {
      const r = await fetch(BVG + '/journeys?' + p.toString(), ctrl ? { signal: ctrl.signal } : {});
      if (!r.ok) throw new Error('BVG ' + r.status);
      const j = await r.json();
      const jr = j.journeys && j.journeys[0];
      if (!jr || !jr.legs || !jr.legs.length) throw new Error('No connection found');
      const first = jr.legs[0], last = jr.legs[jr.legs.length - 1];
      const dep = new Date(first.departure || first.plannedDeparture);
      const arr = new Date(last.arrival || last.plannedArrival);
      const lines = jr.legs.filter(l => l.line).map(l => l.line.name);
      return { leaveAt: dep.getTime(), arriveAt: arr.getTime(), minutes: Math.round((arr - dep) / 60000), lines, source: 'bvg' };
    } finally { if (t) clearTimeout(t); }
  }

  async function geocode(text) {
    const p = new URLSearchParams({ query: text, results: '5', addresses: 'true', poi: 'true', stops: 'true' });
    const r = await fetch(BVG + '/locations?' + p.toString());
    if (!r.ok) throw new Error('Search failed (' + r.status + ')');
    const list = await r.json();
    return list.map(x => {
      const loc = x.location || x;
      return { name: x.name || x.address, lat: loc.latitude, lng: loc.longitude };
    }).filter(x => x.lat != null);
  }

  // Origin for travel: fresh GPS fix if allowed, otherwise the default address.
  function currentOrigin(state, loc, now) {
    if (state.settings.useLocation && loc && now - loc.ts < 20 * 60000) {
      return { key: 'gps:' + loc.lat.toFixed(3) + ',' + loc.lng.toFixed(3), lat: loc.lat, lng: loc.lng, label: 'your location', kind: 'gps' };
    }
    const a = state.addresses.find(x => x.id === state.defaultAddress) || state.addresses[0];
    if (a && a.lat != null) return { key: 'addr:' + a.id + ':' + a.lat.toFixed(4) + ',' + a.lng.toFixed(4), lat: a.lat, lng: a.lng, label: a.label, kind: 'address' };
    return null;
  }

  // Refresh cached connections for meetings in the next hours. Throttled.
  async function refreshTravel(state, answers, travel, loc, now, horizonH) {
    const origin = currentOrigin(state, loc, now);
    if (!origin) return travel;
    const items = upcomingTargets(state, answers, now, horizonH || 18);
    for (const it of items) {
      const k = it.id + '@' + origin.key;
      const cached = travel[k];
      const minsToLeave = cached ? (cached.leaveAt - now) / 60000 : (it.start - now) / 60000;
      const age = cached ? (now - cached.ts) / 60000 : Infinity;
      const maxAge = minsToLeave < 90 ? 8 : minsToLeave < 240 ? 30 : 120;
      if (cached && age < maxAge) continue;
      const arriveBy = new Date(it.start.getTime() - state.settings.bufferMin * 60000);
      try {
        const res = await bvgJourney(origin, it.place, arriveBy);
        travel[k] = Object.assign(res, { ts: now, origin: origin.label });
      } catch (e) {
        const m = estimateMinutes(origin, it.place);
        travel[k] = { leaveAt: arriveBy.getTime() - m * 60000, arriveAt: arriveBy.getTime(), minutes: m, lines: [], source: 'estimate', ts: now, origin: origin.label };
      }
    }
    // drop stale entries
    for (const k of Object.keys(travel)) if (now - travel[k].ts > 36 * 3600000) delete travel[k];
    return travel;
  }

  // Things you have to travel to: class meetings and exams, soonest first.
  function upcomingTargets(state, answers, now, horizonH) {
    const until = new Date(now + horizonH * 3600000);
    const occ = occurrences(state, answers, new Date(now), until)
      .filter(o => !o.cancelled && o.end.getTime() > now && o.start.getTime() < until.getTime());
    // With an unanswered group, plan for the earlier option only.
    const seen = new Set();
    const list = [];
    for (const o of occ) {
      if (o.pending) { const k = o.course.group.set + '|' + o.date; if (seen.has(k)) continue; seen.add(k); }
      list.push({ id: o.id, kind: 'class', title: o.course.title + (o.course.type ? ' · ' + o.course.type : ''), start: o.start, room: o.room, place: placeOf(state, o.course), pending: o.pending, occ: o });
    }
    for (const ex of state.exams) {
      if (!ex.date || !ex.time) continue;
      const s = at(ex.date, ex.time);
      if (s.getTime() > now && s < until) list.push({ id: 'exam:' + ex.id, kind: 'exam', title: 'Exam: ' + ex.title, start: s, room: ex.room || '', place: placeOf(state, ex) });
    }
    return list.sort((a, b) => a.start - b.start);
  }

  function travelFor(state, travel, loc, now, item) {
    const origin = currentOrigin(state, loc, now);
    if (!origin) return null;
    const hit = travel[item.id + '@' + origin.key];
    if (hit) return hit;
    // fall back to any cached result for this meeting, then to an estimate
    const any = Object.keys(travel).find(k => k.startsWith(item.id + '@'));
    if (any) return travel[any];
    const m = estimateMinutes(origin, item.place);
    const arriveBy = item.start.getTime() - state.settings.bufferMin * 60000;
    return { leaveAt: arriveBy - m * 60000, minutes: m, lines: [], source: 'estimate', origin: origin.label };
  }

  // ---------- Alerts ----------
  function alertsDue(state, answers, travel, loc, now) {
    const s = state.settings;
    const due = [];
    for (const it of upcomingTargets(state, answers, now, 18)) {
      const tr = travelFor(state, travel, loc, now, it);
      const leave = tr ? tr.leaveAt : it.start.getTime() - (30 + s.bufferMin) * 60000;
      const where = it.room ? it.room + ' · ' : '';
      const how = tr ? (tr.minutes + ' min by ' + (tr.source === 'bvg' ? (tr.lines.length ? tr.lines.join(' → ') : 'transit') : 'transit (estimate)') + ' from ' + tr.origin) : 'Add your address in Settings for travel times';
      const grp = it.pending ? ' Group not chosen yet.' : '';
      const stages = [
        { k: 'first', at: leave - s.leadFirst * 60000, title: 'Leave in ' + s.leadFirst + ' min · ' + it.title, body: 'Starts ' + hm(it.start) + ' · ' + where + how + '.' + grp },
        { k: 'second', at: leave - s.leadSecond * 60000, title: 'Leave in ' + s.leadSecond + ' min · ' + it.title, body: 'Starts ' + hm(it.start) + ' · ' + where + how + '.' + grp },
        { k: 'now', at: leave, title: 'Leave now · ' + it.title, body: 'You need to leave now to reach ' + (it.room || it.place.name) + ' by ' + hm(it.start) + '. ' + how + '.', urgent: true }
      ];
      for (const st of stages) {
        if (st.at <= now && now - st.at < 20 * 60000 && it.start.getTime() > now) {
          due.push({ key: it.id + '|' + st.k, title: st.title, body: st.body, tag: it.id, urgent: !!st.urgent, url: './#today' });
        }
      }
    }
    // Group question the evening before
    const tomorrow = ymd(addDays(new Date(now), 1));
    const askAt = at(ymd(new Date(now)), s.groupAskTime).getTime();
    if (now >= askAt) {
      const occ = occurrences(state, answers, parseYmd(tomorrow), parseYmd(tomorrow), { allGroups: true });
      const sets = {};
      for (const o of occ) if (o.course.group && !(answers || {})[o.course.group.set + '|' + tomorrow]) {
        (sets[o.course.group.set] = sets[o.course.group.set] || []).push(o);
      }
      for (const setId of Object.keys(sets)) {
        const opts = sets[setId].sort((a, b) => a.start - b.start);
        const dflt = state.groupDefault[setId];
        due.push({
          key: 'gq|' + setId + '|' + tomorrow, tag: 'gq-' + setId,
          title: 'Which group tomorrow? ' + GROUP_SETS[setId].name,
          body: opts.map(o => 'Group ' + o.course.group.option + ': ' + hm(o.start) + '–' + hm(o.end) + ' ' + o.room).join(' · ') + (dflt ? ' (default ' + dflt + ')' : ''),
          actions: opts.slice(0, 2).map(o => ({ action: 'grp:' + setId + '|' + tomorrow + '|' + o.course.group.option, title: 'Group ' + o.course.group.option + ' · ' + hm(o.start) })),
          url: './#today'
        });
      }
      // Exam tomorrow
      for (const ex of state.exams) if (ex.date === tomorrow && now >= at(ymd(new Date(now)), s.examEveTime).getTime()) {
        due.push({ key: 'exeve|' + ex.id, tag: 'exam-' + ex.id, title: 'Exam tomorrow: ' + ex.title, body: (ex.time || '') + ' ' + (ex.room || ''), url: './#exams' });
      }
    }
    return due;
  }

  // ---------- Storage (IndexedDB, shared by page and service worker) ----------
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('tu-timetable', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function kvGet(key) {
    const d = await db();
    return new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  }
  async function kvSet(key, val) {
    const d = await db();
    return new Promise((res, rej) => { const tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  }
  async function loadAll() {
    const [state, answers, travel, fired, loc] = await Promise.all(['state', 'answers', 'travel', 'fired', 'loc'].map(kvGet));
    return { state: migrate(state), answers: answers || {}, travel: travel || {}, fired: fired || {}, loc: loc || null };
  }
  function migrate(s) {
    const d = defaultState();
    if (!s) return d;
    s.settings = Object.assign({}, d.settings, s.settings || {});
    s.overrides = s.overrides || {}; s.groupDefault = s.groupDefault || {}; s.exams = s.exams || [];
    s.addresses = s.addresses && s.addresses.length ? s.addresses : d.addresses;
    return s;
  }
  async function setAnswer(setId, dateStr, option) {
    const a = (await kvGet('answers')) || {};
    if (option) a[setId + '|' + dateStr] = option; else delete a[setId + '|' + dateStr];
    await kvSet('answers', a);
    return a;
  }
  async function markFired(keys) {
    const f = (await kvGet('fired')) || {};
    const now = Date.now();
    keys.forEach(k => { f[k] = now; });
    for (const k of Object.keys(f)) if (now - f[k] > 3 * 86400000) delete f[k];
    await kvSet('fired', f);
    return f;
  }

  // One pass: refresh travel, find due alerts not yet shown. Caller displays them.
  async function tick(showFn, locOverride) {
    const all = await loadAll();
    const now = Date.now();
    const loc = locOverride || all.loc;
    const travel = await refreshTravel(all.state, all.answers, all.travel, loc, now);
    await kvSet('travel', travel);
    if (!all.state.settings.notify) return [];
    const fired = (await kvGet('fired')) || {};
    const due = alertsDue(all.state, all.answers, travel, loc, now).filter(a => !fired[a.key]);
    if (due.length) {
      await markFired(due.map(a => a.key));
      for (const a of due) await showFn(a);
    }
    return due;
  }

  // ---------- Calendar export (.ics) ----------
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function icsLocal(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00'; }
  const VTZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE'];

  // travelMin: { placeKey -> minutes } from the default address.
  function buildICS(state, answers, travelMin, fromDate) {
    const s = state.settings;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TU Timetable//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:TU Berlin ' + TERM.name, ...VTZ];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const alarms = (mins, label) => {
      const out = [];
      [[mins + s.leadFirst, 'Leave in ' + s.leadFirst + ' min'], [mins + s.leadSecond, 'Leave in ' + s.leadSecond + ' min'], [mins, 'Leave now']].forEach(([m, t]) => {
        out.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(t + ' · ' + label), 'TRIGGER:-PT' + Math.max(0, Math.round(m)) + 'M', 'END:VALARM');
      });
      return out;
    };
    let skipped = 0;
    const occ = occurrences(state, answers, fromDate || parseYmd(TERM.lectureStart), parseYmd(TERM.lectureEnd));
    for (const o of occ) {
      if (o.cancelled) continue;
      if (o.pending) { skipped++; continue; }
      const p = placeOf(state, o.course);
      const tm = (travelMin[o.course.building === 'OTHER' ? 'OTHER:' + o.course.id : o.course.building] || 30) + s.bufferMin;
      const label = o.course.title + ' · ' + o.course.type;
      lines.push('BEGIN:VEVENT', 'UID:' + o.id.replace('|', '-') + '@tu-timetable', 'DTSTAMP:' + stamp,
        'DTSTART;TZID=Europe/Berlin:' + icsLocal(o.start), 'DTEND;TZID=Europe/Berlin:' + icsLocal(o.end),
        'SUMMARY:' + icsEsc(label), 'LOCATION:' + icsEsc(o.room + ', ' + p.address),
        'DESCRIPTION:' + icsEsc((o.course.lecturer || '') + (o.course.group ? '\nGroup ' + o.course.group.option : '') + '\nTravel from default address ≈ ' + (tm - s.bufferMin) + ' min'),
        ...alarms(tm, label), 'END:VEVENT');
    }
    for (const ex of state.exams) {
      if (!ex.date || !ex.time) continue;
      const st = at(ex.date, ex.time);
      const en = new Date(st.getTime() + (Number(ex.duration) || 120) * 60000);
      const p = placeOf(state, ex);
      const tm = (travelMin['exam:' + ex.id] || travelMin[ex.building] || 30) + s.bufferMin;
      lines.push('BEGIN:VEVENT', 'UID:exam-' + ex.id + '@tu-timetable', 'DTSTAMP:' + stamp,
        'DTSTART;TZID=Europe/Berlin:' + icsLocal(st), 'DTEND;TZID=Europe/Berlin:' + icsLocal(en),
        'SUMMARY:' + icsEsc('Exam: ' + ex.title), 'LOCATION:' + icsEsc((ex.room || '') + ', ' + p.address),
        'DESCRIPTION:' + icsEsc(ex.notes || ''), ...alarms(tm, 'Exam: ' + ex.title),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('Exam tomorrow: ' + ex.title), 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // fold long lines
    const folded = lines.map(l => { let out = ''; while (l.length > 74) { out += l.slice(0, 74) + '\r\n '; l = l.slice(74); } return out + l; });
    return { text: folded.join('\r\n') + '\r\n', skipped };
  }

  function mapsUrl(place) {
    const dest = place.lat != null ? place.lat + ',' + place.lng : encodeURIComponent(place.address || place.name);
    return 'https://www.google.com/maps/dir/?api=1&destination=' + dest + '&travelmode=transit';
  }

  root.Engine = {
    TERM, BUILDINGS, GROUP_SETS, SEED_COURSES, defaultState, migrate,
    ymd, parseYmd, at, addDays, mondayOf, inBreak, hm, pad,
    occurrences, placeOf, upcomingTargets, travelFor, refreshTravel, currentOrigin, estimateMinutes, bvgJourney, geocode,
    alertsDue, tick, kvGet, kvSet, loadAll, setAnswer, markFired, buildICS, mapsUrl, groupChoiceFor
  };
})(typeof self !== 'undefined' ? self : globalThis);
