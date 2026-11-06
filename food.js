/* Mensa picks: score the day's dishes for protein, health, price and pork. Pure functions, no DOM.
   The Studierendenwerk publishes a traffic light (green/yellow/red) and additive codes (2 = pork or pork gelatine)
   but no protein values, so protein is estimated from the dish name. */
(function (root) {
  'use strict';

  const PORK_SURE = /schwein|speck|schinken|bacon|salami|kass?ler|kasseler|leberk[äa]se|\bmett\b|pancetta|spanferkel|eisbein|haxe|leberwurst|blutwurst|krakauer|lardo/i;
  // Usually pork in Germany unless another animal or "vegan" is named.
  const PORK_LIKELY = /bratwurst|currywurst|bockwurst|wiener|frikadelle|bulette|boulette|hackbraten|cevapcici|[cć]evap|gyros|jägerschnitzel|schnitzel wiener art|zigeuner|würstchen|wurst|hackfleisch|\bhack\b|gelatine/i;
  const NOT_PORK = /vegan|vegetar|veggie|rind|kalb|lamm|h[äa]hnchen|huhn|gefl[üu]gel|pute|puten|truthahn|soja|tofu|seitan|fisch|lachs/i;

  // [pattern, label, animal]
  const HIGH = [
    [/h[äa]hnchen|huhn|gefl[üu]gel|pute|puten|truthahn/i, 'poultry', true],
    [/rind|kalb|lamm|steak/i, 'beef or lamb', true],
    [/fisch|lachs|seelachs|kabeljau|dorsch|thunfisch|forelle|hering|makrele|alaska|garnele|scampi|pangasius|zander|hoki|tilapia|matjes/i, 'fish', true],
    [/schwein|bratwurst|currywurst|frikadelle|hack|gyros|schnitzel|cevapcici/i, 'meat', true],
    [/tofu|seitan|tempeh|soja|lupine/i, 'tofu or soy', false]
  ];
  const MEDIUM = [
    [/linsen|kichererbse|\bdal\b|falafel|bohnen|edamame|hummus|erbsen/i, 'legumes'],
    [/\bei\b|eier|omelett|r[üu]hrei|spiegelei|frittata|shakshuka/i, 'eggs'],
    [/quark|skyr|h[üu]ttenk[äa]se|joghurt|halloumi|feta|paneer|mozzarella|gratin|überbacken|käse/i, 'dairy']
  ];
  const FRIED = /frittiert|pommes|paniert|gebacken|backfisch|nuggets|chicken wings|burger|pizza|sahne|rahm|käsesoße|currywurst|schoko|pudding|kuchen|crumble/i;
  const VEG = /gemüse|spinat|brokkoli|broccoli|salat|bohnen|erbsen|karotte|möhre|zucchini|paprika|kohl|linsen|kichererbse|tomate|ratatouille|kürbis/i;
  const SOUP_CAT = /suppe|eintopf/i, SIDE_CAT = /beilage/i, DESSERT_CAT = /dessert|nachspeise|nachtisch/i, SKIP_CAT = /getränk|drink/i;
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
    for (const [re, why, animal] of HIGH) if (re.test(n)) return { level: 3, label: 'High protein', why, animal };
    for (const [re, why] of MEDIUM) if (re.test(n)) return { level: 2, label: 'Some protein', why, animal: why !== 'legumes' };
    return { level: 0, label: 'Low protein', why: '', animal: false };
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
    if (SOUP_CAT.test(c) || /suppe\b|suppe$|eintopf/i.test(n)) return 'soup';
    if (SIDE_CAT.test(c)) return 'side';
    if (/salat/i.test(c) && /kleine|schale/i.test(n)) return 'side';
    return 'main';
  }

  const DEFAULT_PREFS = { noPork: true, protein: true };

  // Value for money: protein points per euro. Animal protein counts a little extra; prices under 2 € count as 2 €
  // so a small soup or side does not beat a full plate.
  function score(x, prefs) {
    const price = Math.max(x.price || 2, 2);
    if (!prefs.protein) return -price;
    const pts = x.protein.level + (x.protein.animal && x.protein.level >= 2 ? 1 : 0);
    return pts / price;
  }

  const norm = n => String(n || '').toLowerCase().replace(/[^a-zäöüß]+/g, ' ').trim();
  // Returns { pick, plate:[main, soup?, dessert?], total, also:[...], skipped }.
  // prefs.liked: dish names you liked; they move up the next time they are on the menu.
  function recommend(meals, prefs) {
    prefs = Object.assign({}, DEFAULT_PREFS, prefs || {});
    const liked = new Set((prefs.liked || []).map(norm));
    const all = meals.map(m => ({ m, kind: kindOf(m), pork: porkOf(m), protein: proteinOf(m), health: healthOf(m), price: priceOf(m), liked: liked.has(norm(m.name)) }));
    const allowed = x => !prefs.noPork || x.pork === 'no';
    const skipped = prefs.noPork ? all.filter(x => x.kind !== 'skip' && x.pork !== 'no').length : 0;
    const mains = all.filter(x => x.kind === 'main' && allowed(x)).map(x => Object.assign(x, { score: score(x, prefs) + (x.liked ? 0.4 : 0) }))
      .sort((a, b) => (b.score - a.score) || ((a.price || 9) - (b.price || 9)));
    if (!mains.length) return { pick: null, plate: [], total: 0, also: [], skipped };
    const pick = mains[0];
    const plate = [pick];
    // Soup: one you liked, then the most protein, then the cheapest.
    const soup = all.filter(x => x.kind === 'soup' && allowed(x))
      .sort((a, b) => (b.liked - a.liked) || (b.protein.level - a.protein.level) || ((a.price || 9) - (b.price || 9)))[0];
    if (soup) plate.push(Object.assign(soup, { role: 'soup' }));
    // Dessert: one you liked, then quark/skyr/yoghurt when protein matters, then the traffic light, then price.
    const protDessert = x => (prefs.protein && /quark|skyr|joghurt|pudding.*protein|protein/i.test(x.m.name)) ? 1 : 0;
    const dessert = all.filter(x => x.kind === 'dessert' && allowed(x))
      .sort((a, b) => (b.liked - a.liked) || (protDessert(b) - protDessert(a)) || (b.health.level - a.health.level) || ((a.price || 9) - (b.price || 9)))[0];
    if (dessert) plate.push(Object.assign(dessert, { role: 'dessert' }));
    const total = plate.reduce((t, x) => t + (x.price || 0), 0);
    const also = mains.slice(1).filter(x => !prefs.protein || x.protein.level >= 2).slice(0, 2);
    return { pick, plate, total, also, skipped };
  }

  function reasons(x, prefs) {
    const r = [];
    if (x.protein.level) r.push(x.protein.label + (x.protein.why ? ' · ' + x.protein.why : ''));
    else r.push('Low protein');
    if (prefs && prefs.protein && x.protein.level >= 2 && x.price != null && x.price <= 3) r.push('Good value');
    if (prefs && prefs.noPork) r.push('No pork');
    return r;
  }

  root.Food = { norm, recommend, reasons, porkOf, proteinOf, healthOf, kindOf, priceOf, DEFAULT_PREFS };
})(typeof self !== 'undefined' ? self : globalThis);
