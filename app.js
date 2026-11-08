/*
 * 露營裝備清單｜互動邏輯
 * 不需要後端：分工（成員名單、認領、備妥）和個人勾選都存在瀏覽器 localStorage。
 * 分享連結把分工編碼在網址 # 後面（不會傳到伺服器），朋友打開連結就會載入同一份分工。
 */
(() => {
  'use strict';

  const D = window.CAMP_DATA;
  const app = document.getElementById('camp-app');
  if (!app) return;
  if (!D) { app.textContent = '讀不到 data.js，請確認 data.js 和 index.html 放在同一個資料夾。'; return; }

  /* ---------- 清單資料 ---------- */
  const PEOPLE = Math.max(1, Math.min(10, parseInt(D.people, 10) || 6));
  const TENTS = parseInt(D.tents, 10) || 0;
  const TITLE = D.title || '露營裝備清單';
  const TEAM = TITLE.replace(/清單$/, '') + '分工';
  const SHARED = (D.shared || []).map(o => Object.assign({}, o, { kind: 'shared' }));
  const COOK = (D.cook || []).map(o => Object.assign({}, o, { kind: 'cook' }));
  const ME = (D.me || []).map(o => Object.assign({}, o, { kind: 'me' }));
  const ASKS = (D.asks || []).slice();
  const ALL = SHARED.concat(COOK);
  const ITEM = {};
  SHARED.concat(COOK, ME).forEach(o => { ITEM[o.id] = o; });
  const ASK_IDS = new Set(ASKS.map(a => a.id));
  const TAGC = { '炊具': 'pot', '備料': 'prep', '清潔': 'wash' };
  const TAGS = (D.tags && D.tags.length) ? D.tags : ['#露營'];
  const STICKERS = (D.stickers && D.stickers.length) ? D.stickers : [PEOPLE + ' 人小隊', TENTS + ' 頂帳篷', '出發囉'];
  const PCOL = [
    ['var(--coral)', '#ffffff'], ['var(--lake)', 'var(--ink)'], ['var(--leaf)', 'var(--ink)'], ['var(--sky)', '#ffffff'], ['var(--pink)', '#ffffff'],
    ['var(--orange)', 'var(--ink)'], ['var(--sun)', 'var(--ink)'], ['var(--pine)', '#ffffff'], ['var(--dusk)', '#ffffff'], ['var(--night)', '#ffffff']
  ];
  /* 同一個 github.io 網域下的其他專案共用 localStorage，所以用網址路徑區分 */
  const NS = 'camp:' + location.pathname + ':';
  const KEY_SHARED = NS + 'shared-v1', KEY_ME = NS + 'me-v1', KEY_SENT = NS + 'sent-v1';

  /* ---------- 小工具 ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rich = s => esc(s || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const plain = s => String(s || '').replace(/\*\*/g, '');
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pad = n => String(n).padStart(2, '0');
  const fmt = ts => { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 無法儲存時只留在這次瀏覽 */ } }
  };
  const b64e = str => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const b64d = s => {
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    const bin = atob(t), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  /* ---------- 狀態 ---------- */
  function normalize(src) {
    const o = { v: 1, roster: Array(PEOPLE).fill(''), who: {}, done: {}, updated: 0 };
    if (!src || typeof src !== 'object') return o;
    if (Array.isArray(src.roster)) for (let i = 0; i < PEOPLE; i++) o.roster[i] = typeof src.roster[i] === 'string' ? src.roster[i].slice(0, 10) : '';
    if (src.who && typeof src.who === 'object') Object.keys(src.who).forEach(k => {
      if (!ITEM[k] || ITEM[k].kind === 'me' || !Array.isArray(src.who[k])) return;
      const w = Array.from(new Set(src.who[k].filter(n => Number.isInteger(n) && n >= -1 && n < PEOPLE))).sort((a, b) => a - b);
      if (w.length) o.who[k] = w.includes(-1) ? [-1] : w;
    });
    if (src.done && typeof src.done === 'object') Object.keys(src.done).forEach(k => {
      if (src.done[k] === true && ((ITEM[k] && ITEM[k].kind !== 'me') || ASK_IDS.has(k))) o.done[k] = true;
    });
    if (typeof src.updated === 'number' && isFinite(src.updated)) o.updated = src.updated;
    return o;
  }
  function sig(s) {
    const w = {};
    Object.keys(s.who).sort().forEach(k => { w[k] = s.who[k]; });
    return JSON.stringify([s.roster, w, Object.keys(s.done).sort()]);
  }
  const hasContent = s => s.roster.some(n => n.trim()) || Object.keys(s.who).length > 0 || Object.keys(s.done).length > 0;

  let S = normalize(store.get(KEY_SHARED, null));
  let MINE = store.get(KEY_ME, {});
  if (!MINE || typeof MINE !== 'object' || Array.isArray(MINE)) MINE = {};
  let sentSig = store.get(KEY_SENT, null);
  if (typeof sentSig !== 'string') sentSig = sig(normalize(null));
  let F = null, copyTab = 'team', sheetCtx = null, lastFocus = null, closeT = 0;
  const rowEls = {};

  /* ---------- 圖示與插圖 ---------- */
  const IC = {
    tent: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 20.5 12 4l9.5 16.5Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 20.5V15l-3.4 5.5M12 15l3.4 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    bag: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0V21h-11Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.5 4.5h5M9.5 14h5v4h-5Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    people: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.8c1.9.7 3.1 2.4 3.5 5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    x: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>'
  };
  const FIRE = gid => '<g class="fire"><ellipse class="glow" cx="0" cy="-6" rx="58" ry="22" fill="url(#' + gid + ')"/><path class="fl" d="M0-46c12 14 17 23 10 35-3 6-17 6-20 0C-17-23-11-32 0-46Z" fill="#ffd23f"/><path class="fl f2" d="M-1-32c8 9 10 15 5 22-2 4-10 4-12 0-4-7 1-13 7-22Z" fill="#ff7a3c"/><path d="M-26 3 24-9M-26-9 24 3" stroke="#6e3b1f" stroke-width="7" stroke-linecap="round"/></g>';
  const GLOW = id => '<radialGradient id="' + id + '"><stop offset="0" stop-color="#ffd23f" stop-opacity=".95"/><stop offset=".5" stop-color="#ff9a3c" stop-opacity=".45"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>';
  const SCENE = '<svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" focusable="false">'
    + '<defs><radialGradient id="g-sun" cx="50%" cy="42%" r="58%"><stop offset="0" stop-color="#fffbe2"/><stop offset=".55" stop-color="#ffe680"/><stop offset="1" stop-color="#ffd23f"/></radialGradient>' + GLOW('g-glow')
    + '<symbol id="pine" viewBox="0 0 40 70"><path d="M20 0 33 22h-6l10 19h-7l10 21H0l10-21H3l10-19H7Z"/><path d="M17 61h6v9h-6Z"/></symbol></defs>'
    + '<g class="l-sun"><g class="sun-in"><circle cx="770" cy="148" r="74" fill="url(#g-sun)"/></g></g>'
    + '<g class="l-far"><path fill="#b4497c" d="M0 196 90 150 170 172 262 108 352 158 446 102 552 166 648 118 756 160 858 92 958 146 1060 110 1200 158V300H0Z"/></g>'
    + '<g class="l-mid" fill="#5b2d6b"><path d="M0 226 118 178 226 206 338 160 466 214 594 166 716 218 846 170 978 214 1098 180 1200 204V300H0Z"/>'
    + '<use href="#pine" x="196" y="168" width="24" height="42"/><use href="#pine" x="222" y="176" width="18" height="32"/><use href="#pine" x="900" y="172" width="24" height="42"/><use href="#pine" x="926" y="182" width="18" height="32"/><use href="#pine" x="1010" y="176" width="22" height="38"/></g>'
    + '<g class="l-front" fill="#163232"><path fill="#1f3c3c" d="M0 252 140 236 300 244 470 240 640 243 800 236 980 246 1200 238V300H0Z"/>'
    + '<use href="#pine" x="40" y="198" width="30" height="52"/><use href="#pine" x="78" y="212" width="22" height="38"/><use href="#pine" x="318" y="196" width="28" height="50"/><use href="#pine" x="350" y="210" width="20" height="35"/><use href="#pine" x="384" y="202" width="24" height="42"/><use href="#pine" x="812" y="190" width="30" height="52"/><use href="#pine" x="846" y="206" width="22" height="38"/><use href="#pine" x="878" y="198" width="26" height="46"/><use href="#pine" x="1090" y="194" width="30" height="52"/><use href="#pine" x="1126" y="208" width="22" height="38"/>'
    + '<g transform="translate(470 241)"><path d="M0-50 46 0H-46Z" fill="#e0452f"/><path d="M0-50 13 0H-13Z" fill="#9f2a1b"/><path d="M0-50 46 0" stroke="#15171a" stroke-width="3" fill="none"/></g>'
    + '<g transform="translate(575 242)"><path d="M0-38 36 0H-36Z" fill="#ffd23f"/><path d="M0-38 10 0H-10Z" fill="#c98a12"/></g>'
    + '<path d="M724 244V196M724 198h14" stroke="#163232" stroke-width="4" fill="none" stroke-linecap="round"/><circle class="glow" cx="738" cy="212" r="30" fill="url(#g-glow)"/><rect x="732" y="203" width="12" height="17" rx="3" fill="#fff3b0"/>'
    + '<g transform="translate(660 246)">' + FIRE('g-glow') + '</g></g></svg>';

  /* ---------- 版面 ---------- */
  function rowHTML(it) {
    const tag = it.tag ? '<span class="tag tag-' + (TAGC[it.tag] || 'pot') + '">' + esc(it.tag) + '</span>' : '';
    const note = it.note ? '<span class="nt">' + rich(it.note) + '</span>' : '';
    const who = it.kind === 'me' ? '' : '<button type="button" class="who" data-id="' + esc(it.id) + '"></button>';
    return '<li class="row rv ' + it.kind + '" data-id="' + esc(it.id) + '"><label class="hit" for="ck-' + esc(it.id) + '"><input type="checkbox" class="ck-in" id="ck-' + esc(it.id) + '" data-id="' + esc(it.id) + '"><span class="box">' + IC.check + '</span><span class="txt">' + tag + '<span class="nm">' + rich(it.name) + '</span>' + note + '</span></label>' + who + '</li>';
  }

  function appHTML() {
    const tagRun = TAGS.map(t => '<span>' + esc(t) + '</span>').join('');
    const nS = SHARED.length, nC = COOK.length, nM = ME.length, nA = ALL.length;
    const meta = PEOPLE + ' 人' + (TENTS ? '・' + TENTS + ' 帳' : '');
    return `
<nav class="nav" aria-label="頁面導覽"><div class="wrap">
  <a class="brand" href="#top">${IC.tent}<span>露營清單</span></a>
  <div class="nav-links"><a href="#crew">小隊</a><a href="#overview">進度</a><a href="#shared">公共裝備</a><a href="#cook">炊具</a><a href="#me">個人</a><a href="#share">分享</a></div>
  <div class="nav-stats"><a class="stat s-shared" href="#shared" aria-label="公共裝備與炊具已備妥數">${IC.tent}<span id="n-shared">0/${nA}</span></a><a class="stat s-me" href="#me" aria-label="我的行李已打勾數">${IC.bag}<span id="n-me">0/${nM}</span></a></div>
</div></nav>
<header class="hero" id="top">
  <i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><i class="veil"></i>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="tagline enter">CAMPING CHECKLIST · ${PEOPLE} PEOPLE${TENTS ? ' · ' + TENTS + ' TENTS' : ''}</p>
      <h1 class="enter" style="--d:.06s"><span class="big">${esc(TITLE)}</span><span class="name">${esc(D.subtitle || '出發前一起打勾')}</span></h1>
      <p class="lede enter" style="--d:.12s">公共裝備和炊具先分好誰帶，個人行李各自打勾。點成員頭像，就只看那個人負責的東西。</p>
      <div class="cta enter" style="--d:.18s"><a class="btn solid" href="#shared">公共裝備分工</a><a class="btn" href="#me">我的行李</a></div>
    </div>
    <div class="mc-wrap">
      <div class="mc enter">
        <div class="mrow"><span class="mk">公共＋炊具已備妥</span><b class="mv" id="m-done">0/${nA}</b><span class="mbar"><i id="mb-done"></i></span></div>
        <div class="mrow"><span class="mk">已有人認領</span><b class="mv" id="m-claim">0/${nA}</b><span class="mbar"><i id="mb-claim" style="--g:linear-gradient(90deg,var(--sun),var(--orange))"></i></span></div>
        <div class="mrow"><span class="mk">我的行李</span><b class="mv" id="m-me">0/${nM}</b><span class="mbar"><i id="mb-me" style="--g:linear-gradient(90deg,var(--sky),var(--lake))"></i></span></div>
      </div>
      ${STICKERS.slice(0, 3).map((t, i) => '<span class="stk s' + (i + 1) + ' enter" style="--d:' + (.55 + i * .15).toFixed(2) + 's">' + esc(t) + '</span>').join('')}
    </div>
  </div>
  <div class="scene" aria-hidden="true">${SCENE}</div>
</header>
<div class="tagwrap" aria-hidden="true"><div class="tagband"><div class="tagtrack">${tagRun}${tagRun}${tagRun}</div></div></div>
<main>
  <section id="crew" class="band crew fx">
    <canvas class="topo" data-c="#11624a" aria-hidden="true"></canvas>
    <div class="wrap">
      <div class="head rv"><span class="label">CREW · ${PEOPLE}</span><h2>誰帶什麼，<em class="hi">點名字</em>就知道</h2><p class="lead">先幫 ${PEOPLE} 位成員填名字，再到下面每一項按「認領」選人。點頭像可以只看那個人負責的東西。</p></div>
      <div class="rings" id="rings" role="group" aria-label="依成員篩選清單"></div>
      <div class="crew-act"><button type="button" class="btn" id="edit-roster">編輯成員名單</button><span class="hint"><i></i><span>分工存在這台裝置，改完記得傳分享連結</span></span></div>
    </div>
  </section>
  <section id="overview" class="band ov">
    <div class="wrap">
      <div class="head rv"><span class="label">OVERVIEW</span><h2>一眼看<em class="hi">進度</em></h2></div>
      <div class="bento">
        <a class="tile t-leaf span2 rv" href="#shared"><span class="tk">公共裝備・${nS} 樣</span><span class="tb"><span id="t-shared">0</span><small>/${nS} 備妥</small></span><span class="ts" id="t-shared-c">已認領 0/${nS}</span><span class="tbar"><i id="tb-shared"></i></span></a>
        <a class="tile t-sun rv" href="#cook"><span class="tk">炊具・${nC} 樣</span><span class="tb"><span id="t-cook">0</span><small>/${nC}</small></span><span class="ts" id="t-cook-c">已認領 0/${nC}</span><span class="tbar"><i id="tb-cook"></i></span></a>
        <a class="tile t-night rv" href="#me"><span class="tk">我的行李・${nM} 樣</span><span class="tb"><span id="t-me">0</span><small>/${nM}</small></span><span class="ts">只存在這台裝置</span><span class="tbar"><i id="tb-me"></i></span></a>
        ${ASKS.length ? '<div class="tile t-coral span2 ask rv"><span class="tk">出發前先問營區</span><div class="asks" id="asks"></div></div>' : ''}
      </div>
    </div>
  </section>
  <section id="shared" class="band sec-shared fx">
    <div class="deco" aria-hidden="true"><i class="forest f-back"></i><i class="forest f-front"></i></div>
    <div class="wrap">
      <div class="head rv"><span class="label">SHARED GEAR · ${nS}</span><h2>公共<em class="hi">裝備</em></h2><p class="lead">打勾代表已備妥。按右邊「認領」選誰帶，可以選好幾個人。</p></div>
      <div class="secbar rv"><span class="track"><i class="fill" id="sf-shared"></i></span><b id="sb-shared">0/${nS} 備妥</b></div>
      <ul class="list two" id="list-shared">${SHARED.map(rowHTML).join('')}</ul>
      <p class="empty" id="empty-shared" hidden>這一區沒有符合篩選的項目</p>
    </div>
  </section>
  <section id="cook" class="band sec-cook fx">
    <div class="deco" aria-hidden="true"><i class="ember e1"></i><i class="ember e2"></i><i class="ember e3"></i></div>
    <div class="wrap">
      <div class="head rv"><span class="label">KITCHEN · ${nC}</span><h2>炊具<em class="hi">分工</em></h2><p class="lead">卡式爐、瓦斯罐和鍋具依菜單準備。</p></div>
      <div class="secbar rv"><span class="track"><i class="fill" id="sf-cook"></i></span><b id="sb-cook">0/${nC} 備妥</b></div>
      <ul class="list two" id="list-cook">${COOK.map(rowHTML).join('')}</ul>
      <p class="empty" id="empty-cook" hidden>這一區沒有符合篩選的項目</p>
    </div>
  </section>
  <section id="me" class="band sec-me fx">
    <div class="deco" aria-hidden="true"><i class="starfield"></i><i class="moon"></i></div>
    <div class="wrap">
      <div class="head rv"><span class="label">MY BAG · ${nM}</span><h2>個人<em class="hi">要帶什麼</em></h2><p class="lead">每個人自己的清單。勾選只存在你這台裝置，不會跟著分享連結傳出去。</p></div>
      <div class="secbar rv"><span class="track"><i class="fill" id="sf-me"></i></span><b id="sb-me">0/${nM} 打勾</b></div>
      <ul class="list two" id="list-me">${ME.map(rowHTML).join('')}</ul>
      <div class="cheer" id="cheer" hidden>${IC.check}<span>行李到齊，可以出發了</span></div>
    </div>
  </section>
  <section id="share" class="band share">
    <div class="wrap narrow">
      <div class="head rv"><span class="label">SHARE</span><h2>傳給<em class="hi">大家</em></h2><p class="lead">分享連結裡帶著成員名單、認領和備妥狀態，朋友打開就會看到同一份分工。</p></div>
      <div class="link-card rv">
        <div class="link-top"><b>分享連結</b><span id="link-when"></span></div>
        <div class="link-act"><button type="button" class="btn solid" id="link-share" hidden>傳送分享連結</button><button type="button" class="btn" id="link-copy">複製連結</button></div>
        <label class="sr" for="link-out">分享連結網址</label>
        <input id="link-out" type="text" readonly hidden>
        <p class="link-note">有人改了分工，就再傳一次新的連結；最後傳出的那個就是最新版本。</p>
      </div>
      <div class="copy-card rv">
        <div class="seg" role="tablist" aria-label="選擇要複製的內容"><button type="button" role="tab" id="tab-team" aria-selected="true" aria-controls="copy-ta">分工總表</button><button type="button" role="tab" id="tab-me" aria-selected="false" aria-controls="copy-ta">我的行李</button></div>
        <textarea id="copy-ta" readonly rows="10" aria-label="要複製的文字"></textarea>
        <div class="copy-act"><button type="button" class="btn solid" id="copy-btn">複製文字</button><button type="button" class="btn" id="text-share" hidden>用分享選單傳送</button></div>
      </div>
    </div>
  </section>
</main>
<footer class="foot">
  <svg class="ridge" viewBox="0 0 1200 72" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0H1200V24L1104 50 1000 28 884 56 760 22 640 48 520 20 400 52 282 26 160 46 62 24 0 38Z"/></svg>
  <div class="stars" id="stars" aria-hidden="true"></div>
  <div class="wrap foot-in">
    <svg class="fire-s" viewBox="-64 -58 128 76" aria-hidden="true" focusable="false"><defs>${GLOW('g-glow2')}</defs>${FIRE('g-glow2')}</svg>
    <p class="foot-t">${esc(TITLE)}｜${meta}</p>
    <p class="foot-m" id="foot-upd"></p>
    <div class="foot-act"><button type="button" class="btn ghost" id="reset-me">清除我的個人勾選</button><button type="button" class="btn ghost" id="reset-team">清除分工</button></div>
  </div>
</footer>
<div class="dock"><button type="button" class="pill filter-pill" id="filter-pill" hidden></button><button type="button" class="pill send-pill" id="send-pill" hidden><i class="dot"></i><span>分工有修改・傳分享連結給大家</span></button></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<div class="sheet" id="sheet" hidden><div class="scrim" data-close></div><div class="panel" role="dialog" aria-modal="true" aria-labelledby="sheet-t" tabindex="-1"><div class="grab" aria-hidden="true"></div><h3 id="sheet-t"></h3><p class="sheet-s" id="sheet-s"></p><div id="sheet-b"></div><div class="sheet-foot" id="sheet-f"></div></div></div>`;
  }

  /* ---------- 分工查詢 ---------- */
  const dn = i => ((S.roster[i] || '').trim() || '成員' + (i + 1));
  const named = i => !!(S.roster[i] || '').trim();
  const ini = i => { const n = (S.roster[i] || '').trim(); return n ? Array.from(n)[0] : String(i + 1); };
  const avHTML = i => { const c = PCOL[i % PCOL.length]; return '<span class="av" style="--pc:' + c[0] + ';--pf:' + c[1] + '">' + esc(ini(i)) + '</span>'; };
  const whoOf = (id, s) => { const w = (s || S).who[id]; return Array.isArray(w) ? w : []; };
  const claimed = (id, s) => whoOf(id, s).length > 0;
  function matches(id) {
    if (F === null) return true;
    const w = whoOf(id);
    if (F === 'none') return w.length === 0;
    return w.includes(-1) || w.includes(F);
  }
  function whoText(id) {
    const w = whoOf(id);
    if (!w.length) return '未認領';
    if (w.includes(-1)) return '全員各自帶';
    return w.map(dn).join('、');
  }
  function counts(s) {
    const st = s || S;
    return {
      sd: SHARED.filter(i => st.done[i.id]).length,
      cd: COOK.filter(i => st.done[i.id]).length,
      sc: SHARED.filter(i => claimed(i.id, st)).length,
      cc: COOK.filter(i => claimed(i.id, st)).length,
      md: ME.filter(i => MINE[i.id]).length
    };
  }

  /* ---------- 畫面更新 ---------- */
  function setText(sel, v) { const el = $(sel); if (el && el.textContent !== String(v)) el.textContent = v; }
  function setV(sel, v) { const el = $(sel); if (el) el.style.setProperty('--v', Math.max(0, Math.min(1, v || 0)).toFixed(4)); }
  function setHTML(box, h, key) {
    if (!box || box._h === h) return;
    const ae = document.activeElement;
    const k = ae && box.contains(ae) ? ae.getAttribute(key) : null;
    box.innerHTML = h; box._h = h;
    if (k != null) { const n = box.querySelector('[' + key + '="' + k + '"]'); if (n) n.focus({ preventScroll: true }); }
  }

  function updateRow(it) {
    const li = rowEls[it.id];
    if (!li) return;
    const isMe = it.kind === 'me';
    const done = isMe ? !!MINE[it.id] : !!S.done[it.id];
    li.classList.toggle('done', done);
    const inp = li.querySelector('.ck-in');
    inp.checked = done;
    inp.setAttribute('aria-label', plain(it.name) + (isMe ? '，已打勾' : '，已備妥'));
    if (isMe) return;
    const w = whoOf(it.id), btn = li.querySelector('.who');
    let h;
    if (!w.length) h = IC.plus + '<span class="wl">認領</span>';
    else if (w.includes(-1)) h = '<span class="wl all">全員</span>';
    else h = '<span class="avs">' + w.slice(0, 3).map(avHTML).join('') + '</span><span class="wl">' + esc(w.length === 1 ? dn(w[0]) : dn(w[0]) + ' +' + (w.length - 1)) + '</span>';
    if (btn._h !== h) { btn.innerHTML = h; btn._h = h; }
    btn.classList.toggle('has', w.length > 0);
    btn.setAttribute('aria-label', plain(it.name) + '，誰帶：' + whoText(it.id) + '，按一下選人');
    li.hidden = !matches(it.id);
  }

  function renderCrew() {
    const cnt = i => ALL.filter(it => { const w = whoOf(it.id); return w.includes(i) || w.includes(-1); }).length;
    const none = ALL.filter(it => !claimed(it.id)).length;
    let h = '<button type="button" class="pp pall" data-f="all" aria-pressed="' + (F === null) + '"><span class="ring"><span class="av">' + IC.people + '</span></span><span class="pn">全部</span></button>';
    for (let i = 0; i < PEOPLE; i++) {
      const c = cnt(i);
      h += '<button type="button" class="pp' + (named(i) ? '' : ' unnamed') + '" data-f="' + i + '" aria-pressed="' + (F === i) + '" aria-label="只看' + esc(dn(i)) + '負責的 ' + c + ' 樣"><span class="ring">' + avHTML(i) + '</span><span class="pn">' + esc(dn(i)) + '</span>' + (c ? '<span class="cnt">' + c + '</span>' : '') + '</button>';
    }
    h += '<button type="button" class="pp pnone" data-f="none" aria-pressed="' + (F === 'none') + '" aria-label="只看還沒人認領的 ' + none + ' 樣"><span class="ring"><span class="av">?</span></span><span class="pn">未認領</span>' + (none ? '<span class="cnt">' + none + '</span>' : '') + '</button>';
    setHTML($('#rings'), h, 'data-f');
  }

  function renderAsks() {
    const box = $('#asks');
    if (!box) return;
    const h = ASKS.map(a => '<button type="button" class="ask-b' + (S.done[a.id] ? ' on' : '') + '" data-ask="' + esc(a.id) + '" aria-pressed="' + !!S.done[a.id] + '"><span class="abox">' + IC.check + '</span><span class="at"><b>' + esc(a.title) + '</b><small>' + esc(a.sub || '') + '</small></span></button>').join('');
    setHTML(box, h, 'data-ask');
  }

  function renderFilterPill() {
    const p = $('#filter-pill');
    if (F === null) { p.hidden = true; return; }
    const n = ALL.filter(it => matches(it.id)).length;
    const label = F === 'none' ? '未認領' : dn(F);
    const h = '<span>只看 <b>' + esc(label) + '</b>・' + n + ' 樣</span><span class="x" aria-hidden="true">' + IC.x + '</span>';
    if (p._h !== h) { p.innerHTML = h; p._h = h; }
    p.setAttribute('aria-label', '目前只看' + label + '，共 ' + n + ' 樣，按一下顯示全部');
    p.hidden = false;
  }

  function teamText() {
    const c = counts(), L = ['⛺ ' + TEAM + '（' + PEOPLE + ' 人' + (TENTS ? '・' + TENTS + ' 帳' : '') + '）'];
    if (S.updated) L.push('更新時間：' + fmt(S.updated));
    L.push('', '【公共裝備】備妥 ' + c.sd + '/' + SHARED.length);
    SHARED.forEach(it => L.push((S.done[it.id] ? '☑ ' : '☐ ') + plain(it.name) + (it.note ? '｜' + plain(it.note) : '') + '｜' + whoText(it.id)));
    L.push('', '【炊具】備妥 ' + c.cd + '/' + COOK.length);
    COOK.forEach(it => L.push((S.done[it.id] ? '☑ ' : '☐ ') + (it.tag ? it.tag + '：' : '') + plain(it.name) + (it.note ? '｜' + plain(it.note) : '') + '｜' + whoText(it.id)));
    if (ASKS.length) {
      L.push('', '【出發前先問營區】');
      ASKS.forEach(a => L.push((S.done[a.id] ? '☑ ' : '☐ ') + a.title + (a.sub ? '（' + a.sub + '）' : '')));
    }
    return L.join('\n');
  }
  function meText() {
    const L = ['🎒 個人要帶什麼（' + counts().md + '/' + ME.length + '）'];
    ME.forEach(it => L.push((MINE[it.id] ? '☑ ' : '☐ ') + plain(it.name) + (it.note ? '（' + plain(it.note) + '）' : '')));
    return L.join('\n');
  }
  function renderCopy() { const ta = $('#copy-ta'), v = copyTab === 'team' ? teamText() : meText(); if (ta.value !== v) ta.value = v; }
  function renderFoot() {
    setText('#foot-upd', S.updated ? '分工最後修改：' + fmt(S.updated) : '分工還沒有修改過');
    setText('#link-when', S.updated ? '目前分工：' + fmt(S.updated) + ' 版' : '目前還沒有分工');
  }
  function renderPill() { $('#send-pill').hidden = sig(S) === sentSig; }

  function updateAll() {
    SHARED.concat(COOK, ME).forEach(updateRow);
    const c = counts(), nA = ALL.length, d = c.sd + c.cd, cl = c.sc + c.cc;
    setText('#n-shared', d + '/' + nA); setText('#n-me', c.md + '/' + ME.length);
    setText('#m-done', d + '/' + nA); setV('#mb-done', d / nA);
    setText('#m-claim', cl + '/' + nA); setV('#mb-claim', cl / nA);
    setText('#m-me', c.md + '/' + ME.length); setV('#mb-me', c.md / ME.length);
    setText('#t-shared', c.sd); setText('#t-shared-c', '已認領 ' + c.sc + '/' + SHARED.length); setV('#tb-shared', c.sd / SHARED.length);
    setText('#t-cook', c.cd); setText('#t-cook-c', '已認領 ' + c.cc + '/' + COOK.length); setV('#tb-cook', c.cd / COOK.length);
    setText('#t-me', c.md); setV('#tb-me', c.md / ME.length);
    setText('#sb-shared', c.sd + '/' + SHARED.length + ' 備妥'); setV('#sf-shared', c.sd / SHARED.length);
    setText('#sb-cook', c.cd + '/' + COOK.length + ' 備妥'); setV('#sf-cook', c.cd / COOK.length);
    setText('#sb-me', c.md + '/' + ME.length + ' 打勾'); setV('#sf-me', c.md / ME.length);
    $('#cheer').hidden = !ME.length || c.md < ME.length;
    $('#empty-shared').hidden = SHARED.some(it => matches(it.id));
    $('#empty-cook').hidden = COOK.some(it => matches(it.id));
    renderCrew(); renderAsks(); renderFilterPill(); renderCopy(); renderFoot(); renderPill();
  }

  /* ---------- 儲存 ---------- */
  function commit() {
    S.updated = Date.now();
    store.set(KEY_SHARED, S);
  }
  function markSent() {
    sentSig = sig(S);
    store.set(KEY_SENT, sentSig);
    renderPill();
  }

  /* ---------- 分享連結 ---------- */
  function pack() {
    const w = {};
    ALL.forEach(it => {
      const a = whoOf(it.id);
      if (!a.length) return;
      w[it.id] = a.includes(-1) ? -1 : a.reduce((m, i) => m | (1 << i), 0);
    });
    return { v: 1, r: S.roster.slice(), w, d: Object.keys(S.done).filter(k => S.done[k]), t: S.updated || Date.now() };
  }
  function unpack(o) {
    if (!o || o.v !== 1) return null;
    const who = {};
    if (o.w && typeof o.w === 'object') Object.keys(o.w).forEach(k => {
      const m = o.w[k];
      if (m === -1) { who[k] = [-1]; return; }
      if (!Number.isInteger(m) || m <= 0) return;
      const a = [];
      for (let i = 0; i < PEOPLE; i++) if (m & (1 << i)) a.push(i);
      if (a.length) who[k] = a;
    });
    const done = {};
    if (Array.isArray(o.d)) o.d.forEach(k => { if (typeof k === 'string') done[k] = true; });
    return normalize({ roster: o.r, who, done, updated: o.t });
  }
  const baseURL = () => location.href.split('#')[0];
  const shareURL = () => baseURL() + '#s=' + b64e(JSON.stringify(pack()));

  function readHash() {
    const h = location.hash || '';
    if (h.indexOf('#s=') !== 0) return null;
    try { return unpack(JSON.parse(b64d(h.slice(3)))) || 'bad'; } catch (e) { return 'bad'; }
  }
  function clearHash() { try { history.replaceState(null, '', baseURL()); } catch (e) { /* 略過 */ } }
  function useIncoming(inc) {
    S = inc;
    if (!S.updated) S.updated = Date.now();
    store.set(KEY_SHARED, S);
    markSent();
    updateAll();
    toast('已載入 ' + fmt(S.updated) + ' 版的分工');
  }
  function handleHash() {
    const inc = readHash();
    if (!inc) return;
    clearHash();
    if (inc === 'bad') { toast('分享連結不完整，沒有載入'); return; }
    if (!hasContent(S) || sig(S) === sig(inc)) { useIncoming(inc); return; }
    openConfirm(inc);
  }

  async function copyStr(str, el) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(str); return true; }
    } catch (e) { /* 改用選取文字 */ }
    if (!el) return false;
    el.hidden = false;
    if (el.value !== str) el.value = str;
    el.focus();
    el.select();
    try { el.setSelectionRange(0, str.length); return !!document.execCommand('copy'); } catch (e) { return false; }
  }
  async function sendLink() {
    const url = shareURL();
    if (navigator.share) {
      try {
        await navigator.share({ title: TITLE, text: TEAM + '（' + fmt(S.updated || Date.now()) + ' 版）', url });
        markSent();
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    await copyLink();
  }
  async function copyLink() {
    const url = shareURL(), out = $('#link-out');
    out.value = url;
    if (await copyStr(url, out)) { markSent(); toast('分享連結已複製，貼到 LINE 群組就好'); }
    else toast('已選取連結，長按就能複製');
  }

  /* ---------- 小動畫 ---------- */
  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function pop(id) {
    const li = rowEls[id];
    if (!li || reduce) return;
    li.classList.remove('pop');
    void li.offsetWidth;
    li.classList.add('pop');
    setTimeout(() => li.classList.remove('pop'), 700);
  }
  function confetti() {
    if (reduce) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    if (!g) { cv.remove(); return; }
    g.scale(dpr, dpr);
    const cols = ['#ffd23f', '#ff9a3c', '#e0452f', '#c42b67', '#2bb673', '#0fb3c7', '#2a62f0'];
    const P = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - .5) * W * .4, y: H * .38,
      vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 5,
      s: 6 + Math.random() * 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
      c: cols[Math.floor(Math.random() * cols.length)], dot: Math.random() < .3
    }));
    const t0 = performance.now(), LIFE = 2600;
    const frame = t => {
      const el = t - t0;
      g.clearRect(0, 0, W, H);
      g.globalAlpha = Math.max(0, 1 - el / LIFE);
      for (const p of P) {
        p.vy += .34; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.dot) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.283); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      }
      if (el < LIFE) requestAnimationFrame(frame); else cv.remove();
    };
    requestAnimationFrame(frame);
  }
  function celebrate(msg) { toast(msg); confetti(); }

  /* ---------- 對話框：選人、名單、載入確認 ---------- */
  function openSheet() {
    const sh = $('#sheet');
    clearTimeout(closeT);
    if (sh.hidden) lastFocus = document.activeElement;
    sh.hidden = false;
    document.documentElement.classList.add('lock');
    requestAnimationFrame(() => { sh.classList.add('open'); $('.panel', sh).focus({ preventScroll: true }); });
  }
  function closeSheet() {
    const sh = $('#sheet');
    if (sh.hidden) return;
    sh.classList.remove('open');
    document.documentElement.classList.remove('lock');
    closeT = setTimeout(() => { sh.hidden = true; }, reduce ? 0 : 330);
    sheetCtx = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function openWho(id) {
    const it = ITEM[id];
    if (!it) return;
    sheetCtx = { type: 'who', id };
    $('#sheet-t').textContent = plain(it.name);
    $('#sheet-s').textContent = it.note ? plain(it.note) : '選擇負責帶的人';
    renderPick();
    $('#sheet-f').innerHTML = '<button type="button" class="btn solid" data-close>完成</button>';
    openSheet();
  }
  function renderPick() {
    const id = sheetCtx.id, w = whoOf(id), all = w.includes(-1);
    let h = '<p class="pick-h">誰帶？可以選好幾個人</p><div class="pick">';
    for (let i = 0; i < PEOPLE; i++) h += '<button type="button" class="pk" data-p="' + i + '" aria-pressed="' + (!all && w.includes(i)) + '">' + avHTML(i) + '<span class="pkn">' + esc(dn(i)) + '</span></button>';
    h += '</div><div class="pick-x"><button type="button" class="pk wide" data-p="-1" aria-pressed="' + all + '">' + IC.people + '<span>全員各自帶</span></button><button type="button" class="pk wide" data-p="x" aria-pressed="false">' + IC.x + '<span>清除</span></button></div>';
    if (S.roster.every(n => !n.trim())) h += '<button type="button" class="linkish" data-act="roster">還沒填名字？先編輯成員名單</button>';
    setHTML($('#sheet-b'), h, 'data-p');
  }
  function pickToggle(p) {
    if (!sheetCtx || sheetCtx.type !== 'who') return;
    const id = sheetCtx.id;
    let w = whoOf(id).slice();
    if (p === 'x') w = [];
    else if (p === '-1') w = w.includes(-1) ? [] : [-1];
    else {
      const i = Number(p);
      w = w.filter(n => n !== -1);
      w = w.includes(i) ? w.filter(n => n !== i) : w.concat(i).sort((a, b) => a - b);
    }
    if (w.length) S.who[id] = w; else delete S.who[id];
    commit();
    renderPick();
    updateAll();
  }
  function openRoster(backId) {
    sheetCtx = { type: 'roster', back: backId || null };
    $('#sheet-t').textContent = '編輯成員名單';
    $('#sheet-s').textContent = '名字會出現在頭像和認領按鈕上，最多 10 個字。';
    let h = '<div class="fields">';
    for (let i = 0; i < PEOPLE; i++) h += '<div class="field"><label for="rn-' + i + '">' + avHTML(i) + '<span>成員 ' + (i + 1) + '</span></label><input id="rn-' + i + '" type="text" maxlength="10" autocomplete="off" enterkeyhint="' + (i < PEOPLE - 1 ? 'next' : 'done') + '" placeholder="輸入名字" value="' + esc(S.roster[i] || '') + '"></div>';
    h += '</div>';
    const b = $('#sheet-b');
    b.innerHTML = h; b._h = h;
    $('#sheet-f').innerHTML = '<button type="button" class="btn" data-close>取消</button><button type="button" class="btn solid" data-act="save-roster">儲存</button>';
    openSheet();
  }
  function saveRoster() {
    if (!sheetCtx || sheetCtx.type !== 'roster') return;
    const back = sheetCtx.back;
    let changed = false;
    for (let i = 0; i < PEOPLE; i++) {
      const el = $('#rn-' + i);
      const v = el ? el.value.trim().slice(0, 10) : S.roster[i];
      if (v !== S.roster[i]) { S.roster[i] = v; changed = true; }
    }
    if (changed) { commit(); updateAll(); toast('名單已更新'); }
    if (back) openWho(back); else closeSheet();
  }
  function openConfirm(inc) {
    sheetCtx = { type: 'confirm', inc };
    $('#sheet-t').textContent = '要載入連結裡的分工嗎？';
    $('#sheet-s').textContent = '這台裝置已經有不一樣的分工，選一份保留。';
    const card = (label, s, when) => {
      const c = counts(s);
      return '<div class="cmp-c"><b>' + label + '</b><span>' + when + '</span><span>已認領 ' + (c.sc + c.cc) + '/' + ALL.length + '</span><span>已備妥 ' + (c.sd + c.cd) + '/' + ALL.length + '</span></div>';
    };
    const b = $('#sheet-b');
    b.innerHTML = '<div class="cmp">' + card('分享連結', inc, inc.updated ? fmt(inc.updated) + ' 版' : '時間不明') + card('這台裝置', S, S.updated ? fmt(S.updated) + ' 修改' : '時間不明') + '</div>';
    b._h = null;
    $('#sheet-f').innerHTML = '<button type="button" class="btn" data-close>保留這台的</button><button type="button" class="btn solid" data-act="use-inc">載入連結的</button>';
    openSheet();
  }

  /* ---------- 互動 ---------- */
  function pickFilter(f) {
    const next = f === 'all' ? null : f === 'none' ? 'none' : Number(f);
    F = next !== null && F === next ? null : next;
    updateAll();
    if (F !== null) {
      const inShared = SHARED.some(it => matches(it.id)), inCook = COOK.some(it => matches(it.id));
      (inShared || !inCook ? $('#shared') : $('#cook')).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }
  function toggleAsk(id) {
    if (S.done[id]) delete S.done[id]; else S.done[id] = true;
    commit();
    updateAll();
  }
  function setTab(t) {
    copyTab = t;
    $('#tab-team').setAttribute('aria-selected', String(t === 'team'));
    $('#tab-me').setAttribute('aria-selected', String(t === 'me'));
    renderCopy();
  }
  async function copyText(btn) {
    const ta = $('#copy-ta');
    if (await copyStr(ta.value, ta)) {
      btn.textContent = '已複製';
      setTimeout(() => { btn.textContent = '複製文字'; }, 1800);
      toast('已複製，可以貼到 LINE 群組');
      if (copyTab === 'team') markSent();
    } else toast('已幫你選取文字，長按就能複製');
  }
  async function shareText() {
    const txt = $('#copy-ta').value;
    try { await navigator.share({ text: txt }); if (copyTab === 'team') markSent(); }
    catch (e) { if (!e || e.name !== 'AbortError') toast('沒辦法開啟分享選單，改用「複製文字」'); }
  }
  function twoStep(btn, label, run) {
    if (!btn._arm) {
      btn.textContent = '再按一次確認';
      btn._arm = setTimeout(() => { btn._arm = 0; btn.textContent = label; }, 3000);
      return;
    }
    clearTimeout(btn._arm);
    btn._arm = 0;
    btn.textContent = label;
    run();
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.classList || !t.classList.contains('ck-in')) return;
    const it = ITEM[t.dataset.id];
    if (!it) return;
    if (it.kind === 'me') {
      const before = counts().md;
      if (t.checked) MINE[it.id] = true; else delete MINE[it.id];
      store.set(KEY_ME, MINE);
      pop(it.id);
      updateAll();
      if (t.checked && before === ME.length - 1) celebrate('行李到齊，可以出發了');
      return;
    }
    const c0 = counts();
    if (t.checked) S.done[it.id] = true; else delete S.done[it.id];
    commit();
    pop(it.id);
    updateAll();
    const c1 = counts();
    if (t.checked && c0.sd + c0.cd === ALL.length - 1 && c1.sd + c1.cd === ALL.length) celebrate('公共裝備和炊具全部備妥');
  });

  document.addEventListener('click', e => {
    const tgt = e.target;
    if (!(tgt instanceof Element)) return;
    if (tgt.closest('[data-close]')) { closeSheet(); return; }
    const b = tgt.closest('button');
    if (!b) return;
    if (b.classList.contains('who')) { openWho(b.dataset.id); return; }
    if (b.classList.contains('pp')) { pickFilter(b.dataset.f); return; }
    if (b.classList.contains('ask-b')) { toggleAsk(b.dataset.ask); return; }
    if (b.classList.contains('pk')) { pickToggle(b.dataset.p); return; }
    if (b.dataset.act === 'roster') { openRoster(sheetCtx && sheetCtx.id); return; }
    if (b.dataset.act === 'save-roster') { saveRoster(); return; }
    if (b.dataset.act === 'use-inc') { const inc = sheetCtx && sheetCtx.inc; closeSheet(); if (inc) useIncoming(inc); return; }
    switch (b.id) {
      case 'edit-roster': openRoster(null); break;
      case 'filter-pill': F = null; updateAll(); break;
      case 'send-pill': case 'link-share': sendLink(); break;
      case 'link-copy': copyLink(); break;
      case 'copy-btn': copyText(b); break;
      case 'text-share': shareText(); break;
      case 'tab-team': setTab('team'); break;
      case 'tab-me': setTab('me'); break;
      case 'reset-me': twoStep(b, '清除我的個人勾選', () => { MINE = {}; store.set(KEY_ME, MINE); updateAll(); toast('已清除你的個人勾選'); }); break;
      case 'reset-team': twoStep(b, '清除分工', () => { S = normalize(null); commit(); F = null; updateAll(); toast('已清除名單、認領和備妥狀態'); }); break;
      default: break;
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (!t.id || t.id.indexOf('rn-') !== 0) return;
    const i = Number(t.id.slice(3)), av = t.parentElement.querySelector('.av'), v = t.value.trim();
    if (av) av.textContent = v ? Array.from(v)[0] : String(i + 1);
  });

  document.addEventListener('keydown', e => {
    const sheetOpen = !$('#sheet').hidden;
    if (e.key === 'Escape' && sheetOpen) { closeSheet(); return; }
    const t = e.target;
    if (e.key === 'Enter' && t.id && t.id.indexOf('rn-') === 0) {
      e.preventDefault();
      const nx = $('#rn-' + (Number(t.id.slice(3)) + 1));
      if (nx) nx.focus(); else saveRoster();
      return;
    }
    if (e.key === 'Tab' && sheetOpen) {
      const f = $$('#sheet .panel button, #sheet .panel input').filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- 捲動特效、背景 ---------- */
  function setupScrollFx() {
    if (reduce) return;
    const nav = $('.nav'), hero = $('.hero'), fx = $$('.fx');
    let tick = false;
    const run = () => {
      tick = false;
      const vh = innerHeight, max = document.documentElement.scrollHeight - vh;
      nav.style.setProperty('--scroll', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0');
      const hr = hero.getBoundingClientRect();
      if (hr.bottom > -50) hero.style.setProperty('--p', Math.min(1, Math.max(0, -hr.top / Math.max(1, hr.height))).toFixed(4));
      for (const el of fx) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -60 || r.top > vh + 60) continue;
        el.style.setProperty('--sp', Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))).toFixed(4));
      }
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener('resize', run);
    run();
  }
  function setupReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    const vh = innerHeight;
    const io = new IntersectionObserver(entries => {
      let k = 0;
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.style.setProperty('--d', (Math.min(k++, 6) * .06).toFixed(2) + 's');
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    }, { threshold: 0 });
    $$('.rv').forEach(el => { if (el.getBoundingClientRect().top > vh * .9) io.observe(el); });
  }
  function drawTopo(cv) {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = cv.getAttribute('data-c') || '#11624a';
    g.lineWidth = 1.2;
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const hills = Math.max(3, Math.round((w * h) / 120000));
    for (let k = 0; k < hills; k++) {
      const cx = rnd() * w, cy = rnd() * h, base = 26 + rnd() * 26, rings = 6 + Math.floor(rnd() * 5);
      const a1 = rnd() * 6.28, a2 = rnd() * 6.28, f1 = 2 + Math.floor(rnd() * 2), f2 = 4 + Math.floor(rnd() * 3);
      for (let r = 1; r <= rings; r++) {
        const R = r * base * .55 + 10;
        g.beginPath();
        for (let s = 0; s <= 80; s++) {
          const t = (s / 80) * Math.PI * 2;
          const m = 1 + .16 * Math.sin(f1 * t + a1 + r * .3) + .07 * Math.sin(f2 * t + a2);
          const x = cx + Math.cos(t) * R * m * 1.3, y = cy + Math.sin(t) * R * m * .85;
          if (s) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath();
        g.stroke();
      }
    }
  }
  function setupTopo() {
    const cvs = $$('canvas.topo'), draw = () => cvs.forEach(drawTopo);
    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw).catch(() => {});
    let lw = innerWidth, rt = 0;
    addEventListener('resize', () => { if (innerWidth === lw) return; lw = innerWidth; clearTimeout(rt); rt = setTimeout(draw, 200); });
  }
  function setupStars() {
    let seed = 5, h = '';
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) h += '<i style="left:' + (rnd() * 100).toFixed(1) + '%;top:' + (16 + rnd() * 70).toFixed(1) + '%;--s:' + (1 + rnd() * 2.2).toFixed(1) + 'px;--d:' + (-rnd() * 3).toFixed(2) + 's"></i>';
    $('#stars').innerHTML = h;
  }

  /* ---------- 啟動 ---------- */
  app.innerHTML = appHTML();
  $$('.row').forEach(li => { rowEls[li.dataset.id] = li; });
  setupStars();
  if (navigator.share) { $('#link-share').hidden = false; $('#text-share').hidden = false; }
  updateAll();
  setupScrollFx();
  setupReveal();
  setupTopo();
  handleHash();
  addEventListener('hashchange', handleHash);
  /* 直接開某一段的網址（例如 #me）時，內容生成後再捲過去 */
  const h0 = location.hash.slice(1);
  if (h0 && h0.indexOf('s=') !== 0) { const t = document.getElementById(h0); if (t) t.scrollIntoView(); }
})();
