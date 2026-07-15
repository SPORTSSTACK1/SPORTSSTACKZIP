var _ssPageStart = Date.now();

// SportsStack Member System v1.5
const SS_URL = 'https://syntfyfsyjiuowclarpf.supabase.co';
const SS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnRmeWZzeWppdW93Y2xhcnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODgwNzgsImV4cCI6MjA5NTk2NDA3OH0.jQVBQo7tnv1RBEnCdzZCIvx8vVjsaXWRfZ3VNm1__Ig';
let ssClient, ssUser = null;


async function syncProfile(user) {
  try {
    // full_name is the display name they chose at sign-up — always use it
    const username = (user.user_metadata && user.user_metadata.full_name)
      ? user.user_metadata.full_name
      : (user.email ? user.email.split('@')[0] : 'Member');
    await ssClient.from('profiles').upsert({id: user.id, username}, {onConflict: 'id', ignoreDuplicates: false});
  } catch(e) {}
}


// ── Daily streak tracking ──────────────────────────────────────────────
const DAILY_SLUGS = new Set([
  'career-path','pl-38-zero','transferotd',
  'clubble','sportsman-au','sportsman-pl','sportsman-us'
]);
// Pages that specifically award World Cup stickers
const STICKER_SLUGS = new Set(['career-path','transferotd','sportsman-pl']);

async function recordDailyCompletion() {
  if (!ssUser || !ssClient) return;
  const today = new Date().toISOString().split('T')[0];
  try {
    await ssClient.from('daily_completions')
      .upsert({user_id: ssUser.id, completed_date: today},
              {onConflict: 'user_id,completed_date', ignoreDuplicates: true});
    loadStreak();
  } catch(e) {}
}

async function loadStreak() {
  if (!ssUser || !ssClient) return;
  try {
    const {data} = await ssClient
      .from('daily_completions')
      .select('completed_date')
      .eq('user_id', ssUser.id)
      .order('completed_date', {ascending: false})
      .limit(365);

    if (!data || !data.length) { updateStreakBadge(0); return; }

    const dates = new Set(data.map(r => r.completed_date));
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().split('T')[0];

    // Start from today; if not yet completed, start from yesterday
    let check = new Date(today);
    if (!dates.has(todayStr)) check.setDate(check.getDate() - 1);

    let streak = 0;
    while (true) {
      const ds = check.toISOString().split('T')[0];
      if (dates.has(ds)) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    updateStreakBadge(streak);
  } catch(e) {}
}

function updateStreakBadge(n) {
  const el = document.getElementById('ss-streak-badge');
  if (!el) return;
  if (n > 0) {
    el.textContent = '\uD83D\uDD25 ' + n;
    el.style.display = 'inline-flex';
  } else {
    el.style.display = 'none';
  }
}



const WC_NATIONS = [
  {n:"Mexico",         f:"🇲🇽",g:"A",r:"S",bg:"#006847",acc:"#CE1126",w:0},
  {n:"South Africa",   f:"🇿🇦",g:"A",r:"B",bg:"#007A4D",acc:"#FFB612",w:0},
  {n:"South Korea",    f:"🇰🇷",g:"A",r:"S",bg:"#C60C30",acc:"#003478",w:0},
  {n:"Czechia",        f:"🇨🇿",g:"A",r:"B",bg:"#11457E",acc:"#D7141A",w:0},
  {n:"Canada",         f:"🇨🇦",g:"B",r:"B",bg:"#9E0B0F",acc:"#FFFFFF",w:0},
  {n:"Bosnia & Herzegovina",f:"🇧🇦",g:"B",r:"B",bg:"#002395",acc:"#FFCA01",w:0},
  {n:"Qatar",          f:"🇶🇦",g:"B",r:"B",bg:"#6A0B3D",acc:"#FFFFFF",w:0},
  {n:"Switzerland",    f:"🇨🇭",g:"B",r:"S",bg:"#CC0000",acc:"#FFFFFF",w:0},
  {n:"Brazil",         f:"🇧🇷",g:"C",r:"G",bg:"#009B3A",acc:"#FFDF00",w:5},
  {n:"Morocco",        f:"🇲🇦",g:"C",r:"S",bg:"#006233",acc:"#C1272D",w:0},
  {n:"Haiti",          f:"🇭🇹",g:"C",r:"B",bg:"#00209F",acc:"#D21034",w:0},
  {n:"Scotland",       f:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",g:"C",r:"B",bg:"#003399",acc:"#FFFFFF",w:0},
  {n:"United States",  f:"🇺🇸",g:"D",r:"S",bg:"#002868",acc:"#BF0A30",w:0},
  {n:"Paraguay",       f:"🇵🇾",g:"D",r:"B",bg:"#0038A8",acc:"#D52B1E",w:0},
  {n:"Australia",      f:"🇦🇺",g:"D",r:"S",bg:"#00284A",acc:"#FFD700",w:0},
  {n:"Turkiye",        f:"🇹🇷",g:"D",r:"B",bg:"#AA0C00",acc:"#FFFFFF",w:0},
  {n:"Germany",        f:"🇩🇪",g:"E",r:"G",bg:"#1a1a1a",acc:"#DD0000",w:4},
  {n:"Curacao",        f:"🇨🇼",g:"E",r:"B",bg:"#002B7F",acc:"#F9E814",w:0},
  {n:"Ivory Coast",    f:"🇨🇮",g:"E",r:"S",bg:"#F77F00",acc:"#009A44",w:0},
  {n:"Ecuador",        f:"🇪🇨",g:"E",r:"S",bg:"#003087",acc:"#FFD100",w:0},
  {n:"Netherlands",    f:"🇳🇱",g:"F",r:"G",bg:"#CC4400",acc:"#FFFFFF",w:0},
  {n:"Japan",          f:"🇯🇵",g:"F",r:"S",bg:"#0a0a0a",acc:"#BD0029",w:0},
  {n:"Sweden",         f:"🇸🇪",g:"F",r:"S",bg:"#006AA7",acc:"#FECC02",w:0},
  {n:"Tunisia",        f:"🇹🇳",g:"F",r:"B",bg:"#A0001C",acc:"#FFFFFF",w:0},
  {n:"Belgium",        f:"🇧🇪",g:"G",r:"S",bg:"#1a1a1a",acc:"#FAD201",w:0},
  {n:"Egypt",          f:"🇪🇬",g:"G",r:"B",bg:"#8A0000",acc:"#FFFFFF",w:0},
  {n:"Iran",           f:"🇮🇷",g:"G",r:"B",bg:"#239F40",acc:"#DA0000",w:0},
  {n:"New Zealand",    f:"🇳🇿",g:"G",r:"B",bg:"#00247D",acc:"#CC142B",w:0},
  {n:"Spain",          f:"🇪🇸",g:"H",r:"G",bg:"#C60B1E",acc:"#FFC400",w:1},
  {n:"Cape Verde",     f:"🇨🇻",g:"H",r:"B",bg:"#003893",acc:"#CF2027",w:0},
  {n:"Saudi Arabia",   f:"🇸🇦",g:"H",r:"B",bg:"#006C35",acc:"#FFFFFF",w:0},
  {n:"Uruguay",        f:"🇺🇾",g:"H",r:"S",bg:"#0b4e9e",acc:"#FFFFFF",w:2},
  {n:"France",         f:"🇫🇷",g:"I",r:"G",bg:"#002395",acc:"#ED2939",w:2},
  {n:"Senegal",        f:"🇸🇳",g:"I",r:"S",bg:"#00853F",acc:"#FDEF42",w:0},
  {n:"Iraq",           f:"🇮🇶",g:"I",r:"B",bg:"#007A3D",acc:"#CE1126",w:0},
  {n:"Norway",         f:"🇳🇴",g:"I",r:"B",bg:"#C01820",acc:"#FFFFFF",w:0},
  {n:"Argentina",      f:"🇦🇷",g:"J",r:"G",bg:"#5AAAEE",acc:"#FFFFFF",w:3},
  {n:"Algeria",        f:"🇩🇿",g:"J",r:"B",bg:"#006233",acc:"#D21034",w:0},
  {n:"Austria",        f:"🇦🇹",g:"J",r:"S",bg:"#CC0000",acc:"#FFFFFF",w:0},
  {n:"Jordan",         f:"🇯🇴",g:"J",r:"B",bg:"#007A3D",acc:"#CE1126",w:0},
  {n:"Portugal",       f:"🇵🇹",g:"K",r:"G",bg:"#006600",acc:"#FF2400",w:0},
  {n:"DR Congo",       f:"🇨🇩",g:"K",r:"B",bg:"#007FFF",acc:"#F7D900",w:0},
  {n:"Uzbekistan",     f:"🇺🇿",g:"K",r:"B",bg:"#1EB53A",acc:"#CE1126",w:0},
  {n:"Colombia",       f:"🇨🇴",g:"K",r:"S",bg:"#003087",acc:"#FCD116",w:0},
  {n:"England",        f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",g:"L",r:"G",bg:"#0a1628",acc:"#CF111A",w:1},
  {n:"Croatia",        f:"🇭🇷",g:"L",r:"S",bg:"#171796",acc:"#FF0000",w:0},
  {n:"Ghana",          f:"🇬🇭",g:"L",r:"B",bg:"#006B3F",acc:"#FCD116",w:0},
  {n:"Panama",         f:"🇵🇦",g:"L",r:"B",bg:"#CC0001",acc:"#FFFFFF",w:0},
];

const WC_RARITY = {
  B: {label:"Bronze",  border:"#CD7F32", glow:"rgba(205,127,50,0.45)",  shimmer:"rgba(205,127,50,0.2)"},
  S: {label:"Silver",  border:"#A8A9AD", glow:"rgba(192,192,192,0.55)", shimmer:"rgba(220,220,220,0.25)"},
  G: {label:"Gold",    border:"#FFD700", glow:"rgba(255,215,0,0.65)",   shimmer:"rgba(255,215,0,0.3)"}
};


// ── World Cup Sticker Book ────────────────────────────────────────────

async function awardWorldCupSticker() {
  if (!ssUser || !ssClient) return;
  var slug  = location.pathname.split('/').pop().replace('.html','');
  var today = new Date().toISOString().split('T')[0];
  try {
    // Check if already earned from this game today
    var checkRes = await ssClient.from('world_cup_stickers')
      .select('id').eq('user_id', ssUser.id)
      .eq('source_game', slug).gte('earned_at', today).limit(1);
    if (checkRes.data && checkRes.data.length > 0) {
      showToast('\uD83C\uDFB4 Sticker already earned from this game today', false);
      return;
    }

    // Get owned nations to avoid duplicates
    var ownedRes = await ssClient.from('world_cup_stickers').select('nation').eq('user_id', ssUser.id);
    var ownedSet = new Set((ownedRes.data||[]).map(function(s){ return s.nation; }));
    var remaining = WC_NATIONS.filter(function(n){ return !ownedSet.has(n.n); });
    if (!remaining.length) { showToast('\uD83C\uDF1F You have all 48 stickers!', true); return; }

    // Weighted random by rarity
    var gold   = remaining.filter(function(n){ return n.r==='G'; });
    var silver = remaining.filter(function(n){ return n.r==='S'; });
    var bronze = remaining.filter(function(n){ return n.r==='B'; });
    var roll = Math.random(), pool;
    if      (roll < 0.10 && gold.length)   pool = gold;
    else if (roll < 0.35 && silver.length) pool = silver;
    else if (bronze.length)                pool = bronze;
    else if (silver.length)                pool = silver;
    else                                   pool = gold;
    var pick = pool[Math.floor(Math.random() * pool.length)];

    // Show card FIRST before any DB operations
    showStickerReveal(pick, ownedSet.size + 1);

    // Save in background
    var insRes = await ssClient.from('world_cup_stickers').insert({
      user_id: ssUser.id, nation: pick.n, source_game: slug,
      earned_at: new Date().toISOString()
    });
    if (insRes.error) showToast('Note: sticker not saved — ' + insRes.error.message, false);

    var bm = document.getElementById('ss-banner-msg');
    if (bm) { bm.style.color = '#4ade80'; bm.textContent = '\u2705 Sticker earned! (' + pick.n + ')'; }
  } catch(err) {
    showToast('Sticker error: ' + (err && err.message ? err.message : String(err)), false);
  }
}

function buildStickerCard(nation, size) {
  var rar = WC_RARITY[nation.r] || WC_RARITY.B;
  var w   = size === 'lg' ? 160 : 100;
  var h   = size === 'lg' ? 220 : 140;
  var flagSize  = size === 'lg' ? '62px' : '38px';
  var nameSize  = size === 'lg' ? '14px' : '9px';
  var grpSize   = size === 'lg' ? '9px'  : '7px';
  var rarSize   = size === 'lg' ? '9px'  : '7px';
  var stars = nation.r === 'G' ? '<span style="color:'+rar.border+';font-size:'+(size==='lg'?'11':'8')+'px;letter-spacing:-1px">&#9733;</span>' : '';

  return '<div style="width:'+w+'px;height:'+h+'px;border-radius:11px;' +
    'background:'+nation.bg+';' +
    'border:2px solid '+rar.border+';' +
    'box-shadow:0 0 18px '+rar.glow+',0 4px 12px rgba(0,0,0,0.55);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:space-between;' +
    'padding:9px 6px 7px;position:relative;overflow:hidden;flex-shrink:0">' +

    // shimmer
    '<div style="position:absolute;top:0;left:-100%;width:50%;height:100%;' +
      'background:linear-gradient(90deg,transparent,'+rar.shimmer+',transparent);' +
      'animation:wcShimmer '+(nation.r==='G'?'1.8':'2.6')+'s ease infinite;pointer-events:none"></div>' +

    // rarity badge top-right
    '<div style="position:absolute;top:6px;right:6px;' +
      'background:'+rar.border+';color:'+(nation.r==='G'?'#000':'#000')+';' +
      'font-family:Barlow Condensed,sans-serif;font-size:'+rarSize+';font-weight:900;' +
      'letter-spacing:.1em;text-transform:uppercase;padding:1px 5px;border-radius:4px;' +
      'opacity:0.92">'+rar.label+'</div>' +

    // group top-left
    '<div style="font-family:Barlow Condensed,sans-serif;font-size:'+grpSize+';font-weight:900;' +
      'letter-spacing:.14em;color:'+rar.border+';text-transform:uppercase;align-self:flex-start">GROUP '+nation.g+'</div>' +

    // crest + flag
    '<div style="position:relative;width:'+(size==='lg'?78:50)+'px;height:'+(size==='lg'?82:54)+'px;display:flex;align-items:center;justify-content:center">' +
      '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.22" viewBox="0 0 78 84">' +
        '<path fill="'+nation.acc+'" d="M8 4L70 4L70 52Q70 76 39 82Q8 76 8 52Z"/>' +
      '</svg>' +
      '<div style="font-size:'+flagSize+';line-height:1;position:relative;z-index:1;' +
        'filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5))">'+nation.f+'</div>' +
    '</div>' +

    // name + stars
    '<div style="text-align:center">' +
      (nation.w > 0 ? '<div style="font-size:'+(size==='lg'?'11':'7')+'px;letter-spacing:-1px;color:'+(nation.r==='G'?rar.border:'#c9a227')+';margin-bottom:1px">'+'&#9733;'.repeat(nation.w)+'</div>' : '') +
      '<div style="font-family:Barlow Condensed,sans-serif;font-size:'+nameSize+';font-weight:900;' +
        'color:#fff;text-transform:uppercase;letter-spacing:.05em;text-shadow:0 1px 4px rgba(0,0,0,0.6)">'+nation.n+'</div>' +
      '<div style="font-size:'+(size==='lg'?'7':'6')+'px;color:rgba(255,255,255,0.4);letter-spacing:.1em">FIFA WC 2026</div>' +
    '</div>' +
  '</div>';
}

function buildLockedCard(nation, size) {
  var rar = WC_RARITY[nation.r] || WC_RARITY.B;
  var w   = size === 'lg' ? 160 : 100;
  var h   = size === 'lg' ? 220 : 140;
  var nameSize = size === 'lg' ? '14px' : '9px';
  return '<div style="width:'+w+'px;height:'+h+'px;border-radius:11px;' +
    'background:#0a0f1a;' +
    'border:1px dashed '+(nation.r==='G'?'#4a3800':nation.r==='S'?'#2a2a2a':'#1e3355')+';' +
    'opacity:0.5;display:flex;flex-direction:column;align-items:center;justify-content:space-between;' +
    'padding:9px 6px 7px;flex-shrink:0;position:relative">' +
    '<div style="font-family:Barlow Condensed,sans-serif;font-size:7px;font-weight:900;' +
      'letter-spacing:.12em;color:'+(nation.r==='G'?'#3a2800':nation.r==='S'?'#2a2a2a':'#1e3355')+';' +
      'text-transform:uppercase">'+rar.label+'</div>' +
    '<div style="font-size:'+(size==='lg'?'32':'22')+'px;color:#1e3355">?</div>' +
    '<div style="font-family:Barlow Condensed,sans-serif;font-size:'+nameSize+';font-weight:900;' +
      'color:#1e3355;text-transform:uppercase;text-align:center">'+nation.n+'</div>' +
  '</div>';
}


function injectStickerStyles() {
  if (document.getElementById('wc-sticker-styles')) return;
  const s = document.createElement('style');
  s.id = 'wc-sticker-styles';
  s.textContent = `
@keyframes wcShimmer{0%{left:-100%}100%{left:200%}}
@keyframes wcOverlayIn{from{opacity:0}to{opacity:1}}
@keyframes wcCardIn{from{transform:scale(0.6) rotate(-8deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
@keyframes wcFlip{0%{transform:rotateY(0)}100%{transform:rotateY(180deg)}}
@keyframes wcPop{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
.wc-flip-wrap{perspective:800px;width:160px;height:220px}
.wc-flip-inner{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform 0.7s cubic-bezier(.4,0,.2,1)}
.wc-flip-inner.flipped{transform:rotateY(180deg)}
.wc-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.wc-face-back{transform:rotateY(0)}
.wc-face-front{transform:rotateY(180deg)}
  `;
  document.head.appendChild(s);
}

function showStickerReveal(nation, totalOwned) {
  injectStickerStyles();
  // Back of card
  const backHTML = `<div style="width:160px;height:220px;border-radius:12px;
    background:linear-gradient(150deg,#0a1628,#0d2040);
    border:2px solid #f5c842;
    box-shadow:0 0 20px rgba(245,200,66,0.35);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
    <div style="font-size:48px">&#x26BD;</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;
      color:#f5c842;letter-spacing:.12em;text-transform:uppercase">World Cup</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;
      color:rgba(245,200,66,0.6);letter-spacing:.1em">2026</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:800;
      color:#1a3355;letter-spacing:.16em;text-transform:uppercase;margin-top:8px">SportsStack</div>
  </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'wc-reveal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99999;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'animation:wcOverlayIn .3s ease;padding:20px;text-align:center';

  overlay.innerHTML = `
    <div style="font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
      color:#6b8abf;margin-bottom:8px">Daily Game Complete</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:clamp(28px,6vw,42px);font-weight:900;
      text-transform:uppercase;color:#f5c842;margin-bottom:4px;letter-spacing:.04em">
      &#x2728; New Sticker!</div>
    <div style="font-size:13px;color:#6b8abf;margin-bottom:28px">
      You earned a World Cup 2026 sticker</div>
    <div class="wc-flip-wrap" id="wc-flip" style="margin-bottom:20px;cursor:pointer" onclick="this.querySelector('.wc-flip-inner').classList.add('flipped')">
      <div class="wc-flip-inner" id="wc-flip-inner">
        <div class="wc-face wc-face-back">${backHTML}</div>
        <div class="wc-face wc-face-front">${buildStickerCard(nation,'lg')}</div>
      </div>
    </div>
    <div id="wc-reveal-name" style="font-family:'Barlow Condensed',sans-serif;font-size:22px;
      font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.08em;
      margin-bottom:4px;opacity:0;transition:opacity .4s">${nation.n}</div>
    <div id="wc-reveal-count" style="font-size:12px;color:#6b8abf;margin-bottom:24px;
      opacity:0;transition:opacity .4s">${totalOwned} / 48 collected</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <a href="profile.html#stickers" style="padding:10px 24px;background:#f5c842;color:#04080f;
        border-radius:50px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;
        letter-spacing:.08em;text-transform:uppercase;text-decoration:none">View Collection</a>
      <button onclick="document.getElementById('wc-reveal-overlay').remove()"
        style="padding:10px 24px;background:transparent;color:#6b8abf;
        border:1px solid #1a3355;border-radius:50px;font-family:'Barlow Condensed',sans-serif;
        font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer">
        Continue</button>
    </div>
    <div style="font-size:11px;color:#1e3355;margin-top:12px">Tap the card to reveal</div>
  `;

  document.body.appendChild(overlay);

  // Auto-flip after 1s, reveal name after flip
  setTimeout(() => {
    const inner = document.getElementById('wc-flip-inner');
    if (inner) inner.classList.add('flipped');
    setTimeout(() => {
      const n = document.getElementById('wc-reveal-name');
      const c = document.getElementById('wc-reveal-count');
      if (n) n.style.opacity = '1';
      if (c) c.style.opacity = '1';
    }, 700);
  }, 1000);
}

// ── Sticker availability banner ───────────────────────────────────────
async function injectStickerBanner() {
  const slug = location.pathname.split('/').pop().replace('.html','');
  if (!STICKER_SLUGS.has(slug)) return;

  // Build banner element
  const banner = document.createElement('div');
  banner.id = 'ss-sticker-banner';
  banner.style.cssText = [
    'background:linear-gradient(135deg,#0d2040,#1a3a6a)',
    'border-bottom:2px solid #f5c842',
    'padding:8px 16px',
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:12px',
    'font-family:Barlow Condensed,sans-serif',
    'font-size:13px',
    'font-weight:700',
    'letter-spacing:.04em',
    'flex-wrap:wrap',
    'position:relative',
    'z-index:50'
  ].join(';');

  banner.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;color:#f5c842">' +
      '<span style="font-size:18px">&#x1F30D;</span>' +
      '<span>World Cup 2026 Sticker Book</span>' +
      '<span id="ss-banner-msg" style="color:#e8f0fe;font-weight:500;font-size:12px">' +
        (ssUser ? 'Complete today to earn a random nation sticker' : 'Sign in to earn stickers') +
      '</span>' +
    '</div>' +
    '<a href="profile.html#stickers" style="color:#f5c842;font-size:11px;font-weight:800;' +
      'letter-spacing:.1em;text-transform:uppercase;text-decoration:none;white-space:nowrap">' +
      'View Collection \u2192' +
    '</a>';

  // Insert after nav or at top of body
  const nav = document.querySelector('nav');
  if (nav && nav.nextSibling) {
    nav.parentNode.insertBefore(banner, nav.nextSibling);
  } else {
    document.body.insertBefore(banner, document.body.firstChild);
  }

  // If logged in, check if sticker already earned today
  if (ssUser && ssClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const {data} = await ssClient
        .from('world_cup_stickers')
        .select('nation,earned_at')
        .eq('user_id', ssUser.id)
        .gte('earned_at', today)
        .eq('source_game', slug)
        .limit(1);
      const msg = document.getElementById('ss-banner-msg');
      if (msg) {
        if (data && data.length > 0) {
          msg.style.color = '#4ade80';
          msg.textContent = '\u2705 Sticker earned today! (' + data[0].nation + ')';
        } else {
          msg.textContent = 'Complete today to earn a random nation sticker \uD83C\uDFB4';
        }
      }
    } catch(e) {}
  }
}


// ── First-visit sticker book welcome modal ───────────────────────────
function showStickerWelcome() {
  if (location.pathname.indexOf('index') < 0 && location.pathname !== '/' && !location.pathname.endsWith('/')) return;
  if (localStorage.getItem('ss_sticker_v2')) return;
  localStorage.setItem('ss_sticker_v2', '1');
  injectStickerStyles();

  var sample = [
    {n:"Argentina",f:"\uD83C\uDDE6\uD83C\uDDF7",g:"J",r:"G",bg:"#5AAAEE",acc:"#FFFFFF",w:3},
    {n:"Morocco",f:"\uD83C\uDDF2\uD83C\uDDE6",g:"C",r:"S",bg:"#006233",acc:"#C1272D",w:0},
    {n:"Australia",f:"\uD83C\uDDE6\uD83C\uDDFA",g:"D",r:"B",bg:"#00284A",acc:"#FFD700",w:0}
  ].map(function(n){return buildStickerCard(n,'sm');}).join('');

  var btn = document.createElement('button');
  btn.style.cssText = 'padding:12px 32px;background:#f5c842;color:#04080f;border:none;border-radius:50px;font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-bottom:8px';
  btn.textContent = 'Start Collecting';
  btn.onclick = function(){ var o=document.getElementById('ss-welcome-overlay'); if(o) o.remove(); };

  var inner = document.createElement('div');
  inner.style.cssText = 'max-width:480px;width:100%;background:#080f1c;border:1px solid #1a3a6a;border-radius:16px;padding:28px 24px;text-align:center';
  inner.innerHTML =
    '<div style="font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#6b8abf;margin-bottom:8px">New Feature</div>' +
    '<div style="font-family:Barlow Condensed,sans-serif;font-size:clamp(24px,6vw,36px);font-weight:900;text-transform:uppercase;color:#f5c842;margin-bottom:4px">World Cup Sticker Book</div>' +
    '<div style="font-size:13px;color:#6b8abf;margin-bottom:18px;line-height:1.7">Collect all 48 nations from the 2026 World Cup.<br>Complete <strong style="color:#e8f0fe">Career Path</strong>, <strong style="color:#e8f0fe">Deal of the Day</strong> or <strong style="color:#e8f0fe">Sportsman PL</strong> to earn a random sticker. Up to <strong style="color:#f5c842">3 stickers per day</strong>.</div>' +
    '<div style="display:flex;gap:10px;justify-content:center;margin-bottom:18px">' + sample + '</div>' +
    '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:18px;flex-wrap:wrap">' +
      '<span style="background:#FFD700;color:#000;font-size:9px;font-weight:900;padding:2px 7px;border-radius:4px;letter-spacing:.1em">GOLD 10%</span>' +
      '<span style="background:#A8A9AD;color:#000;font-size:9px;font-weight:900;padding:2px 7px;border-radius:4px;letter-spacing:.1em">SILVER 25%</span>' +
      '<span style="background:#CD7F32;color:#000;font-size:9px;font-weight:900;padding:2px 7px;border-radius:4px;letter-spacing:.1em">BRONZE 65%</span>' +
    '</div>';
  inner.appendChild(btn);

  var link = document.createElement('div');
  link.innerHTML = '<a href="profile.html#stickers" style="font-size:11px;color:#1e3355;text-decoration:none">View your collection \u2192</a>';
  inner.appendChild(link);

  var overlay = document.createElement('div');
  overlay.id = 'ss-welcome-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:wcOverlayIn .3s ease';
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
}


(async function init() {
  if (typeof supabase === 'undefined') return;
  ssClient = supabase.createClient(SS_URL, SS_KEY);
  const { data: { user } } = await ssClient.auth.getUser();
  ssUser = user;
  if (ssUser) { syncProfile(ssUser); loadStreak(); }
  ssClient.auth.onAuthStateChange((_e, session) => {
    ssUser = session?.user || null;
    if (ssUser) { syncProfile(ssUser); loadStreak(); }
    renderWidget();
  });
  injectWidget();
  renderWidget();
  watchForQuizCompletion();
  watchForModalCompletion();
  injectStickerBanner();
  setTimeout(showStickerWelcome, 600);
})();

function injectWidget() {
  if (document.getElementById('ss-member-widget')) return;
  const el = document.createElement('div');
  el.id = 'ss-member-widget';
  el.style.cssText = 'position:fixed;top:10px;right:14px;z-index:9999;display:flex;align-items:center;gap:8px';
  document.body.appendChild(el);
}

function renderWidget() {
  const w = document.getElementById('ss-member-widget');
  if (!w) return;
  if (ssUser) {
    const name = ssUser.user_metadata?.full_name || ssUser.email || 'U';
    const initials = name.split(/[\s@]/).map(p => p[0]).join('').slice(0,2).toUpperCase();
    w.innerHTML = '<span id="ss-streak-badge" style="display:none;align-items:center;'
      + 'background:rgba(245,200,66,0.15);border:1px solid rgba(245,200,66,0.4);'
      + 'border-radius:20px;padding:3px 10px;font-size:13px;font-weight:700;'
      + 'color:#f5c842;margin-right:6px;"></span>'
      + '<a href="profile.html" title="My Profile"'
      + ' style="width:34px;height:34px;border-radius:50%;background:#f5c842;color:#04080f;'
      + 'display:inline-flex;align-items:center;justify-content:center;'
      + "font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:14px;"
      + 'text-decoration:none;flex-shrink:0;border:2px solid rgba(245,200,66,.4)">'
      + initials + '</a>';
  } else {
    w.innerHTML = '<a href="auth.html"'
      + ' style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:800;'
      + 'letter-spacing:.08em;text-transform:uppercase;padding:7px 16px;background:#f5c842;'
      + 'color:#04080f;border-radius:8px;text-decoration:none;display:inline-block;white-space:nowrap">'
      + 'Sign In</a>';
  }
}

// ── Score detection ───────────────────────────────────────────────────────
function extractScore(banner) {
  const won  = banner.classList.contains('win');
  const sub  = banner.querySelector('.rb-sub');
  const text = sub ? sub.textContent : '';

  // Format 1: "11 / 11 named" or "7 / 25 correct" — standard X/Y (1-3 digits only, avoids matching years like 1990/91)
  const m = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  if (m) return { score: parseInt(m[1]), total: parseInt(m[2]), completed: won };

  // Format 2: "You named all 17 teams!" — perfect score, no slash
  // Skip 4-digit years; find first number between 1 and 99
  if (won) {
    const nums = (text.match(/\d+/g) || []).map(Number);
    const total = nums.find(n => n > 0 && n < 500);
    if (total) return { score: total, total, completed: true };
    // Fallback: specific #total element only (not wildcard)
    const hudTotal = document.getElementById('total');
    if (hudTotal) {
      const t = parseInt(hudTotal.textContent);
      if (t > 0 && t < 500) return { score: t, total: t, completed: true };
    }
  }

  // Format 3: gave up / time up — "X / Y teams found"
  const loseM = text.match(/(\d+)\s*[\/]\s*(\d+)/);
  if (loseM) return { score: parseInt(loseM[1]), total: parseInt(loseM[2]), completed: false };

  return null;
}

function watchForQuizCompletion() {
  const resultEl = document.getElementById('result');
  if (!resultEl) return;
  const obs = new MutationObserver(() => {
    const banner = resultEl.querySelector('.result-banner');
    if (!banner || banner.dataset.saved) return;
    banner.dataset.saved = '1';

    const result = extractScore(banner);
    if (!result) return;

    const slug = location.pathname.split('/').pop().replace('.html','');
    const name = document.title.replace(' \u2013 SportsStack','').replace(' - SportsStack','').trim();
    saveResult(slug, name, result.score, result.total, result.completed);
    if(typeof ssAfterQuizComplete === 'function') ssAfterQuizComplete(slug, name, result.score, result.total);
  });
  obs.observe(resultEl, { childList: true, subtree: true });
}

// ── Modal-pattern watcher (NFL, NBA, AFL, MLB etc quizzes) ──────────────
function watchForModalCompletion() {
  const backdrop = document.getElementById('modal-backdrop');
  if (!backdrop) return;

  const obs = new MutationObserver(() => {
    const modal = document.getElementById('modal');
    if (!modal || !modal.classList.contains('show') && !backdrop.classList.contains('show')) return;
    if (modal.dataset.saved) return;
    modal.dataset.saved = '1';

    const won   = modal.classList.contains('win');
    const scoreEl = document.getElementById('modal-score');
    const text  = scoreEl ? scoreEl.textContent : '';

    // Parse "X / Y found" or "X / Y"
    const m = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (!m) return;

    const score = parseInt(m[1]);
    const total = parseInt(m[2]);
    if (total <= 0) return;

    const slug = location.pathname.split('/').pop().replace('.html','');
    const name = document.title.replace(' \u2013 SportsStack','').replace(' - SportsStack','').trim();
    saveResult(slug, name, score, total, won);
  });

  obs.observe(backdrop, { attributes: true, attributeFilter: ['class'] });
  obs.observe(backdrop, { childList: true, subtree: true });
}

async function trackPlay() {
  try {
    var r = await fetch(SS_URL+'/rest/v1/play_events',{
      method:'POST',
      headers:{
        'apikey':SS_KEY,
        'Authorization':'Bearer '+SS_KEY,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({created_at: new Date().toISOString()})
    });
    if(!r.ok){ var t=await r.text(); console.warn('trackPlay failed:',r.status,t); }
  } catch(e){ console.warn('trackPlay error:',e); }
}

// ── Quiz section catalog for "next quiz" suggestions ──────────────────────────
var QUIZ_SECTIONS = [
  { label:'World Cup', quizzes:[
    {s:'wc-quiz-of-day',n:'World Cup Quiz of the Day'},
    {s:'wc-8-zero',n:'World Cup 8-0 Challenge'},
    {s:'wc-nations-wins-quiz',n:'Most WC Wins'},
    {s:'wc-appearances-quiz',n:'Most WC Appearances'},
    {s:'wc-host-nations-quiz',n:'Host Nations'},
    {s:'wc-winners-quiz',n:'WC Winners'},
    {s:'wc-finalists-quiz',n:'WC Finalists'},
    {s:'wc-top-scorers-quiz',n:'Top WC Scorers'},
    {s:'wc-final-scorers-quiz',n:'WC Final Scorers'}
  ]},
  { label:'Premier League', quizzes:[
    {s:'pl-38-zero',n:'38-0 PL Challenge'},
    {s:'pl-higher-lower',n:'Higher or Lower'},
    {s:'the-stack',n:'The Stack'},
    {s:'sportsman-pl',n:'The Sportsman: PL'},
    {s:'career-path',n:'Career Path'},
    {s:'transferotd',n:'Deal of the Day'},
    {s:'clubble',n:'Clubble'}
  ]},
  { label:'Weekly Quiz', quizzes:[
    {s:'weekly-quiz-2026-06-16',n:'Quiz of the Week #3'},
    {s:'weekly-quiz-2026-06-10',n:'Quiz of the Week #2'},
    {s:'weekly-quiz-2026-05-19',n:'Quiz of the Week #1'}
  ]},
  { label:'Daily Games', quizzes:[
    {s:'who-am-i-quiz',n:'Who Am I?'},
    {s:'sportsman-au',n:'The Sportsman: AUS'},
    {s:'sportsman-us',n:'The Sportsman: US'},
    {s:'career-path',n:'Career Path'},
    {s:'clubble',n:'Clubble'}
  ]}
];

function getNextQuiz(currentSlug) {
  // Find the section this quiz belongs to
  var section = null;
  for (var i=0; i<QUIZ_SECTIONS.length; i++) {
    var qs = QUIZ_SECTIONS[i].quizzes;
    for (var j=0; j<qs.length; j++) {
      if (qs[j].s === currentSlug) { section = QUIZ_SECTIONS[i]; break; }
    }
    if (section) break;
  }
  if (!section) return null;
  // Pick random quiz from same section, excluding current
  var others = section.quizzes.filter(function(q){ return q.s !== currentSlug; });
  if (!others.length) return null;
  return others[Math.floor(Math.random() * others.length)];
}

function dismissCompletionCard(){
  var c=document.getElementById('ss-completion-card');
  if(c) c.remove();
}

function showCompletionCard(slug, name, score, total) {
  dismissCompletionCard();
  var next = getNextQuiz(slug);
  var pct = total > 0 ? Math.round(score/total*100) : 0;
  var emoji = pct === 100 ? '🏆' : pct >= 70 ? '⭐' : '✅';
  var card = document.createElement('div');
  card.id = 'ss-completion-card';
  card.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(120px);z-index:8000;width:calc(100% - 32px);max-width:420px;animation:ss-slide-up .35s ease forwards';
  var nextHtml = next
    ? '<a href="' + next.s + '.html" style="display:block;margin-top:10px;padding:11px 14px;background:rgba(245,200,66,.12);border:1px solid rgba(245,200,66,.3);border-radius:8px;color:#f5c842;text-decoration:none;font-weight:800;font-size:15px">Why not try: ' + next.n + ' →</a>'
    : '';
  var box = document.createElement('div');
  box.style.cssText = 'background:#080f1c;border:1px solid rgba(245,200,66,.4);border-radius:14px;padding:16px 18px;box-shadow:0 8px 40px rgba(0,0,0,.6);position:relative';
  var closeBtn = document.createElement('button');
  closeBtn.setAttribute('onclick','dismissCompletionCard()');
  closeBtn.style.cssText = 'position:absolute;top:10px;right:12px;background:none;border:none;color:#4a6a8a;font-size:16px;cursor:pointer';
  closeBtn.textContent = '✕';
  var body = [
    '<div style="font-size:13px;font-weight:700;color:#00a651;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">' + emoji + ' Congratulations!</div>',
    '<div style="font-size:20px;font-weight:900;color:#e8f0fe;margin-bottom:2px">You completed: ' + name + '</div>',
    '<div style="font-size:12px;color:#7a9ab8;margin-bottom:2px">Score: ' + score + ' / ' + total + '</div>',
    nextHtml
  ].join('');
  box.appendChild(closeBtn);
  box.innerHTML += body;
  var style = document.createElement('style');
  style.textContent = '@keyframes ss-slide-up{to{transform:translateX(-50%) translateY(0)}}';
  card.appendChild(style);
  card.appendChild(box);
  document.body.appendChild(card);
  setTimeout(dismissCompletionCard, 12000);
}


function showSignInPrompt(score, total, name) {
  // Don't show again if already dismissed this session
  if (sessionStorage.getItem('ss-prompt-dismissed')) return;
  const existing = document.getElementById('ss-signin-prompt');
  if (existing) existing.remove();

  const pct = total > 0 ? Math.round(score / total * 100) : 0;
  const emoji = pct === 100 ? '🏆' : pct >= 70 ? '⭐' : '📊';

  const overlay = document.createElement('div');
  overlay.id = 'ss-signin-prompt';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,18,.82);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);animation:ss-fade-in .25s ease';

  overlay.innerHTML = `
    <style>
      @keyframes ss-fade-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
      #ss-signin-prompt .sp-box{background:#080f1c;border:1px solid rgba(245,200,66,.45);border-radius:18px;padding:32px 24px 24px;max-width:340px;width:100%;text-align:center;position:relative;box-shadow:0 0 60px rgba(245,200,66,.12)}
      #ss-signin-prompt .sp-close{position:absolute;top:14px;right:16px;background:none;border:none;color:#4a6a8a;font-size:20px;cursor:pointer;line-height:1;padding:0}
      #ss-signin-prompt .sp-close:hover{color:#e8f0fe}
      #ss-signin-prompt .sp-emoji{font-size:44px;margin-bottom:10px}
      #ss-signin-prompt .sp-score{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:#f5c842;margin-bottom:4px}
      #ss-signin-prompt .sp-head{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:#e8f0fe;margin-bottom:8px}
      #ss-signin-prompt .sp-sub{font-size:13px;color:#7a9ab8;line-height:1.55;margin-bottom:22px}
      #ss-signin-prompt .sp-sub strong{color:#a0c4d8;font-weight:600}
      #ss-signin-prompt .sp-btn-primary{display:block;padding:14px;background:#f5c842;color:#04080f;border-radius:10px;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;text-decoration:none;letter-spacing:.04em;margin-bottom:10px;transition:opacity .15s}
      #ss-signin-prompt .sp-btn-primary:hover{opacity:.9}
      #ss-signin-prompt .sp-btn-secondary{display:block;padding:13px;background:transparent;border:1.5px solid #1a3a6a;color:#e8f0fe;border-radius:10px;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;text-decoration:none;letter-spacing:.04em;margin-bottom:16px;transition:border-color .15s}
      #ss-signin-prompt .sp-btn-secondary:hover{border-color:#3a6a9a}
      #ss-signin-prompt .sp-later{background:none;border:none;color:#4a6a8a;font-size:12px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase}
      #ss-signin-prompt .sp-later:hover{color:#7a9ab8}
    </style>
    <div class="sp-box">
      <button class="sp-close" id="sp-close-btn">✕</button>
      <div class="sp-emoji">${emoji}</div>
      <div class="sp-score">${score} / ${total}</div>
      <div class="sp-head">Save your score</div>
      <div class="sp-sub">Create a free account to <strong>save your results</strong>, track your progress and <strong>compete on the community leaderboard</strong>.</div>
      <a href="auth.html?mode=signup" class="sp-btn-primary">Create Free Account</a>
      <a href="auth.html" class="sp-btn-secondary">Sign In</a>
      <button class="sp-later" id="sp-later-btn">Maybe later</button>
    </div>`;

  document.body.appendChild(overlay);

  function dismiss() {
    sessionStorage.setItem('ss-prompt-dismissed','1');
    overlay.remove();
  }
  document.getElementById('sp-close-btn').addEventListener('click', dismiss);
  document.getElementById('sp-later-btn').addEventListener('click', dismiss);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) dismiss(); });
}

async function saveResult(slug, name, score, total, completed) { // Sanity check — reject scores that look like years or corrupt data
  if (total > 0 && score > total) { console.warn('SS: score > total, skipping save', score, total); return; }
  trackPlay();
  if (!ssUser || !ssClient) {
    setTimeout(function(){ showSignInPrompt(score, total, name); }, 1200);
    return;
  }
  const { data: existing } = await ssClient
    .from('quiz_results').select('score,completed')
    .eq('user_id', ssUser.id).eq('quiz_slug', slug).single();
  const better = !existing || score > existing.score || (!existing.completed && completed);
  if (!better) {
    showCompletionCard(slug, name, score, total);
    if (completed && DAILY_SLUGS.has(slug)) recordDailyCompletion();
    const WC_STICKER_EXCLUDE = new Set(['wc-team-wins-quiz']);
  if (completed && (STICKER_SLUGS.has(slug) || (slug.startsWith('wc-') && !WC_STICKER_EXCLUDE.has(slug)))) awardWorldCupSticker();
    return;
  }
  var _elapsed = _ssPageStart ? Math.round((Date.now() - _ssPageStart) / 1000) : null;
  await ssClient.from('quiz_results').upsert({
    user_id: ssUser.id, quiz_slug: slug, quiz_name: name,
    score, total, completed, time_seconds: _elapsed,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,quiz_slug' });
  if (completed) {
    showCompletionCard(slug, name, score, total);
  } else {
    showCompletionCard(slug, name, score, total);
  }
  if (completed && DAILY_SLUGS.has(slug)) recordDailyCompletion();
  const WC_STICKER_EXCLUDE = new Set(['wc-team-wins-quiz']);
  if (completed && (STICKER_SLUGS.has(slug) || (slug.startsWith('wc-') && !WC_STICKER_EXCLUDE.has(slug)))) awardWorldCupSticker();
}

function showToast(msg, success) {
  let t = document.getElementById('ss-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ss-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
      + "font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;"
      + 'letter-spacing:.06em;padding:12px 24px;border-radius:50px;z-index:99999;'
      + 'transition:opacity .3s;pointer-events:none;white-space:nowrap';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = success ? '#f5c842' : '#1a3a6a';
  t.style.color = success ? '#04080f' : '#e8f0fe';
  t.style.border = success ? 'none' : '1px solid #38bdf8';
  t.style.opacity = '1';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.style.opacity = '0', 3000);
}


// ════════════════════════════════════════════════════════════════
// ── SportsStack Quiz End Features ───────────────────────────────
// ── Share card · Play Next · Schema · Email hook ────────────────
// ════════════════════════════════════════════════════════════════

// ── 1. Quiz schema injection (runs on page load for quiz pages) ──
(function injectQuizSchema(){
  const title = document.title.replace(/\s*[–-]\s*SportsStack\s*/i,'').trim();
  const slug  = location.pathname.split('/').pop().replace('.html','');
  if(!title || title.toLowerCase().includes('sportsstack') || slug === 'index') return;
  const schema = {
    "@context":"https://schema.org",
    "@type":"Quiz",
    "name": title,
    "url": location.href,
    "description": "Test your knowledge with the " + title + " quiz on SportsStack — free sports quizzes covering football, NFL, NBA, cricket and more.",
    "provider":{"@type":"Organization","name":"SportsStack","url":"https://sportsstack.com.au"}
  };
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.textContent = JSON.stringify(schema);
  document.head.appendChild(el);
})();

// ── 2. Play Next mapping (slug prefix → related quiz slugs) ──────
const SS_NEXT_MAP = {
  'pl-tots':      ['pl-golden-boot-quiz','pl-poty-quiz','pl-100-club-quiz','pl-ypoty-quiz'],
  'ucl-tots':     ['ucl-top-scorers-quiz','ucl-winners-quiz','ucl-managers-quiz'],
  'nfl-':         ['nfl-passing-yards-quiz','nfl-dpoty-quiz','nfl-superbowl-quiz','nfl-td-leaders-quiz'],
  'nba-':         ['nba-finals-mvp-quiz','nba-50point-games-quiz','nba-3point-leaders-quiz'],
  'mlb-':         ['mlb-cy-young-quiz','mlb-active-hr-leaders-quiz','al-mvp-quiz'],
  'afl-':         ['afl-appearances-quiz','afl-coleman-medal-quiz','afl-800-goals-quiz'],
  'cricket-':     ['ipl-most-expensive-quiz','t20-all-time-wicket-takers-quiz'],
  'tennis-':      ['wimbledon-womens-quiz','tennis-majors-quiz'],
  'f1-':          ['f1-champions-quiz','f1-race-wins-quiz','f1-pole-positions-quiz'],
  'golf-':        ['masters-golf-quiz','us-open-golf-quiz','open-golf-quiz','pga-golf-quiz'],
  'wsl-':         ['lionesses-euro-2025-quiz','womens-world-cup-quiz','nwsl-champions-quiz'],
  'weekly-quiz':  ['career-path.html','who-am-i-quiz.html','the-stack.html'],
};

function getNextQuizzes(slug) {
  for (const [prefix, list] of Object.entries(SS_NEXT_MAP)) {
    if (slug.startsWith(prefix) || slug.includes(prefix.replace('-',''))) {
      // Shuffle and pick 3, excluding current
      const pool = list.filter(s => !slug.includes(s.replace('-quiz','').replace('.html','')));
      for (let i = pool.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [pool[i],pool[j]] = [pool[j],pool[i]];
      }
      return pool.slice(0,3);
    }
  }
  // Fallback: popular quizzes
  return ['career-path.html','pl-38-zero.html','who-am-i-quiz.html'];
}

function slugToTitle(slug) {
  return slug.replace('.html','').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

// ── 3. Inject Play Next cards after result ───────────────────────
function injectPlayNext(resultEl, slug) {
  if (resultEl.querySelector('.ss-play-next')) return;
  const nexts = getNextQuizzes(slug);
  const div = document.createElement('div');
  div.className = 'ss-play-next';
  div.style.cssText = 'margin-top:20px;text-align:left';
  div.innerHTML = '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;color:#3a5a7a;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Play Next</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">'
    + nexts.map(s => {
        const href = s.includes('.html') ? s : s + '.html';
        const label = slugToTitle(s);
        return '<a href="' + href + '" style="display:block;padding:10px 12px;background:#080f1c;border:1px solid #0d2040;border-radius:8px;color:#e8f0fe;text-decoration:none;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;transition:border-color .15s" onmouseover="this.style.borderColor=\'#f5c842\'" onmouseout="this.style.borderColor=\'#0d2040\'">' + label + '</a>';
      }).join('')
    + '</div>';
  resultEl.appendChild(div);
}

// ── 4. Share card function ────────────────────────────────────────
function injectShareCard(resultEl, quizName, score, total) {
  if (resultEl.querySelector('.ss-share-wrap')) return;
  const pct = Math.round(score/total*100);
  const wrap = document.createElement('div');
  wrap.className = 'ss-share-wrap';
  wrap.style.cssText = 'margin-top:14px;display:flex;gap:8px;justify-content:center';

  // Share button
  const btn = document.createElement('button');
  btn.style.cssText = 'padding:10px 22px;background:#f5c842;color:#04080f;border:none;border-radius:8px;font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:900;cursor:pointer';
  btn.textContent = '📤 Share Score';
  btn.onclick = function(){ shareScore(quizName, score, total, pct); };

  // Copy text button
  const copy = document.createElement('button');
  copy.style.cssText = 'padding:10px 18px;background:#0d1a2e;color:#e8f0fe;border:1px solid #0d2040;border-radius:8px;font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:700;cursor:pointer';
  copy.textContent = '📋 Copy';
  copy.onclick = function(){
    const text = score + '/' + total + ' on ' + quizName + ' (' + pct + '%) 🏆\nsportsstack.com.au';
    navigator.clipboard.writeText(text).then(()=>{copy.textContent='✓ Copied!';setTimeout(()=>{copy.textContent='📋 Copy';},2000);});
  };

  wrap.appendChild(btn);
  wrap.appendChild(copy);
  resultEl.insertBefore(wrap, resultEl.firstChild);
}

function shareScore(quizName, score, total, pct) {
  // Generate branded canvas card
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 315;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#04080f';
  ctx.fillRect(0,0,600,315);

  // Gold top bar
  ctx.fillStyle = '#f5c842';
  ctx.fillRect(0,0,600,5);

  // Side accent
  ctx.fillStyle = '#f5c842';
  ctx.fillRect(0,0,5,315);

  // SportsStack brand
  ctx.fillStyle = '#f5c842';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText('SportsStack', 28, 50);

  // Score (big)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 96px Arial, sans-serif';
  ctx.fillText(score + '/' + total, 28, 170);

  // Percentage
  ctx.fillStyle = '#f5c842';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText(pct + '%', 28, 210);

  // Quiz name (word wrap)
  ctx.fillStyle = '#8899aa';
  ctx.font = '20px Arial, sans-serif';
  const words = quizName.split(' ');
  let line = '', y = 250;
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > 540 && line) {
      ctx.fillText(line.trim(), 28, y);
      line = w + ' '; y += 26;
    } else { line = test; }
  }
  ctx.fillText(line.trim(), 28, y);

  // URL
  ctx.fillStyle = '#334455';
  ctx.font = '15px Arial, sans-serif';
  ctx.fillText('sportsstack.com.au', 28, 305);

  canvas.toBlob(blob => {
    const file = new File([blob], 'sportsstack-score.png', {type:'image/png'});
    if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
      navigator.share({
        title: score + '/' + total + ' on ' + quizName,
        text: 'Can you beat my score? ' + quizName + ' on SportsStack',
        files: [file]
      }).catch(() => downloadImg(canvas, score, total));
    } else {
      downloadImg(canvas, score, total);
    }
  }, 'image/png');
}

function downloadImg(canvas, score, total) {
  const a = document.createElement('a');
  a.download = 'sportsstack-' + score + '-' + total + '.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// ── 5. Email capture (shown once after first completed quiz) ──────
function injectEmailCapture() {
  if (localStorage.getItem('ss-email-captured') || localStorage.getItem('ss-email-dismissed')) return;
  if (typeof ssUser !== 'undefined' && ssUser) return; // already a member

  setTimeout(() => {
    const el = document.createElement('div');
    el.id = 'ss-email-capture';
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#080f1c;border-top:2px solid #f5c842;padding:16px 20px;z-index:8888;display:flex;align-items:center;gap:12px;flex-wrap:wrap;animation:slideUp .3s ease';

    el.innerHTML = '<style>@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}</style>'
      + '<div style="flex:1;min-width:200px">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:900;color:#f5c842">Get the Quiz of the Week</div>'
      + '<div style="font-size:12px;color:#3a5a7a;margin-top:2px">A new 20-question quiz every Monday — free, no spam.</div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-shrink:0">'
      + '<input id="ss-email-input" type="email" placeholder="your@email.com" style="padding:9px 12px;background:#0d1a2e;border:1.5px solid #0d2040;border-radius:7px;color:#e8f0fe;font-size:14px;width:200px"/>'
      + '<button onclick="submitEmailCapture()" style="padding:9px 18px;background:#f5c842;color:#04080f;border:none;border-radius:7px;font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;cursor:pointer">Subscribe</button>'
      + '</div>'
      + '<button onclick="dismissEmailCapture()" style="background:none;border:none;color:#3a5a7a;cursor:pointer;font-size:18px;padding:4px;flex-shrink:0">✕</button>';

    document.body.appendChild(el);
  }, 2500);
}

async function submitEmailCapture() {
  const email = document.getElementById('ss-email-input')?.value?.trim();
  if (!email || !email.includes('@')) return;
  try {
    await ssClient.from('email_subscribers').insert({
      email, source: location.pathname, subscribed_at: new Date().toISOString()
    });
  } catch(e) {}
  localStorage.setItem('ss-email-captured','1');
  const el = document.getElementById('ss-email-capture');
  if (el) { el.innerHTML = '<div style="flex:1;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:900;color:#22c55e">✓ You\'re in — see you Monday!</div><button onclick="this.closest(\'#ss-email-capture\').remove()" style="background:none;border:none;color:#3a5a7a;cursor:pointer;font-size:18px">✕</button>'; }
}

function dismissEmailCapture() {
  localStorage.setItem('ss-email-dismissed','1');
  document.getElementById('ss-email-capture')?.remove();
}

// ── 6. Hook everything into watchForQuizCompletion ───────────────
// Patch the existing watcher to inject features after result
(function patchQuizWatcher(){
  const origWatch = watchForQuizCompletion;
  // Override the function
  window._ssQuizEndPatched = true;
})();

// Run schema injection on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){});
}

// Patch the MutationObserver by hooking saveResult
const _origSaveResult = typeof saveResult !== 'undefined' ? saveResult : null;
function ssAfterQuizComplete(slug, name, score, total) {
  const resultEl = document.getElementById('result');
  if (resultEl) {
    setTimeout(() => {
      injectShareCard(resultEl, name, score, total);
      injectPlayNext(resultEl, slug);
    }, 300);
  }
  injectEmailCapture();
}
