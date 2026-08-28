// componants/render_spot.js
// ---------------------------------------------------------------------------
// WE33 — dashboard renderer
//
//   renderSpots(account, dappData, spotsData, options?) -> HTML string
//
//   account    the connected wallet address, or the zero address when there is
//              none. Drives the navbar state.
//   dappData   we33.methods.getDappData().call()   — global counters
//   spotsData  we33.methods.getSpotsData(account, id).call() — 16 positions
//
// Output
//   navbar          brand + wallet state, full width
//   column 1        identity panel  (rank, value, rank ladder, account,
//                                    referrer, referral link, upgrade, held ids)
//                   wallet panel    (earnings and balances, redeem + transfer)
//   column 2        position map
//                   dapp info       (global counters, seats per rank)
//
// Columns sit side by side from ~980px of available width and stack below it.
//
// The 16 positions are a binary tree:
//   [0] upline · [1] focus · [2..3] legs · [4..7] base 4 · [8..15] base 8
//
// Map rules
//   • Taken spot (id !== 0 and owner !== zero) -> full card.
//   • Free spot whose parent is taken -> Available card.
//   • Anything under an id 0 spot can never hold data -> quiet dot.
//
// Rank ladder (value in whole tokens)
//   rank 1 below 30 · rank 2 below 90 · rank 3 below 210 · rank 4 below 450
//   rank 5 below 930 · rank 6 at 930 and above
//
// Balances are not on chain in this call, so pass them in:
//   renderSpots(account, dapp, spots, {
//     balances: { point: '0', redeem: '0', airdrop: '0', usdt: '0' }
//   })
//
// App hooks — inline calls are guarded, so nothing breaks until you define them
//   searchFocus(id)      every spot card, every held id chip, the search field
//   connectWallet()      navbar, both states     [data-action="connect-wallet"]
//   registerAccount(id)  join panel              [data-action="register"]
//   redeemBalance()      redeem tile            [data-action="redeem"]
//   transferPoint()      WE Point tile          [data-action="transfer"]
//   [data-action="upgrade-rank"]  data-spot-id / data-current-rank / data-next-rank
//   [data-action="copy-link"]     data-link holds the referral url
//   [data-address]                full address, for copy handlers
// ---------------------------------------------------------------------------

const ZERO = '0x0000000000000000000000000000000000000000';
const REF_BASE = 'https://www.we33.online?id=';

const LOGO_URL = 'https://www.we33.online/logo.png';

/** Value thresholds that open each rank, in whole tokens. */
const RANK_STEPS = [0, 30, 90, 210, 450, 930];

let __uid = 0;


/* ------------------------- agreement + runtime -------------------------- */

const AGREEMENT_HTML = /*html*/`
<h4>WE33 platform risk warning, agreement and participation terms</h4>
<p class="we33-doc-date">Date: August 25, 2026</p>
<p>Please read and fully understand the following information before registering as a member or
   participating in any activity on the WE33 platform. Registration, rank purchases, receiving
   WEPOINTS, receiving WE tokens, participating in activities, or receiving rewards are all
   voluntary decisions made by each member. Participants should carefully study the information
   and assess the risks before making any decision.</p>

<h5>1. WEPOINTS and WE tokens eligibility</h5>
<p>Upon registering with WE33, each member receives 20 WEPOINTS. 20 WEPOINTS equals 1 eligibility,
   and 1 eligibility can be used to receive WE tokens for free one time, subject to the platform's
   terms and conditions. Members receive an additional 2 WEPOINTS for each directly referred member
   (Direct 1 ID).</p>
<p>Receiving WEPOINTS or eligibility to receive WE tokens does not mean that WE tokens will have any
   guaranteed value or price. WE33 does not guarantee the value, price, liquidity, or return of WE tokens.</p>

<h5>2.1 Rank reward</h5>
<p>Rank reward may be earned when a member within your team structure achieves the required rank:
   a level 1 member reaching rank 1, level 2 reaching rank 2, level 3 reaching rank 3, level 4 reaching
   rank 4, level 5 reaching rank 5, or level 6 reaching rank 6 may each make you eligible to receive the
   reward according to the applicable conditions.</p>
<p>Meeting the stated conditions does not guarantee that a reward will be received. Rewards are subject
   to the platform's applicable terms, conditions, rules, and system status at the relevant time.</p>

<h5>2.2 Direct reward</h5>
<p>Direct reward may be earned from members you directly refer, subject to rank requirements. When your
   direct member reaches rank 4 you must be rank 4 or higher; when they reach rank 5 you must be rank 5
   or higher; when they reach rank 6 you must be rank 6. There is no guarantee that a direct reward will
   be received.</p>

<h5>2.3 World pool — rank 6</h5>
<p>The world pool is a shared reward pool available only to members who have achieved rank 6. Eligibility,
   amount, value, and distribution are subject to the platform's applicable terms and conditions. There is
   no guarantee regarding the amount, value, or return from the world pool.</p>

<h5>3. Rank purchase</h5>
<p>Purchasing or upgrading a rank is entirely voluntary and is the sole decision of each member. Members
   are not required to purchase a rank. Purchasing a rank does not guarantee that any reward will be
   received, and does not guarantee income, profit, or any return. Members should consider their own
   financial circumstances and risk tolerance before making a decision.</p>

<h5>4. WE tokens risk warning</h5>
<p>Members understand and acknowledge that WE tokens may have no monetary value, their price may increase
   or decrease, and they may not be able to be sold or exchanged at the expected price. Receiving free WE
   tokens or any eligibility provided by the platform does not guarantee that WE tokens will have any
   future value. Members may lose all or part of the value of their digital assets.</p>

<h5>5. No guarantee of income or returns</h5>
<p>WE33 does not guarantee that members will receive income, profit, rewards, WE tokens with monetary
   value, returns from rank purchases, rank rewards, direct rewards, or world pool rewards. Results may
   vary from member to member and depend on the platform's applicable conditions, activities, and system
   status.</p>

<h5>6. Agreement acceptance</h5>
<p>By accepting, the member confirms they have read and understood the risk warnings and terms of WE33,
   that WE tokens have no guaranteed value, price, or return, that rank, direct, and world pool rewards
   are not guaranteed, that purchasing a rank is entirely voluntary, that participation does not guarantee
   income, profit, or any return, and that participation is entirely their own voluntary decision.</p>

<p class="we33-doc-warn">Important risk warning — digital assets involve a high level of risk. Their value
   and price may fluctuate, and participants may lose all or part of their value. Please carefully study
   the information and assess the risks before deciding to participate in the WE33 platform.</p>`;

/**
 * Inline handlers survive an innerHTML swap, but a <script> tag does not run,
 * so the shared runtime is bootstrapped from an image error handler. It defines
 * window.__we33 once and every later render reuses it.
 */
const RUNTIME = `if(!window.__we33){window.__we33={
q:function(r,n){return document.getElementById(r+'-'+n)},
lock:function(on){document.body.style.overflow=on?'hidden':''},
open:function(r,n){var e=this.q(r,n);if(e){e.classList.add('is-open');this.lock(1)}},
close:function(r,n){var e=this.q(r,n);if(e){e.classList.remove('is-open');this.lock(0)}},
pick:function(names){for(var i=0;i<names.length;i++){var f=window[names[i]];if(typeof f==='function')return f}return null},
set:function(r,state,title,msg,tx){
var m=this.q(r,'status');if(!m)return;
m.setAttribute('data-state',state);
var t=this.q(r,'status-title');if(t)t.textContent=title;
var g=this.q(r,'status-msg');if(g)g.textContent=msg||'';
var x=this.q(r,'status-tx');if(x){x.textContent=tx||'';x.style.display=tx?'':'none';x.setAttribute('data-tx',tx||'')}
m.classList.add('is-open');this.lock(1)},
run:function(r,names,args,label){
var f=this.pick(names),s=this;
if(!f){s.set(r,'error',label+' unavailable','This action is not connected yet.');return}
s.set(r,'pending',label+' in progress','Confirm the transaction in your wallet and keep this tab open.');
Promise.resolve().then(function(){return f.apply(window,args)}).then(function(res){
res=res||{};
if(res.result){s.set(r,'done',label+' complete','The transaction was confirmed on chain.',res.txhash||'')}
else{s.set(r,'error',label+' failed',res.error||res.message||'The transaction did not go through.',res.txhash||'')}
}).catch(function(e){s.set(r,'error',label+' failed',(e&&e.message)?e.message:String(e))})},
copyTx:function(el){if(navigator.clipboard&&el.getAttribute('data-tx')){navigator.clipboard.writeText(el.getAttribute('data-tx'));el.classList.add('is-copied');setTimeout(function(){el.classList.remove('is-copied')},1200)}}
}}`;

/* ------------------------------- helpers -------------------------------- */

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Digits only, so it can be dropped straight into an inline handler. */
const numArg = (v) => String(v ?? '0').replace(/[^0-9]/g, '') || '0';

/** Fires window.<fn> only when the app has defined it. */
const call = (fn, arg = '') => esc(`typeof ${fn}==='function'&&${fn}(${arg})`);

/** 0x1234…9abc */
export function shortAddress(addr, head = 4, tail = 4) {
  const a = String(addr ?? '');
  if (!/^0x[0-9a-fA-F]{8,}$/.test(a)) return '—';
  return `${a.slice(0, 2 + head)}…${a.slice(-tail)}`;
}

/** uint256 with 18 decimals -> "1,234.56". BigInt only, no precision loss. */
export function formatUnits(value, decimals = 2, unit = 18) {
  let v;
  try { v = BigInt(value ?? 0); } catch { return '0.00'; }
  const neg = v < 0n;
  if (neg) v = -v;

  const whole = v / 10n ** BigInt(unit);
  const frac = (v % 10n ** BigInt(unit)) / 10n ** BigInt(unit - decimals);

  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + w + (decimals ? `.${frac.toString().padStart(decimals, '0')}` : '');
}

/** Plain counter, grouped. */
function formatCount(value) {
  try { return BigInt(value ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  catch { return '0'; }
}

const toNumber = (v) => { try { return Number(BigInt(v ?? 0)); } catch { return 0; } };

/** uint256 -> Number in whole tokens, safe for the sizes on the rank ladder. */
function toTokens(value) {
  try { return Number(BigInt(value ?? 0) / 10n ** 14n) / 10000; }
  catch { return 0; }
}

/** Where a value sits on the rank ladder. */
export function rankProgress(value) {
  const v = toTokens(value);
  const top = RANK_STEPS[RANK_STEPS.length - 1];
  if (v >= top) return { rank: 6, next: null, target: top, pct: 100 };

  let i = 0;
  while (i < RANK_STEPS.length - 1 && v >= RANK_STEPS[i + 1]) i += 1;
  const lo = RANK_STEPS[i];
  const hi = RANK_STEPS[i + 1];
  const frac = hi > lo ? (v - lo) / (hi - lo) : 0;
  return { rank: i + 1, next: i + 2, target: hi, pct: ((i + frac) / 5) * 100 };
}

/** Named field first, tuple index as the fallback. */
const pick = (o, name, idx) => {
  if (o == null) return undefined;
  const byName = o[name];
  return byName !== undefined ? byName : o[idx];
};

/* PositionSchema: id, parent, left, right, rank, value, owner */
const spotId = (s) => pick(s, 'id', 0);
const spotRank = (s) => pick(s, 'rank', 4);
const spotValue = (s) => pick(s, 'value', 5);
const spotOwner = (s) => pick(s, 'owner', 6);

/* OwnerSchema: account, referrer, latestId, affiliate, profit, reinvest, toprank, direct, ids */
const OWNER_FIELDS = {
  account: 0, referrer: 1, latestId: 2, affiliate: 3,
  profit: 4, reinvest: 5, toprank: 6, direct: 7, ids: 8,
};
const ownerField = (o, name) => pick(o, name, OWNER_FIELDS[name]);

/** Anything array-like becomes a real array. */
function toArrayLike(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    if (typeof v.length === 'number') return Array.from(v);
    const keys = Object.keys(v).filter((k) => /^\d+$/.test(k));
    if (keys.length) return keys.sort((a, b) => Number(a) - Number(b)).map((k) => v[k]);
  }
  return null;
}

/** Accepts an array, a web3/ethers result object, or either one nested a level deep. */
function toSpotArray(data) {
  if (!data) return [];
  let arr = data;

  if (!Array.isArray(arr) && typeof arr === 'object' && arr.spots) arr = arr.spots;
  arr = toArrayLike(arr) ?? [];

  // getSpotsData sometimes hands back the array wrapped in a one-item tuple
  if (arr.length === 1 && arr[0] && typeof arr[0] === 'object') {
    const inner = toArrayLike(arr[0]);
    if (inner && inner.length > 1) arr = inner;
  }
  return arr;
}

/** DappSchema by name, falling back to tuple order. */
function readDapp(d) {
  const g = (name, idx) => pick(d, name, idx) ?? 0;
  return {
    globalDirect: g('globalDirect', 0),
    latestPosition: g('latestPosition', 1),
    seats: [1, 2, 3, 4, 5, 6].map((r) => g(`totalSeat_rank_${r}`, r + 1)),
  };
}

/** A spots payload is a list of at least 8 structs. */
function asSpotList(v) {
  const arr = toSpotArray(v);
  const structs = arr.filter((x) => x && typeof x === 'object').length;
  return arr.length >= 8 && structs >= 4 ? arr : null;
}

/**
 * The dapp and spots arguments get swapped easily, and a Promise.all with one
 * entry leaves the second one undefined. Work out which is which instead of
 * rendering an empty board.
 */
function resolveInputs(dappData, spotsData) {
  const fromSpots = asSpotList(spotsData);
  const fromDapp = asSpotList(dappData);
  if (fromSpots) return { spots: fromSpots, dapp: fromDapp ? null : dappData };
  if (fromDapp) return { spots: fromDapp, dapp: spotsData ?? null };
  return { spots: [], dapp: dappData ?? spotsData };
}

/** Balances as an object, a [point, redeem, airdrop, usdt] tuple, or nothing. */
function readBalances(b) {
  const order = ['point', 'redeem', 'airdrop', 'usdt'];
  const out = { point: 0, redeem: 0, airdrop: 0, usdt: 0 };
  if (!b) return out;
  const arr = Array.isArray(b) ? b : null;
  order.forEach((k, i) => {
    const v = arr ? arr[i] : b[k];
    if (v !== undefined && v !== null) out[k] = v;
  });
  return out;
}

const ownerOf = (spot) => ownerField(spotOwner(spot), 'account') ?? '';

/** Taken means a real id and a real owner. */
function isLive(spot) {
  if (!spot) return false;
  const acc = String(ownerOf(spot)).toLowerCase();
  if (!acc || acc === ZERO) return false;
  return String(spotId(spot) ?? '0') !== '0';
}

const isConnected = (account) => {
  const a = String(account ?? '').toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(a) && a !== ZERO;
};

/** owner.ids without the default 0 entry. */
function heldIds(owner) {
  const raw = toArrayLike(ownerField(owner, 'ids')) ?? [];
  return raw.map(String).filter((id) => id !== '0');
}

/* -------------------------------- brand --------------------------------- */

const mark = (logo, cls = 'we33-mark') =>
  `<img class="${cls}" src="${esc(logo)}" alt="" width="64" height="64" loading="lazy" decoding="async">`;

const glassIcon = /*html*/`
<svg class="we33-glass" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="10.5" cy="10.5" r="6.4" stroke="currentColor" stroke-width="2.1"/>
  <path d="M15.4 15.4 L20.5 20.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;

/** Every address on screen carries the same live dot. */
const addressLine = (addr, cls, head = 4, tail = 4) =>
  `<span class="${cls}" title="${esc(addr)}" data-address="${esc(addr)}"><i class="we33-live" aria-hidden="true"></i>${esc(shortAddress(addr, head, tail))}</span>`;

/* ------------------------------ map cards ------------------------------- */

function liveCard(spot, logo, variant = '') {
  const id = String(spotId(spot));
  const rank = Number(spotRank(spot) ?? 0);
  const addr = ownerOf(spot);

  return /*html*/`
<button type="button" class="we33-card ${variant}" onclick="${call('searchFocus', numArg(id))}"
        data-spot-id="${esc(id)}" data-spot-owner="${esc(addr)}"
        aria-label="Position ${esc(id)}, rank ${rank}">
  <span class="we33-top">${mark(logo)}<span class="we33-rank">Rank ${rank}</span></span>
  <span class="we33-id">${esc(id)}</span>
  ${addressLine(addr, 'we33-addr')}
</button>`;
}

const openCard = (variant = '') => /*html*/`
<button type="button" class="we33-card we33-card--open ${variant}" data-spot-id="0" aria-label="Available position">
  <span class="we33-tag">Available</span>
</button>`;

const mutedCard = (text, variant = '') => /*html*/`
<div class="we33-card we33-card--muted ${variant}"><span class="we33-tag">${esc(text)}</span></div>`;

const dot = () => '<div class="we33-dot" aria-hidden="true"><i></i></div>';

function arms(states, cls = '') {
  const cells = states.map((on) => /*html*/`
    <div class="we33-arm${on ? '' : ' we33-arm--off'}"><i class="we33-stem"></i><i class="we33-bow"></i></div>`).join('');
  return `<div class="we33-arms ${cls}" style="--cols:${states.length}">${cells}</div>`;
}

const trunk = (on) => `<div class="we33-trunk${on ? '' : ' we33-arm--off'}"><i></i></div>`;

/* -------------------------------- styles -------------------------------- */

function styles(rid, frame) {
  const R = `#${rid}`;

  const tabOn = (sels) => `${sels.join(',')}{
  color:#06301A;background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));
  box-shadow:0 1px 0 rgba(255,255,255,.4) inset,0 6px 14px -8px rgba(47,232,132,.95);
}`;
  const T4 = `${R} .we33-d4:checked ~ .we33-layout [for="${rid}-d4"]`;
  const T8 = `${R} .we33-d8:checked ~ .we33-layout [for="${rid}-d8"]`;
  const A4 = `${R} .we33-auto:checked ~ .we33-layout [for="${rid}-d4"]`;
  const A8 = `${R} .we33-auto:checked ~ .we33-layout [for="${rid}-d8"]`;

  return /*html*/`<style>
${R}{
  --mint:#2FE884;
  --gold:#F2E85C;
  --cyan:#22C9E8;
  --live:#2FE884;
  --line:rgba(47,232,132,.30);
  --line-off:rgba(255,255,255,.055);
  --hair:rgba(255,255,255,.10);
  --ink:#F3F5F3;
  --ink-dim:rgba(243,245,243,.55);
  --ink-faint:rgba(243,245,243,.34);
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;
  container-type:inline-size;container-name:we33;
  display:block;width:100%;max-width:100%;color:var(--ink);font-feature-settings:"tnum" 1;
}
${R} *{box-sizing:border-box;min-width:0}

/* ---------- layout ---------- */
${R} .we33-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(10px,1.3cqw,16px);align-items:stretch}
${R} .we33-col{display:flex;flex-direction:column;gap:clamp(10px,1.3cqw,16px);height:100%}
${R} .we33-col > .we33-panel:last-child{flex:1}
@container we33 (min-width:980px){
  ${R} .we33-layout{grid-template-columns:repeat(2,minmax(0,1fr))}
}

/* ---------- panel chrome ---------- */
${R} .we33-panel,${R} .we33-nav{
  position:relative;overflow:hidden;container-type:inline-size;container-name:box;
  --pad:clamp(12px,2cqw,18px);
  --rowgap:clamp(3px,.8cqw,8px);
  --arm:clamp(15px,2.6cqw,28px);
  --cardpad:clamp(5px,1cqw,10px);
  --cardradius:clamp(9px,1.5cqw,14px);
  --fs-id:clamp(11px,2cqw,16px);
  --fs-addr:clamp(7.5px,1.4cqw,10.5px);
  --fs-rank:clamp(7px,1.2cqw,9.5px);
  --mark:clamp(9px,1.6cqw,14px);
  ${frame ? `border:1px solid var(--hair);border-radius:clamp(14px,1.8cqw,20px);padding:var(--pad);
  background:
    radial-gradient(100% 70% at 50% -20%, rgba(47,232,132,.10), transparent 60%),
    radial-gradient(70% 55% at 105% 108%, rgba(34,201,232,.07), transparent 70%),
    linear-gradient(180deg,#0E1310 0%, #0A0E0C 58%, #070908 100%);
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 26px 60px -46px rgba(0,0,0,1);` : ''}
}
${R} .we33-panel--lead{
  ${frame ? `background:
    radial-gradient(100% 75% at 50% -25%, rgba(47,232,132,.16), transparent 62%),
    radial-gradient(65% 55% at 104% 110%, rgba(34,201,232,.10), transparent 70%),
    linear-gradient(180deg,#101613 0%, #0B100D 56%, #070908 100%);` : ''}
}
${R} .we33-mesh{
  position:absolute;inset:0;pointer-events:none;
  background-image:
    linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);
  background-size:clamp(24px,4cqw,38px) clamp(24px,4cqw,38px);background-position:center top;
  -webkit-mask-image:radial-gradient(75% 72% at 50% 0%,#000 0%,transparent 80%);
          mask-image:radial-gradient(75% 72% at 50% 0%,#000 0%,transparent 80%);
}
${R} .we33-aurora{
  position:absolute;left:50%;top:clamp(-110px,-13cqw,-64px);width:min(520px,130%);height:clamp(140px,26cqw,260px);
  transform:translateX(-50%);pointer-events:none;filter:blur(clamp(32px,5cqw,58px));opacity:.4;
  background:radial-gradient(50% 50% at 50% 50%, rgba(47,232,132,.5), transparent 70%);
}
${R} .we33-content{position:relative;z-index:1;display:flex;flex-direction:column;height:100%}

/* ---------- navbar ---------- */
${R} .we33-nav{
  display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:nowrap;
  margin-bottom:clamp(10px,1.3cqw,16px);padding:clamp(8px,1.1cqw,13px) clamp(10px,1.5cqw,18px);
}
${R} .we33-brand{display:flex;align-items:center;gap:9px;position:relative;z-index:1;min-width:0}
${R} .we33-brand-text{min-width:0;overflow:hidden}
${R} .we33-nav-short{display:none}
@container box (max-width:430px){
  ${R} .we33-brand-text span{display:none}
  ${R} .we33-nav-long{display:none}
  ${R} .we33-nav-short{display:inline}
}
${R} .we33-brand-mark{
  width:clamp(26px,3.4cqw,34px);height:clamp(26px,3.4cqw,34px);display:grid;place-items:center;flex:none;
  border:1px solid rgba(47,232,132,.35);border-radius:clamp(9px,1.2cqw,12px);
  background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(34,201,232,.07));
}
${R} .we33-brand-mark img{width:76%;height:76%;display:block;object-fit:contain}
${R} .we33-brand-text b{display:block;font-size:clamp(13px,1.7cqw,16px);font-weight:700;letter-spacing:.06em;line-height:1.1}
${R} .we33-brand-text span{display:block;font-size:clamp(7.5px,1cqw,9px);letter-spacing:.28em;text-transform:uppercase;color:var(--ink-faint)}
${R} .we33-wallet{
  display:inline-flex;align-items:center;gap:8px;position:relative;z-index:1;flex:none;cursor:pointer;
  padding:7px clamp(11px,1.4cqw,15px);border-radius:999px;border:1px solid rgba(47,232,132,.3);
  background:rgba(255,255,255,.035);box-shadow:0 1px 0 rgba(255,255,255,.05) inset;
  font-family:var(--mono);font-size:clamp(10px,1.4cqw,12.5px);color:var(--ink);white-space:nowrap;
  transition:border-color .16s ease,background .16s ease;
}
${R} .we33-wallet:hover{border-color:rgba(47,232,132,.7);background:rgba(47,232,132,.08)}
${R} .we33-wallet:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
${R} .we33-connect{
  display:inline-flex;align-items:center;gap:8px;cursor:pointer;border:0;position:relative;z-index:1;flex:none;
  white-space:nowrap;padding:9px clamp(13px,1.7cqw,20px);border-radius:999px;color:#06301A;font:inherit;font-weight:700;
  font-size:clamp(10.5px,1.4cqw,12.5px);letter-spacing:.06em;text-transform:uppercase;
  background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));
  box-shadow:0 0 0 1px rgba(255,255,255,.22) inset,0 12px 26px -12px rgba(34,201,232,.9);
  transition:transform .16s ease,filter .16s ease;
}
${R} .we33-connect:hover{transform:translateY(-1px);filter:saturate(1.1)}
${R} .we33-connect:focus-visible{outline:2px solid var(--mint);outline-offset:3px}

/* ---------- shared type ---------- */
${R} .we33-eyebrow{margin:0;font-size:clamp(8.5px,1.4cqw,10px);letter-spacing:.28em;text-transform:uppercase;color:var(--mint)}
${R} .we33-title{margin:5px 0 0;font-size:clamp(15px,2.6cqw,21px);line-height:1.1;font-weight:600;letter-spacing:-.01em}
${R} .we33-title b{font-family:var(--mono);font-weight:600}
${R} .we33-label{font-size:clamp(8px,1.3cqw,9.5px);letter-spacing:.18em;text-transform:uppercase;color:var(--mint);white-space:nowrap}
${R} .we33-label--dim{color:var(--ink-faint)}
${R} .we33-num{font-family:var(--mono);font-weight:600;letter-spacing:-.01em}
${R} .we33-live{
  width:clamp(4px,.7cqw,6px);height:clamp(4px,.7cqw,6px);border-radius:50%;flex:none;display:inline-block;
  background:var(--live);box-shadow:0 0 0 2px rgba(47,232,132,.16),0 0 6px rgba(47,232,132,.55);
}
${R} .we33-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
${R} .we33-group{margin-top:clamp(11px,1.5cqw,15px)}
${R} .we33-group > .we33-label{display:block;margin-bottom:7px}

/* ---------- identity panel ---------- */
${R} .we33-rankpill{
  display:inline-block;font-size:clamp(8.5px,1.4cqw,10px);font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:#06301A;background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));padding:3px 10px;border-radius:999px;white-space:nowrap;
}
${R} .we33-hero{
  margin-top:clamp(11px,1.6cqw,16px);padding:clamp(10px,1.6cqw,15px);
  border:1px solid rgba(47,232,132,.28);border-radius:clamp(12px,1.6cqw,15px);
  background:linear-gradient(150deg,rgba(47,232,132,.12),rgba(255,255,255,.015) 62%,rgba(34,201,232,.08));
  box-shadow:0 1px 0 rgba(255,255,255,.09) inset;
}
${R} .we33-hero .we33-num{display:block;margin-top:4px;font-size:clamp(21px,4.2cqw,32px);color:var(--gold);line-height:1;overflow:hidden;text-overflow:ellipsis}

${R} .we33-ladder{margin-top:clamp(11px,1.5cqw,15px)}
${R} .we33-ladder-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:7px}
${R} .we33-ladder-head .we33-num{font-size:clamp(9.5px,1.4cqw,11.5px);color:var(--ink-dim)}
${R} .we33-ladder-head .we33-num b{color:var(--gold)}
${R} .we33-track{
  position:relative;height:clamp(7px,1cqw,10px);border-radius:999px;overflow:hidden;
  background:rgba(255,255,255,.06);box-shadow:0 1px 0 rgba(255,255,255,.05) inset;
}
${R} .we33-fill{
  position:absolute;top:0;bottom:0;left:0;width:var(--pct);border-radius:999px;
  background:linear-gradient(90deg,#28E36F,#2FE884 40%,var(--cyan));box-shadow:0 0 18px rgba(47,232,132,.55);
}
${R} .we33-notch{position:absolute;top:0;bottom:0;width:1px;background:rgba(16,20,16,.75)}
${R} .we33-ticks{display:flex;justify-content:space-between;margin-top:6px}
${R} .we33-tick{font-size:clamp(7.5px,1.1cqw,9px);letter-spacing:.1em;color:var(--ink-faint);white-space:nowrap}
${R} .we33-tick--on{color:var(--mint)}

${R} .we33-lines{margin-top:clamp(10px,1.3cqw,14px)}
${R} .we33-line{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:clamp(7px,1cqw,9px) 0;border-bottom:1px dashed rgba(255,255,255,.07);
}
${R} .we33-line:last-child{border-bottom:0}
${R} .we33-line .we33-num{
  display:inline-flex;align-items:center;gap:7px;font-size:clamp(10px,1.6cqw,12.5px);color:var(--ink);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
${R} .we33-ref{
  display:flex;align-items:center;gap:8px;padding:5px 5px 5px clamp(10px,1.4cqw,14px);
  border:1px solid var(--hair);border-radius:999px;background:rgba(255,255,255,.03);
  box-shadow:0 1px 0 rgba(255,255,255,.04) inset;
}
${R} .we33-ref-url{
  flex:1;font-family:var(--mono);font-size:clamp(9.5px,1.3cqw,11.5px);color:var(--ink-dim);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
${R} .we33-copy{
  flex:none;display:inline-flex;align-items:center;gap:6px;cursor:pointer;border:0;border-radius:999px;
  padding:6px clamp(10px,1.4cqw,14px);color:#06301A;font:inherit;font-weight:700;
  font-size:clamp(9.5px,1.3cqw,11px);letter-spacing:.06em;text-transform:uppercase;
  background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));
  box-shadow:0 0 0 1px rgba(255,255,255,.22) inset,0 8px 20px -10px rgba(34,201,232,.9);
  transition:transform .16s ease,filter .16s ease;
}
${R} .we33-copy:hover{transform:translateY(-1px);filter:saturate(1.1)}
${R} .we33-copy:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
${R} .we33-copy .we33-done{display:none}
${R} .we33-copy.is-copied .we33-idle{display:none}
${R} .we33-copy.is-copied .we33-done{display:inline}

${R} .we33-upgrade{margin-top:clamp(11px,1.5cqw,15px)}
${R} .we33-up{
  display:flex;width:100%;align-items:center;gap:clamp(8px,1.2cqw,11px);cursor:pointer;
  padding:6px clamp(12px,1.6cqw,16px) 6px 6px;border-radius:999px;border:1px solid rgba(47,232,132,.34);
  background:linear-gradient(140deg,rgba(47,232,132,.16),rgba(255,255,255,.03) 60%,rgba(34,201,232,.11));
  box-shadow:0 1px 0 rgba(255,255,255,.12) inset,0 12px 24px -20px rgba(47,232,132,.9);
  color:var(--ink);font:inherit;text-align:left;
  transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;
}
${R} .we33-up-chip{
  display:grid;place-items:center;width:clamp(22px,3.2cqw,28px);height:clamp(22px,3.2cqw,28px);border-radius:999px;flex:none;
  background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));color:#06301A;
  font-size:clamp(11px,1.7cqw,13px);font-weight:800;line-height:1;
  box-shadow:0 0 0 1px rgba(255,255,255,.25) inset,0 5px 12px -6px rgba(47,232,132,1);
}
${R} .we33-up-label{display:flex;flex-direction:column;gap:1px;line-height:1.15;min-width:0}
${R} .we33-up-label b{font-size:clamp(10.5px,1.7cqw,12.5px);font-weight:700}
${R} .we33-up-label span{font-size:clamp(7.5px,1.2cqw,9px);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint)}
${R} .we33-up:hover{transform:translateY(-2px);border-color:rgba(47,232,132,.75);box-shadow:0 1px 0 rgba(255,255,255,.16) inset,0 16px 28px -18px rgba(47,232,132,1)}
${R} .we33-up:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
${R} .we33-up:disabled{cursor:not-allowed;transform:none;border-color:var(--hair);background:rgba(255,255,255,.03);box-shadow:none}
${R} .we33-up:disabled .we33-up-chip{background:rgba(255,255,255,.07);color:var(--ink-faint);box-shadow:none}
${R} .we33-up:disabled .we33-up-label b{color:var(--ink-dim)}

${R} .we33-ids{margin-top:auto;padding-top:clamp(11px,1.5cqw,15px)}
${R} .we33-ids-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px}
${R} .we33-chips{display:flex;flex-wrap:wrap;gap:5px;max-height:clamp(86px,12cqw,132px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(47,232,132,.25) transparent}
${R} .we33-chips::-webkit-scrollbar{width:4px}
${R} .we33-chips::-webkit-scrollbar-thumb{background:rgba(47,232,132,.25);border-radius:999px}
${R} .we33-idchip{
  font-family:var(--mono);font-size:clamp(9.5px,1.4cqw,11.5px);font-weight:600;letter-spacing:-.02em;
  padding:5px 10px;border-radius:999px;cursor:pointer;color:var(--ink);
  border:1px solid rgba(47,232,132,.24);background:rgba(255,255,255,.03);
  transition:border-color .16s ease,background .16s ease,transform .16s ease;
}
${R} .we33-idchip:hover{border-color:rgba(47,232,132,.8);background:rgba(47,232,132,.12);transform:translateY(-1px)}
${R} .we33-idchip:focus-visible{outline:2px solid var(--mint);outline-offset:2px}
${R} .we33-idchip--on{border-color:rgba(59,238,140,.85);background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));color:#06301A}
${R} .we33-empty{margin:0;font-size:clamp(9.5px,1.4cqw,11px);color:var(--ink-faint)}

/* ---------- join panel ---------- */
${R} .we33-join{
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
  gap:clamp(9px,1.3cqw,14px);flex:1;padding:clamp(14px,2.4cqw,26px) 0 clamp(6px,1cqw,10px);
}
${R} .we33-join-mark{
  width:clamp(46px,7cqw,62px);height:clamp(46px,7cqw,62px);display:grid;place-items:center;
  border:1px solid rgba(59,238,140,.55);border-radius:clamp(14px,2cqw,20px);
  background:linear-gradient(160deg,rgba(47,232,132,.20),rgba(255,255,255,.02) 65%,rgba(34,201,232,.12));
  box-shadow:0 0 0 1px rgba(47,232,132,.2),0 0 44px -12px rgba(47,232,132,.8),0 1px 0 rgba(255,255,255,.18) inset;
}
${R} .we33-join-mark img{width:72%;height:72%;display:block;object-fit:contain}
${R} .we33-join h2{margin:0;font-size:clamp(18px,3cqw,26px);font-weight:600;letter-spacing:-.01em;line-height:1.1}
${R} .we33-join p{margin:0;max-width:34ch;font-size:clamp(10.5px,1.5cqw,12.5px);line-height:1.55;color:var(--ink-dim)}
${R} .we33-join-form{display:flex;align-items:center;gap:8px;width:100%;max-width:340px;margin-top:2px}
${R} .we33-join-field{
  flex:1;display:flex;align-items:center;gap:8px;padding:6px 6px 6px clamp(12px,1.6cqw,16px);
  border-radius:999px;border:1px solid var(--hair);background:rgba(255,255,255,.035);
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset;transition:border-color .18s ease,box-shadow .18s ease;
}
${R} .we33-join-field:focus-within{border-color:rgba(47,232,132,.5);box-shadow:0 0 0 3px rgba(47,232,132,.12)}
${R} .we33-join-field input{
  flex:1;border:0;background:transparent;color:var(--ink);font-family:var(--mono);
  font-size:clamp(11px,1.5cqw,13px);outline:none;padding:6px 0;
}
${R} .we33-join-field input::placeholder{color:var(--ink-faint);letter-spacing:.03em}
${R} .we33-join-field input::-webkit-outer-spin-button,${R} .we33-join-field input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
${R} .we33-join-go{
  flex:none;cursor:pointer;border:0;border-radius:999px;color:#06301A;font:inherit;font-weight:700;
  font-size:clamp(10px,1.4cqw,12px);letter-spacing:.07em;text-transform:uppercase;
  padding:10px clamp(16px,2.2cqw,24px);
  background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));
  box-shadow:0 0 0 1px rgba(255,255,255,.22) inset,0 12px 26px -12px rgba(34,201,232,.9);
  transition:transform .16s ease,filter .16s ease;
}
${R} .we33-join-go:hover{transform:translateY(-1px);filter:saturate(1.1)}
${R} .we33-join-go:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
${R} .we33-join-note{font-size:clamp(8.5px,1.2cqw,10px);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-faint)}
${R} .we33-join-perks{
  display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:2px;
}
${R} .we33-join-perk{
  display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;
  border:1px solid var(--hair);background:rgba(255,255,255,.025);
  font-size:clamp(9px,1.2cqw,10.5px);color:var(--ink-dim);white-space:nowrap;
}

/* ---------- stat tiles ---------- */
${R} .we33-stats{display:grid;grid-template-columns:1fr 1fr;gap:clamp(6px,.9cqw,9px)}
${R} .we33-stat{
  display:flex;flex-direction:column;
  padding:clamp(7px,1.1cqw,11px) clamp(8px,1.2cqw,12px);border:1px solid var(--hair);
  border-radius:clamp(10px,1.3cqw,13px);background:rgba(255,255,255,.025);
}
${R} .we33-stat .we33-num{display:block;margin-top:3px;font-size:clamp(12px,1.8cqw,15px);color:var(--ink);overflow:hidden;text-overflow:ellipsis}
${R} .we33-stat--gold .we33-num{color:var(--gold)}
${R} .we33-mini{
  margin-top:8px;width:100%;cursor:pointer;border-radius:999px;font:inherit;font-weight:700;
  font-size:clamp(9px,1.2cqw,10.5px);letter-spacing:.1em;text-transform:uppercase;
  padding:5px 10px;color:#06301A;border:0;
  background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));
  box-shadow:0 0 0 1px rgba(255,255,255,.2) inset,0 8px 16px -10px rgba(47,232,132,1);
  transition:transform .16s ease,filter .16s ease;
}
${R} .we33-mini:hover{transform:translateY(-1px);filter:saturate(1.1)}
${R} .we33-mini:focus-visible{outline:2px solid var(--mint);outline-offset:2px}

/* ---------- dapp info ---------- */
${R} .we33-seats{margin-top:clamp(10px,1.3cqw,14px);display:flex;flex-direction:column;gap:clamp(5px,.8cqw,8px)}
${R} .we33-seat{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px}
${R} .we33-seat-tag{font-size:clamp(8.5px,1.2cqw,10px);font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-dim);width:clamp(34px,4.4cqw,44px)}
${R} .we33-seat-track{height:clamp(5px,.8cqw,7px);border-radius:999px;background:rgba(255,255,255,.055);overflow:hidden}
${R} .we33-seat-track i{
  display:block;height:100%;width:var(--pct);border-radius:999px;min-width:2px;
  background:linear-gradient(90deg,rgba(40,227,111,.9),#22C9E8);
}
${R} .we33-seat .we33-num{font-size:clamp(10px,1.5cqw,12.5px);color:var(--ink)}

/* ---------- section 2: search + switch ---------- */
${R} .we33-searchbar{
  display:flex;align-items:center;gap:8px;width:100%;margin-top:clamp(11px,1.4cqw,15px);
  padding:5px 5px 5px clamp(12px,1.6cqw,18px);border-radius:999px;
  border:1px solid var(--hair);background:rgba(255,255,255,.035);
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset;
  transition:border-color .18s ease,box-shadow .18s ease;
}
${R} .we33-searchbar:focus-within{border-color:rgba(47,232,132,.5);box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 0 0 3px rgba(47,232,132,.12)}
${R} .we33-input{
  flex:1;border:0;background:transparent;color:var(--ink);font-family:var(--mono);
  font-size:clamp(11px,1.6cqw,13.5px);letter-spacing:-.01em;outline:none;padding:7px 0;
}
${R} .we33-input::placeholder{color:var(--ink-faint);letter-spacing:.04em}
${R} .we33-input::-webkit-outer-spin-button,${R} .we33-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
${R} .we33-go{
  flex:none;display:inline-flex;align-items:center;gap:7px;cursor:pointer;border:0;border-radius:999px;
  padding:8px clamp(13px,1.8cqw,18px);color:#06301A;font:inherit;font-weight:700;
  font-size:clamp(10px,1.4cqw,12px);letter-spacing:.07em;text-transform:uppercase;
  background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));
  box-shadow:0 0 0 1px rgba(255,255,255,.22) inset,0 10px 22px -10px rgba(34,201,232,.9);
  transition:transform .16s ease,filter .16s ease;
}
${R} .we33-go:hover{transform:translateY(-1px);filter:saturate(1.1)}
${R} .we33-go:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
${R} .we33-glass{width:clamp(15px,2cqw,19px);height:clamp(15px,2cqw,19px);display:block;flex:none}
${R} .we33-go-text{display:none}
@container box (min-width:360px){${R} .we33-go-text{display:inline}}

${R} .we33-switch{
  display:inline-flex;padding:3px;gap:2px;border-radius:clamp(10px,1.3cqw,13px);
  border:1px solid var(--hair);background:rgba(255,255,255,.03);box-shadow:0 1px 0 rgba(255,255,255,.04) inset;
}
${R} .we33-tab{
  cursor:pointer;user-select:none;border-radius:clamp(8px,1cqw,11px);
  padding:clamp(5px,.9cqw,7px) clamp(9px,1.6cqw,15px);
  font-size:clamp(9px,1.3cqw,11px);font-weight:600;letter-spacing:.07em;text-transform:uppercase;
  color:var(--ink-dim);transition:color .18s ease,background .18s ease,box-shadow .18s ease;
}
${R} .we33-tab:hover{color:var(--ink)}
${tabOn([T4, T8])}
${R} .we33-d4:focus-visible ~ .we33-layout [for="${rid}-d4"],
${R} .we33-d8:focus-visible ~ .we33-layout [for="${rid}-d8"]{outline:2px solid var(--mint);outline-offset:3px}

/* ---------- map ---------- */
${R} .we33-scroll{overflow-x:auto;overflow-y:hidden;overflow-anchor:none;scrollbar-width:thin;scrollbar-color:rgba(47,232,132,.28) transparent}
${R} .we33-scroll::-webkit-scrollbar{height:4px}
${R} .we33-scroll::-webkit-scrollbar-thumb{background:rgba(47,232,132,.26);border-radius:999px}
${R} .we33-board{width:100%;overflow-anchor:none;padding:clamp(12px,1.8cqw,18px) 1px clamp(4px,.8cqw,8px)}
${R} .we33-row{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:var(--rowgap);justify-items:center}
${R} .we33-r4{--fs-id:clamp(10px,1.9cqw,15px);--fs-addr:clamp(7.5px,1.2cqw,10px);--fs-rank:clamp(6.8px,1cqw,9px);--mark:clamp(8px,1.3cqw,12px)}
${R} .we33-r8{--fs-id:clamp(9px,1.35cqw,13px);--fs-addr:clamp(7px,.95cqw,9px);--fs-rank:clamp(6.4px,.9cqw,8.5px);--mark:clamp(7px,1cqw,10px);--cardpad:clamp(4px,.7cqw,8px)}

${R} .we33-card{
  position:relative;display:flex;flex-direction:column;align-items:stretch;gap:clamp(3px,.6cqw,6px);
  width:100%;max-width:min(var(--w),100%);
  padding:var(--cardpad) calc(var(--cardpad)*.85);
  border:1px solid rgba(47,232,132,.28);border-radius:var(--cardradius);text-align:left;
  background:linear-gradient(165deg,rgba(255,255,255,.07),rgba(255,255,255,.012) 55%,rgba(34,201,232,.06));
  box-shadow:0 1px 0 rgba(255,255,255,.07) inset,0 14px 26px -24px rgba(0,0,0,.95);
  color:inherit;font:inherit;cursor:pointer;
  transition:transform .2s cubic-bezier(.2,.7,.3,1),border-color .2s ease,box-shadow .2s ease;
}
${R} button.we33-card:hover{transform:translateY(-2px);border-color:rgba(47,232,132,.85);box-shadow:0 18px 28px -22px rgba(47,232,132,.9)}
${R} button.we33-card:focus-visible{outline:2px solid var(--mint);outline-offset:2px}
${R} .we33-top{display:flex;align-items:center;justify-content:space-between;gap:4px}
${R} .we33-mark{width:var(--mark);height:var(--mark);display:block;flex:none;object-fit:contain}
${R} .we33-rank{
  font-size:var(--fs-rank);font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;
  color:#06301A;background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));padding:1.5px clamp(4px,.8cqw,8px);border-radius:999px;
}
${R} .we33-id{
  align-self:center;font-family:var(--mono);font-size:var(--fs-id);font-weight:600;letter-spacing:-.03em;
  line-height:1.25;color:var(--ink);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
${R} .we33-addr{
  display:inline-flex;align-items:center;gap:clamp(3px,.6cqw,5px);align-self:flex-start;max-width:100%;
  font-family:var(--mono);font-size:var(--fs-addr);line-height:1.3;color:var(--ink-faint);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
${R} .we33-tag{font-size:clamp(7.5px,1.2cqw,9.5px);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-faint);text-align:center;width:100%}
${R} .we33-card--open{border:1px dashed rgba(255,255,255,.13);background:rgba(255,255,255,.012);box-shadow:none;justify-content:center;min-height:clamp(38px,6cqw,54px)}
${R} .we33-card--open:hover{transform:none;border-color:rgba(255,255,255,.22);box-shadow:none}
${R} .we33-card--muted{border:1px dashed rgba(255,255,255,.1);background:transparent;box-shadow:none;cursor:default;justify-content:center;min-height:clamp(38px,6cqw,54px)}
${R} .we33-card--focus{
  --fs-id:clamp(14px,2.6cqw,20px);--fs-addr:clamp(8.5px,1.5cqw,11px);--mark:clamp(11px,1.9cqw,17px);
  border-color:rgba(59,238,140,.75);
  background:linear-gradient(165deg,rgba(47,232,132,.20),rgba(255,255,255,.02) 62%,rgba(34,201,232,.12));
  box-shadow:0 0 0 1px rgba(47,232,132,.25),0 0 40px -14px rgba(47,232,132,.75),0 1px 0 rgba(255,255,255,.16) inset;
}

${R} .we33-dot{display:grid;place-items:center;height:clamp(20px,3.4cqw,30px);width:100%}
${R} .we33-dot i{width:clamp(5px,.9cqw,7px);height:clamp(5px,.9cqw,7px);border-radius:50%;background:rgba(255,255,255,.1);box-shadow:0 0 0 clamp(2px,.6cqw,4px) rgba(255,255,255,.022)}
${R} .we33-arms{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr))}
${R} .we33-arm,${R} .we33-trunk{position:relative;height:var(--arm)}
${R} .we33-arm i,${R} .we33-trunk i{position:absolute;display:block}
${R} .we33-stem{left:50%;top:0;width:1px;height:44%;margin-left:-.5px;background:var(--line)}
${R} .we33-bow{
  left:25%;right:25%;top:44%;bottom:0;
  border-top:1px solid var(--line);border-left:1px solid var(--line);border-right:1px solid var(--line);
  border-radius:clamp(6px,1cqw,10px) clamp(6px,1cqw,10px) 0 0;
}
${R} .we33-trunk i{left:50%;top:0;bottom:0;width:1px;margin-left:-.5px;background:var(--line)}
${R} .we33-arm--off .we33-stem,${R} .we33-trunk.we33-arm--off i{background:var(--line-off)}
${R} .we33-arm--off .we33-bow{border-color:var(--line-off)}


/* ---------- modals ---------- */
${R} .we33-modal{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;padding:16px}
${R} .we33-modal.is-open{display:flex}
${R} .we33-modal-bg{position:absolute;inset:0;background:rgba(3,6,4,.78);backdrop-filter:blur(6px)}
${R} .we33-modal-card{
  position:relative;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;
  border:1px solid rgba(47,232,132,.2);border-radius:20px;padding:18px;color:var(--ink);
  background:
    radial-gradient(100% 70% at 50% -10%, rgba(47,232,132,.14), transparent 60%),
    radial-gradient(70% 55% at 105% 108%, rgba(34,201,232,.10), transparent 70%),
    linear-gradient(180deg,#101613 0%, #0B100D 60%, #070908 100%);
  box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 40px 90px -40px rgba(0,0,0,1);
}
${R} .we33-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
${R} .we33-modal-head h3{margin:4px 0 0;font-size:17px;font-weight:600;letter-spacing:-.01em}
${R} .we33-x{
  flex:none;width:30px;height:30px;border-radius:999px;cursor:pointer;border:1px solid var(--hair);
  background:rgba(255,255,255,.03);color:var(--ink-dim);font-size:15px;line-height:1;
}
${R} .we33-x:hover{color:var(--ink);border-color:rgba(47,232,132,.5)}
${R} .we33-doc{
  overflow-y:auto;padding:14px 16px;margin-bottom:12px;border:1px solid var(--hair);border-radius:14px;
  background:rgba(255,255,255,.02);font-size:12px;line-height:1.65;color:var(--ink-dim);
  scrollbar-width:thin;scrollbar-color:rgba(47,232,132,.3) transparent;
}
${R} .we33-doc::-webkit-scrollbar{width:5px}
${R} .we33-doc::-webkit-scrollbar-thumb{background:rgba(47,232,132,.28);border-radius:999px}
${R} .we33-doc h4{margin:0 0 4px;font-size:13.5px;color:var(--ink);font-weight:600}
${R} .we33-doc h5{margin:16px 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mint)}
${R} .we33-doc p{margin:0 0 8px}
${R} .we33-doc-date{font-family:var(--mono);font-size:10.5px;color:var(--ink-faint)}
${R} .we33-doc-warn{margin-top:14px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.1);color:var(--gold)}
${R} .we33-check{
  display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:11px 13px;border-radius:13px;
  border:1px solid var(--hair);background:rgba(255,255,255,.025);font-size:11.5px;line-height:1.5;color:var(--ink-dim);
}
${R} .we33-check input{width:17px;height:17px;flex:none;margin:1px 0 0;accent-color:#2FE884;cursor:pointer}
${R} .we33-field{margin-bottom:10px}
${R} .we33-field > span{display:block;margin-bottom:6px}
${R} .we33-field input{
  width:100%;padding:11px 14px;border-radius:999px;border:1px solid var(--hair);
  background:rgba(255,255,255,.035);color:var(--ink);font-family:var(--mono);font-size:12.5px;outline:none;
}
${R} .we33-field input:focus{border-color:rgba(47,232,132,.55);box-shadow:0 0 0 3px rgba(47,232,132,.12)}
${R} .we33-field input::-webkit-outer-spin-button,${R} .we33-field input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
${R} .we33-modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
${R} .we33-btn{
  cursor:pointer;border-radius:999px;padding:11px 20px;font:inherit;font-weight:700;font-size:11.5px;
  letter-spacing:.07em;text-transform:uppercase;border:1px solid var(--hair);color:var(--ink-dim);
  background:rgba(255,255,255,.03);transition:color .16s ease,border-color .16s ease,transform .16s ease;
}
${R} .we33-btn:hover{color:var(--ink);border-color:rgba(47,232,132,.45)}
${R} .we33-btn--go{
  border:0;color:#06301A;background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));
  box-shadow:0 0 0 1px rgba(255,255,255,.2) inset,0 12px 26px -12px rgba(34,201,232,.9);
}
${R} .we33-btn--go:hover{transform:translateY(-1px)}
${R} .we33-btn:disabled{cursor:not-allowed;opacity:.4;transform:none;box-shadow:none}
${R} .we33-btn:focus-visible,${R} .we33-x:focus-visible{outline:2px solid var(--mint);outline-offset:3px}

/* status dialog */
${R} .we33-status-card{max-width:400px;text-align:center;align-items:center}
${R} .we33-orb{
  width:62px;height:62px;margin:6px auto 14px;border-radius:999px;display:grid;place-items:center;
  font-size:26px;line-height:1;color:#06301A;
}
${R} .we33-orb::before{content:'';position:absolute;width:62px;height:62px;border-radius:999px}
${R} [data-state="pending"] .we33-orb{
  background:conic-gradient(from 0deg,transparent 0turn,#2FE884 .55turn,var(--cyan) .85turn,transparent 1turn);
  animation:we33-spin 1s linear infinite;
}
${R} [data-state="pending"] .we33-orb span{
  display:block;width:48px;height:48px;border-radius:999px;background:#0A0E0C;
}
${R} [data-state="done"] .we33-orb{background:linear-gradient(135deg,#4BF092,#25DD8B 45%,var(--cyan));box-shadow:0 0 40px -8px rgba(47,232,132,.8)}
${R} [data-state="error"] .we33-orb{background:rgba(255,255,255,.06);border:1px solid rgba(255,120,120,.5);color:#FF8B8B}
${R} [data-state="pending"] .we33-orb span::after,${R} [data-state="pending"] .we33-status-done,${R} [data-state="pending"] .we33-status-foot{display:none}
${R} .we33-status-msg{margin:0;font-size:12px;line-height:1.6;color:var(--ink-dim)}
${R} .we33-status-tx{
  display:inline-block;max-width:100%;margin-top:12px;padding:8px 14px;border-radius:999px;cursor:pointer;
  border:1px solid var(--hair);background:rgba(255,255,255,.03);
  font-family:var(--mono);font-size:11px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
${R} .we33-status-tx:hover{color:var(--ink);border-color:rgba(47,232,132,.45)}
${R} .we33-status-tx.is-copied::after{content:' — copied';color:var(--mint)}
@keyframes we33-spin{to{transform:rotate(1turn)}}

/* ---------- depth: auto until the user picks ---------- */
${R} .we33-lv8{display:none}
${R} .we33-d8:checked ~ .we33-layout .we33-lv8{display:grid}
${R} .we33-hint{display:none;margin:5px 0 0;text-align:center;font-size:clamp(7.5px,1.2cqw,9.5px);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-faint)}

@container box (min-width:500px){
  ${tabOn([A8])}
  ${R} .we33-auto:checked ~ .we33-layout .we33-lv8{display:grid}
}
@container box (max-width:499.98px){
  ${tabOn([A4])}
  ${R} .we33-d8:checked ~ .we33-layout .we33-board{min-width:520px}
  ${R} .we33-d8:checked ~ .we33-layout .we33-hint{display:block}
  ${R} .we33-lv8 .we33-addr{display:none}
}
@media (prefers-reduced-motion:reduce){${R} *{transition:none!important}}
</style>`;
}

/* --------------------------------- main --------------------------------- */

/**
 * @param {string} account connected wallet, or the zero address
 * @param {any} dappData getDappData result
 * @param {any} spotsData getSpotsData result (16 positions)
 * @param {{defaultDepth?:'auto'|4|8, frame?:boolean,
 *          balances?:{point?:any,redeem?:any,airdrop?:any,usdt?:any},
 *          refBase?:string}} [options]
 * @returns {string} HTML
 */
export function renderSpots(account, dappData, spotsData, options = {}) {
  const { defaultDepth = 'auto', frame = true, refBase = REF_BASE, logoUrl: logo = LOGO_URL } = options;
  const balances = readBalances(options.balances);

  const rid = `we33-${++__uid}`;
  const input = resolveInputs(dappData, spotsData);
  const spots = input.spots;
  const dapp = readDapp(input.dapp);
  const connected = isConnected(account);

  const at = (i) => spots[i] ?? null;
  const live = (i) => isLive(at(i));

  // Reachable = every ancestor down from the focus is taken. Anything else is a
  // dead branch and collapses to a dot.
  const reach = new Array(16).fill(false);
  reach[1] = true;
  for (let i = 2; i < 16; i++) reach[i] = reach[i >> 1] && live(i >> 1);

  const cell = (i) => {
    if (live(i)) return liveCard(at(i), logo);
    if (reach[i]) return openCard();
    return dot();
  };

  const row = (idxs, width, cls = '') => `
    <div class="we33-row ${cls}" style="--cols:${idxs.length};--w:${width}px">
      ${idxs.map(cell).join('')}
    </div>`;

  const focus = at(1);
  const focusLive = live(1);
  const focusId = focusLive ? String(spotId(focus)) : '0';
  const rank = focusLive ? Number(spotRank(focus) ?? 0) : 0;
  const owner = spotOwner(focus) ?? {};
  const ids = focusLive ? heldIds(owner) : [];
  const focusValue = focusLive ? spotValue(focus) : 0;
  const ladder = rankProgress(focusValue);
  const atTop = rank >= 6;

  const stat = (label, value, opts = {}) => `
    <div class="we33-stat${opts.gold ? ' we33-stat--gold' : ''}">
      <span class="we33-label">${label}</span>
      <span class="we33-num">${esc(value)}</span>
      ${opts.action ? `<button type="button" class="we33-mini" data-action="${opts.action}" onclick="${opts.js}">${opts.cta}</button>` : ''}
    </div>`;

  const line = (label, addr) =>
    `<div class="we33-line"><span class="we33-label">${label}</span>${addressLine(addr, 'we33-num', 6, 6)}</div>`;

  const sponsorId = options.sponsorId != null ? numArg(options.sponsorId) : '';
  const openAgree = `__we33.open('${rid}','agree')`;
  const openTransfer = `__we33.open('${rid}','transfer')`;
  const doRegister = `var v=(document.getElementById('${rid}-ref')||{}).value;`
    + `if(!v){__we33.set('${rid}','error','Sponsor id missing','Enter the sponsor id that referred you.');return}`
    + `__we33.close('${rid}','agree');`
    + `__we33.run('${rid}',['registerExt'],[v],'Registration')`;
  const doUprank = `__we33.run('${rid}',['uprankExt'],[${numArg(focusId)}],'Rank upgrade')`;
  const doRedeem = `__we33.run('${rid}',['redeemWEExt'],[],'Redeem')`;
  const doTransfer = `__we33.close('${rid}','transfer');`
    + `__we33.run('${rid}',['transferWE','trasnferWE'],`
    + `[document.getElementById('${rid}-to').value,document.getElementById('${rid}-amt').value],'Transfer')`;

  const refLink = `${refBase}${focusId}`;
  const copyJs = "navigator.clipboard&&navigator.clipboard.writeText(this.dataset.link);"
    + "this.classList.add('is-copied');var b=this;setTimeout(function(){b.classList.remove('is-copied')},1400)";

  const pick = (v) => (defaultDepth === v ? ' checked' : '');
  // Fixed, not absolute: tapping a label focuses its radio, and the browser
  // scrolls a focused off-screen element into view. A fixed element is always
  // "in view", so the page stays exactly where it is.
  const hidden = 'style="position:fixed;top:0;left:0;width:1px;height:1px;'
    + 'opacity:0;pointer-events:none;margin:0;z-index:-1"';
  const goSearch = call('searchFocus', `document.getElementById('${rid}-q').value`);

  const ticks = [1, 2, 3, 4, 5, 6]
    .map((r) => `<span class="we33-tick${ladder.rank >= r ? ' we33-tick--on' : ''}">R${r}</span>`).join('');
  const notches = [1, 2, 3, 4].map((i) => `<i class="we33-notch" style="left:${i * 20}%"></i>`).join('');

  const seatCounts = dapp.seats.map(toNumber);
  const seatTotal = seatCounts.reduce((a, b) => a + b, 0);
  const seatPeak = Math.max(1, ...seatCounts);
  const seatRows = seatCounts.map((n, i) => `
    <div class="we33-seat">
      <span class="we33-seat-tag">Rank ${i + 1}</span>
      <div class="we33-seat-track"><i style="--pct:${((n / seatPeak) * 100).toFixed(1)}%"></i></div>
      <span class="we33-num">${formatCount(n)}</span>
    </div>`).join('');

  const identityScreen = /*html*/`
          <header class="we33-head">
            <div>
              <p class="we33-eyebrow">Focus position</p>
              <h2 class="we33-title">Spot <b>${esc(focusId)}</b></h2>
            </div>
            <span class="we33-rankpill">Rank ${rank}</span>
          </header>

          <div class="we33-hero">
            <span class="we33-label">Position value</span>
            <span class="we33-num">${formatUnits(focusValue)}</span>
          </div>

          <div class="we33-ladder">
            <div class="we33-ladder-head">
              <span class="we33-label">Rank ladder</span>
              <span class="we33-num">${ladder.next
                ? `${formatUnits(focusValue)} <b>/ ${ladder.target}</b> to rank ${ladder.next}`
                : '<b>Top rank reached</b>'}</span>
            </div>
            <div class="we33-track">
              <div class="we33-fill" style="--pct:${ladder.pct.toFixed(2)}%"></div>
              ${notches}
            </div>
            <div class="we33-ticks">${ticks}</div>
          </div>

          <div class="we33-lines">
            ${line('Account', ownerField(owner, 'account'))}
            ${line('Referrer', ownerField(owner, 'referrer'))}
          </div>

          <div class="we33-group">
            <span class="we33-label">Referral link</span>
            <div class="we33-ref">
              <span class="we33-ref-url" title="${esc(refLink)}">${esc(refLink)}</span>
              <button type="button" class="we33-copy" data-action="copy-link" data-link="${esc(refLink)}"
                      onclick="${esc(copyJs)}">
                <span class="we33-idle">Copy</span><span class="we33-done">Copied</span>
              </button>
            </div>
          </div>

          <div class="we33-upgrade">
            <button type="button" class="we33-up" data-action="upgrade-rank"
                    data-spot-id="${esc(focusId)}" data-current-rank="${rank}" data-next-rank="${Math.min(rank + 1, 6)}"
                    onclick="${doUprank}" ${focusLive && !atTop ? '' : 'disabled'}>
              <span class="we33-up-chip" aria-hidden="true">↑</span>
              <span class="we33-up-label">
                <b>${atTop ? 'Rank 6 reached' : `Upgrade to Rank ${rank + 1}`}</b>
                <span>${focusLive ? `from rank ${rank}` : 'no position'}</span>
              </span>
            </button>
          </div>

          <div class="we33-ids">
            <div class="we33-ids-head">
              <span class="we33-label">Positions held</span>
              <span class="we33-label we33-label--dim">${ids.length}</span>
            </div>
            ${ids.length
              ? `<div class="we33-chips">${ids.map((id) => `
                <button type="button" class="we33-idchip${id === focusId ? ' we33-idchip--on' : ''}"
                        onclick="${call('searchFocus', numArg(id))}" data-spot-id="${esc(id)}">${esc(id)}</button>`).join('')}</div>`
              : '<p class="we33-empty">No positions on this account yet.</p>'}
          </div>`;

  const joinScreen = /*html*/`
          <div class="we33-join">
            <span class="we33-join-mark">${mark(logo, '')}</span>
            <h2>Join WE33</h2>
            <p>This wallet does not hold a position yet. Register one to open your
               matrix, start earning affiliate rewards and climb the rank ladder.</p>

            <div class="we33-join-perks">
              <span class="we33-join-perk">6 ranks</span>
              <span class="we33-join-perk">16 spot matrix</span>
              <span class="we33-join-perk">Affiliate rewards</span>
            </div>

            ${connected ? `
            <div class="we33-join-form">
              <div class="we33-join-field">
                <input id="${rid}-ref" type="number" inputmode="numeric" min="1" step="1"
                       value="${esc(sponsorId)}" placeholder="Sponsor id (required)" aria-label="Sponsor id"
                       oninput="document.getElementById('${rid}-join-go').disabled=!this.value">
              </div>
              <button type="button" class="we33-join-go" id="${rid}-join-go" data-action="register"
                      onclick="${openAgree}" ${sponsorId ? '' : 'disabled'}>Register</button>
            </div>
            <span class="we33-join-note">A sponsor id is required to register</span>` : `
            <button type="button" class="we33-connect" data-action="connect-wallet"
                    onclick="${call('connectWallet')}" style="margin-top:4px">
              <span>Connect wallet to register</span>
            </button>
            <span class="we33-join-note">A wallet is needed before registering</span>`}
          </div>`;

  const walletPanel = /*html*/`      <!-- 1b — wallet -->
      <div class="we33-panel">
        <div class="we33-content">
          <header class="we33-head">
            <div>
              <p class="we33-eyebrow">Wallet</p>
              <h2 class="we33-title">Earnings and balances</h2>
            </div>
          </header>

          <div class="we33-group">
            <span class="we33-label">Earnings</span>
            <div class="we33-stats">
              ${stat('Total profit', formatUnits(ownerField(owner, 'profit')), { gold: true })}
              ${stat('Total affiliate', formatUnits(ownerField(owner, 'affiliate')), { gold: true })}
              ${stat('Reinvest', formatCount(ownerField(owner, 'reinvest')))}
              ${stat('Direct', formatCount(ownerField(owner, 'direct')))}
            </div>
          </div>

          <div class="we33-group">
            <span class="we33-label">Balances</span>
            <div class="we33-stats">
              ${stat('WE Point', formatUnits(balances.point), { action: 'transfer', js: openTransfer, cta: 'Transfer' })}
              ${stat('Redeem balance', formatUnits(balances.redeem), { gold: true, action: 'redeem', js: doRedeem, cta: 'Redeem' })}
              ${stat('WE Airdrop', formatUnits(balances.airdrop), { gold: true })}
              ${stat('Wallet USDT', formatUnits(balances.usdt))}
            </div>
          </div>
        </div>
      </div>`;

  const mapPanel = /*html*/`      <!-- 2a — position map -->
      <div class="we33-panel we33-panel--lead">
        <div class="we33-aurora" aria-hidden="true"></div>
        <div class="we33-mesh" aria-hidden="true"></div>
        <div class="we33-content">
          <header class="we33-head">
            <div>
              <p class="we33-eyebrow">WE33 matrix</p>
              <h2 class="we33-title">Position map</h2>
            </div>
            <div class="we33-switch" role="group" aria-label="Matrix depth">
              <label class="we33-tab" for="${rid}-d4">Base 4</label>
              <label class="we33-tab" for="${rid}-d8">Base 8</label>
            </div>
          </header>

          <div class="we33-searchbar">
            <input id="${rid}-q" class="we33-input" type="number" inputmode="numeric" min="0" step="1"
                   placeholder="Search any spot id" aria-label="Search a spot id"
                   onkeydown="if(event.key==='Enter'){event.preventDefault();${goSearch}}">
            <button type="button" class="we33-go" data-action="search-id" aria-label="Search"
                    onclick="${goSearch}">${glassIcon}<span class="we33-go-text">Search</span></button>
          </div>

          <div class="we33-scroll">
            <div class="we33-board">

              <div class="we33-row" style="--cols:1;--w:150px">
                ${live(0) ? liveCard(at(0), logo) : mutedCard('No upline')}
              </div>
              ${trunk(live(0))}

              <div class="we33-row" style="--cols:1;--w:180px">
                ${focusLive ? liveCard(focus, logo, 'we33-card--focus') : openCard('we33-card--focus')}
              </div>
              ${arms([focusLive])}

              ${row([2, 3], 150)}
              ${arms([2, 3].map(live))}

              ${row([4, 5, 6, 7], 130, 'we33-r4')}
              ${arms([4, 5, 6, 7].map(live), 'we33-lv8')}

              ${row([8, 9, 10, 11, 12, 13, 14, 15], 115, 'we33-lv8 we33-r8')}

            </div>
          </div>
          <p class="we33-hint">Scroll sideways for the full base</p>
        </div>
      </div>`;

  return /*html*/`
<section id="${rid}">
  ${styles(rid, frame)}

  <input type="radio" id="${rid}-auto" name="${rid}-depth" class="we33-auto" ${hidden}${pick('auto')}>
  <input type="radio" id="${rid}-d4" name="${rid}-depth" class="we33-d4" ${hidden}${pick(4)}>
  <input type="radio" id="${rid}-d8" name="${rid}-depth" class="we33-d8" ${hidden}${pick(8)}>

  <!-- navbar -->
  <div class="we33-nav">
    <div class="we33-mesh" aria-hidden="true"></div>
    <div class="we33-brand">
      <span class="we33-brand-mark">${mark(logo, '')}</span>
      <span class="we33-brand-text"><b>WE33</b><span>matrix protocol</span></span>
    </div>
    ${connected
      ? `<button type="button" class="we33-wallet" data-action="connect-wallet" onclick="${call('connectWallet')}"
                 title="${esc(account)}" data-address="${esc(account)}">
           <i class="we33-live" aria-hidden="true"></i>
           <span class="we33-nav-long">${esc(shortAddress(account, 6, 6))}</span>
           <span class="we33-nav-short">${esc(shortAddress(account, 3, 4))}</span>
         </button>`
      : `<button type="button" class="we33-connect" data-action="connect-wallet" onclick="${call('connectWallet')}">
           <span class="we33-nav-long">Connect wallet</span><span class="we33-nav-short">Connect</span>
         </button>`}
  </div>

  <div class="we33-layout">

    <!-- column 1 -->
    <div class="we33-col">

      <!-- 1a — identity, or the join screen when nothing is active -->
      <div class="we33-panel we33-panel--lead">
        <div class="we33-aurora" aria-hidden="true"></div>
        <div class="we33-mesh" aria-hidden="true"></div>
        <div class="we33-content">
          ${focusLive ? identityScreen : joinScreen}
        </div>
      </div>

      ${focusLive ? walletPanel : ''}

    </div>

    <!-- column 2 -->
    <div class="we33-col">

      ${focusLive ? mapPanel : ''}

      <!-- 2b — dapp info -->
      <div class="we33-panel${focusLive ? '' : ' we33-panel--lead'}">
        <div class="we33-content">
          <header class="we33-head">
            <div>
              <p class="we33-eyebrow">Network</p>
              <h2 class="we33-title">Dapp info</h2>
            </div>
          </header>

          <div class="we33-group">
            <div class="we33-stats">
              ${stat('Total positions', formatCount(dapp.latestPosition))}
              ${stat('Global direct', formatCount(dapp.globalDirect))}
            </div>
          </div>

          <div class="we33-group">
            <div class="we33-ids-head">
              <span class="we33-label">Seats by rank</span>
              <span class="we33-label we33-label--dim">${formatCount(seatTotal)} total</span>
            </div>
            <div class="we33-seats">${seatRows}</div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- runtime bootstrap: inline handlers survive innerHTML, script tags do not -->
  <img alt="" aria-hidden="true" src="data:," style="position:fixed;width:0;height:0;opacity:0;pointer-events:none"
       onload="${esc(RUNTIME)}" onerror="${esc(RUNTIME)}">

  <!-- agreement -->
  <div class="we33-modal" id="${rid}-agree" role="dialog" aria-modal="true" aria-label="Participation terms">
    <div class="we33-modal-bg" onclick="__we33.close('${rid}','agree')"></div>
    <div class="we33-modal-card">
      <div class="we33-modal-head">
        <div>
          <p class="we33-eyebrow">Before you register</p>
          <h3>Risk warning and terms</h3>
        </div>
        <button type="button" class="we33-x" aria-label="Close" onclick="__we33.close('${rid}','agree')">✕</button>
      </div>
      <div class="we33-doc">${AGREEMENT_HTML}</div>
      <label class="we33-check">
        <input type="checkbox" id="${rid}-accept"
               onchange="document.getElementById('${rid}-accept-go').disabled=!this.checked">
        <span>I have read, studied, and fully understood all risk warnings, agreements, and participation
              terms of the WE33 platform. I accept them and understand that participation is entirely
              voluntary, with no guarantee of any price, value, reward, income, profit, or return.</span>
      </label>
      <div class="we33-modal-foot">
        <button type="button" class="we33-btn" onclick="__we33.close('${rid}','agree')">Cancel</button>
        <button type="button" class="we33-btn we33-btn--go" id="${rid}-accept-go" disabled
                onclick="${doRegister}">Accept and register</button>
      </div>
    </div>
  </div>

  <!-- transfer -->
  <div class="we33-modal" id="${rid}-transfer" role="dialog" aria-modal="true" aria-label="Transfer WE">
    <div class="we33-modal-bg" onclick="__we33.close('${rid}','transfer')"></div>
    <div class="we33-modal-card" style="max-width:420px">
      <div class="we33-modal-head">
        <div>
          <p class="we33-eyebrow">WE Point</p>
          <h3>Transfer WE</h3>
        </div>
        <button type="button" class="we33-x" aria-label="Close" onclick="__we33.close('${rid}','transfer')">✕</button>
      </div>
      <label class="we33-field">
        <span class="we33-label">Recipient address</span>
        <input id="${rid}-to" type="text" spellcheck="false" placeholder="0x…" autocomplete="off"
               oninput="document.getElementById('${rid}-send').disabled=!(this.value&&document.getElementById('${rid}-amt').value)">
      </label>
      <label class="we33-field">
        <span class="we33-label">Amount</span>
        <input id="${rid}-amt" type="number" inputmode="decimal" min="0" step="any" placeholder="0.00"
               oninput="document.getElementById('${rid}-send').disabled=!(this.value&&document.getElementById('${rid}-to').value)">
      </label>
      <div class="we33-modal-foot">
        <button type="button" class="we33-btn" onclick="__we33.close('${rid}','transfer')">Cancel</button>
        <button type="button" class="we33-btn we33-btn--go" id="${rid}-send" disabled
                onclick="${doTransfer}">Send</button>
      </div>
    </div>
  </div>

  <!-- transaction status -->
  <div class="we33-modal" id="${rid}-status" data-state="pending" role="dialog" aria-modal="true" aria-live="polite">
    <div class="we33-modal-bg" onclick="__we33.close('${rid}','status')"></div>
    <div class="we33-modal-card we33-status-card">
      <div class="we33-orb"><span></span></div>
      <h3 id="${rid}-status-title" style="margin:0 0 8px;font-size:16px;font-weight:600">Working</h3>
      <p class="we33-status-msg" id="${rid}-status-msg"></p>
      <span class="we33-status-tx" id="${rid}-status-tx" style="display:none"
            title="Copy transaction hash" onclick="__we33.copyTx(this)"></span>
      <div class="we33-modal-foot we33-status-foot" style="justify-content:center">
        <button type="button" class="we33-btn we33-btn--go" onclick="__we33.close('${rid}','status')">Close</button>
      </div>
    </div>
  </div>
</section>`;
}

export default renderSpots;