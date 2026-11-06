/* Mensa picks: score the day's dishes for protein, health, price and pork. Pure functions, no DOM.
   The Studierendenwerk publishes a traffic light (green/yellow/red) and additive codes (2 = pork or pork gelatine)
   but no protein values, so protein is estimated from the dish name. */
(function (root) {
  'use strict';

  const PORK_SURE = /schwein|speck|schinken|bacon|salami|kass?ler|kasseler|leberk[äa]se|\bmett\b|pancetta|spanferkel|eisbein|haxe|leberwurst|blutwurst|krakauer|lardo/i;
  // Usually pork in Germany unless another animal or "vegan" is named.
  const PORK_LIKELY = /bratwurst|currywurst|bockwurst|wiener|frikadelle|bulette|boulette|hackbraten|cevapcici|[cć]evap|gyros|jägerschnitzel|schnitzel wiener art|zigeuner|würstchen|wurst|hackfleisch|\bhack\b|gelatine/i;
  const NOT_PORK = /vegan|vegetar|veggie|rind|kalb|lamm|h[äa]hnchen|huhn|gefl[üu]gel|pute|puten|truthahn|soja|tofu|seitan|fisch|lachs/i;

  const HIGH = [
    [/h[äa]hnchen|huhn|gefl[üu]gel|pute|puten|truthahn/i, 'poultry'],
    [/rind|kalb|lamm|steak/i, 'beef or lamb'],
    [/fisch|lachs|seelachs|kabeljau|dorsch|thunfisch|forelle|hering|makrele|alaska|garnele|scampi|pangasius|zander|hoki|tilapia|matjes/i, 'fish'],
    [/tofu|seitan|tempeh|soja|lupine/i, 'tofu or soy'],
    [/schwein|bratwurst|currywurst|frikadelle|hack|gyros|schnitzel|cevapcici/i, 'meat']
  ];
  const MEDIUM = [
    [/linsen|kichererbse|\bdal\b|falafel|bohnen|edamame|hummus|erbsen/i, 'legumes'],
    [/\bei\b|eier|omelett|r[üu]hrei|spiegelei|frittata|shakshuka/i, 'eggs'],
    [/quark|skyr|h[üu]ttenk[äa]se|joghurt|halloumi|feta|paneer|mozzarella|gratin|überbacken|käse/i, 'dairy']
  ];
  const FRIED = /frittiert|pommes|paniert|gebacken|backfisch|nuggets|chicken wings|burger|pizza|sahne|rahm|käsesoße|currywurst|schoko|pudding|kuchen|crumble/i;
  const VEG = /gemüse|spinat|brokkoli|broccoli|salat|bohnen|erbsen|karotte|möhre|zucchini|paprika|kohl|linsen|kichererbse|tomate|ratatouille|kürbis/i;
  const SIDE_CAT = /beilage/i, DESSERT_CAT = /dessert|nachspeise|nachtisch/i, SKIP_CAT = /getränk|drink/i;
  const EXTRA = /dressing|vinaigrette|sauce|soße|dip|extra|gerieben|topping|brot\b|brötchen/i;

  function notesText(m) { return (m.notes || []).join(' | '); }
  function priceOf(m) { const p = m.prices || {}; return p.students != null ? p.students : p.employees != null ? p.employees : null; }

  // 'yes' (labelled or named), 'maybe' (sausage, mince… with no other animal named), 'no'
  function porkOf(m) {
    const n = m.name || '', t = notesText(m);
    if (/schwein/i.test(t)) return 'yes';
    if (/vegan|vegetar/i.test(t)) return 'no';
    if (PORK_SURE.test(n)) return 'yes';
    if (PORK_LIKELY.test(n) && !NOT_PORK.test(n)) return 'maybe';
    return 'no';
  }
  function proteinOf(m) {
    const n = m.name || '';
    for (const [re, why] of HIGH) if (re.test(n)) return { level: 3, label: 'High protein', why };
    for (const [re, why] of MEDIUM) if (re.test(n)) return { level: 2, label: 'Some protein', why };
    return { level: 0, label: 'Low protein', why: '' };
  }
  // Traffic light from the labels when present, otherwise a guess from the name.
  function healthOf(m) {
    const t = notesText(m).toLowerCase();
    if (/grün|gruen|\bgreen\b|ampel.?g/.test(t)) return { level: 2, label: 'Green light', from: 'label' };
    if (/gelb|yellow|ampel.?y/.test(t)) return { level: 1, label: 'Yellow light', from: 'label' };
    if (/\brot\b|\bred\b|ampel.?r/.test(t)) return { level: 0, label: 'Red light', from: 'label' };
    const n = m.name || '';
    if (FRIED.test(n)) return { level: 0, label: 'Rich or fried', from: 'name' };
    if (VEG.test(n)) return { level: 2, label: 'Plenty of veg', from: 'name' };
    return { level: 1, label: '', from: 'name' };
  }
  function kindOf(m) {
    const c = m.category || '', n = m.name || '', p = priceOf(m);
    if (SKIP_CAT.test(c) || p == null) return 'skip';
    if (EXTRA.test(n) && p < 1.5) return 'extra';
    if (DESSERT_CAT.test(c)) return 'dessert';
    if (SIDE_CAT.test(c)) return 'side';
    if (/salat/i.test(c) && /kleine|schale/i.test(n)) return 'side';
    return 'main';
  }

  const DEFAULT_PREFS = { noPork: false, protein: true, healthy: true, cheap: true };

  function score(m, prefs) {
    const pr = proteinOf(m), he = healthOf(m), p = priceOf(m);
    const cheap = p == null ? 0 : p <= 2 ? 2 : p <= 3 ? 1.2 : p <= 4 ? 0.4 : -0.8;
    let s = 1;
    if (prefs.protein) s += pr.level * 2.2;
    if (prefs.healthy) s += he.level * 1.3;
    if (prefs.cheap) s += cheap * 1.2;
    return s;
  }

  // Returns { pick, plate:[...], total, also:[...], skipped } or null when nothing fits.
  function recommend(meals, prefs) {
    prefs = Object.assign({}, DEFAULT_PREFS, prefs || {});
    const all = meals.map(m => ({ m, kind: kindOf(m), pork: porkOf(m), protein: proteinOf(m), health: healthOf(m), price: priceOf(m) }));
    const allowed = x => !prefs.noPork || x.pork === 'no';
    const skipped = prefs.noPork ? all.filter(x => x.kind !== 'skip' && x.pork !== 'no').length : 0;
    const mains = all.filter(x => x.kind === 'main' && allowed(x)).map(x => Object.assign(x, { score: score(x.m, prefs) })).sort((a, b) => b.score - a.score);
    if (!mains.length) return { pick: null, plate: [], total: 0, also: [], skipped };
    const pick = mains[0];
    const plate = [pick];
    // A vegetable side when the main has little veg; a protein dessert when protein is the goal and the main is light on it.
    const sides = all.filter(x => x.kind === 'side' && allowed(x)).sort((a, b) => (b.health.level - a.health.level) || ((a.price || 9) - (b.price || 9)));
    if (sides.length && !(VEG.test(pick.m.name) && pick.health.level >= 2)) {
      const veg = sides.find(x => VEG.test(x.m.name) && x.health.level >= 2) || sides[0];
      if (veg) plate.push(Object.assign(veg, { role: 'side' }));
    }
    if (prefs.protein && pick.protein.level < 3) {
      const pd = all.filter(x => x.kind === 'dessert' && allowed(x) && /quark|skyr|joghurt/i.test(x.m.name)).sort((a, b) => (b.health.level - a.health.level) || ((a.price || 9) - (b.price || 9)))[0];
      if (pd) plate.push(Object.assign(pd, { role: 'protein' }));
    }
    const total = plate.reduce((t, x) => t + (x.price || 0), 0);
    return { pick, plate, total, also: mains.slice(1, 3), skipped };
  }

  function reasons(x, prefs) {
    const r = [];
    if (x.protein.level) r.push(x.protein.label + (x.protein.why ? ' · ' + x.protein.why : ''));
    else if (prefs && prefs.protein) r.push('Low protein');
    if (x.health.label) r.push(x.health.label);
    if (prefs && prefs.noPork) r.push('No pork');
    return r;
  }

  root.Food = { recommend, reasons, porkOf, proteinOf, healthOf, kindOf, priceOf, DEFAULT_PREFS };
})(typeof self !== 'undefined' ? self : globalThis);
