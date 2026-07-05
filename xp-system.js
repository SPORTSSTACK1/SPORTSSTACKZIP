// ═══════════════════════════════════════════════════════════════
//  SportsStack XP & Level System  —  xp-system.js
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const SB_URL = 'https://syntfyfsyjiuowclarpf.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnRmeWZzeWppdW93Y2xhcnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODgwNzgsImV4cCI6MjA5NTk2NDA3OH0.jQVBQo7tnv1RBEnCdzZCIvx8vVjsaXWRfZ3VNm1__Ig';

  // ── Level formula ─────────────────────────────────────────────
  function xpForLevel(n) {
    if (n <= 1) return 0;
    return Math.floor(100 * Math.pow(n - 1, 1.85));
  }
  function levelFromXP(xp) {
    var lv = 1;
    while (lv < 100 && xpForLevel(lv + 1) <= xp) lv++;
    return lv;
  }
  function levelProgress(xp) {
    var lv = levelFromXP(xp);
    if (lv >= 100) return 1;
    return (xp - xpForLevel(lv)) / (xpForLevel(lv + 1) - xpForLevel(lv));
  }
  function xpToNextLevel(xp) {
    var lv = levelFromXP(xp);
    if (lv >= 100) return 0;
    return xpForLevel(lv + 1) - xp;
  }
  function levelColor(lv) {
    if (lv >= 90) return '#ff6b35';
    if (lv >= 75) return '#a855f7';
    if (lv >= 50) return '#f5c842';
    if (lv >= 25) return '#3b82f6';
    if (lv >= 10) return '#22c55e';
    return '#6b8abf';
  }
  function levelTitle(lv) {
    if (lv >= 90) return 'Legend';
    if (lv >= 75) return 'Elite';
    if (lv >= 50) return 'Expert';
    if (lv >= 25) return 'Veteran';
    if (lv >= 10) return 'Regular';
    return 'Rookie';
  }

  // ── Supabase helpers ──────────────────────────────────────────
  function sbFetch(method, path, body) {
    return fetch(SB_URL + path, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + (window._sbToken || SB_KEY),
        'Prefer': 'return=representation'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) { return r.json(); });
  }

  var _xpData = null;

  function loadXP(userId) {
    return sbFetch('GET', '/rest/v1/user_xp?user_id=eq.' + userId + '&limit=1')
      .then(function(rows) {
        if (rows && rows.length) { _xpData = rows[0]; return _xpData; }
        return sbFetch('POST', '/rest/v1/user_xp', { user_id: userId, total_xp: 0, level: 1 })
          .then(function(rows) {
            _xpData = (rows && rows[0]) ? rows[0] : { user_id: userId, total_xp: 0, level: 1, login_streak: 0, quizzes_completed: 0, perfect_scores: 0 };
            return _xpData;
          });
      });
  }

  function saveXP(userId, updates) {
    return sbFetch('PATCH', '/rest/v1/user_xp?user_id=eq.' + userId, updates)
      .then(function(rows) { if (rows && rows[0]) _xpData = rows[0]; return _xpData; });
  }

  // ── Daily bonus ───────────────────────────────────────────────
  function checkDailyBonus(userId) {
    if (!_xpData) return;
    var today = new Date().toISOString().slice(0, 10);
    if (_xpData.last_login_bonus === today) return;
    var streak = _xpData.login_streak || 0;
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    var newStreak = _xpData.last_login_bonus === yesterday ? streak + 1 : 1;
    var xpGain = 50 + Math.min(newStreak - 1, 29) * 5;
    var label = newStreak > 1 ? newStreak + '-day login streak!' : 'Daily bonus!';
    grantXP(userId, xpGain, label, { last_login_bonus: today, login_streak: newStreak });
  }

  // ── Grant XP ──────────────────────────────────────────────────
  function grantXP(userId, amount, reason, extras) {
    if (!userId || amount <= 0) return;
    var oldXP = _xpData ? (_xpData.total_xp || 0) : 0;
    var newXP = oldXP + amount;
    var oldLevel = levelFromXP(oldXP);
    var newLevel = Math.min(levelFromXP(newXP), 100);
    var updates = Object.assign({ total_xp: newXP, level: newLevel, updated_at: new Date().toISOString() }, extras || {});
    saveXP(userId, updates).then(function() {
      showXPToast(amount, reason, oldLevel, newLevel, newXP);
      updateWidget(newXP, newLevel);
    });
  }

  // ── Toast ─────────────────────────────────────────────────────
  var _toastQueue = [], _toastActive = false;
  function showXPToast(amount, reason, oldLv, newLv, totalXP) {
    _toastQueue.push({ amount: amount, reason: reason, oldLv: oldLv, newLv: newLv, totalXP: totalXP });
    if (!_toastActive) processToastQueue();
  }
  function processToastQueue() {
    if (!_toastQueue.length) { _toastActive = false; return; }
    _toastActive = true;
    var t = _toastQueue.shift();
    var levelled = t.newLv > t.oldLv;
    var toast = document.getElementById('xp-toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'xp-toast'; document.body.appendChild(toast); }
    toast.innerHTML = levelled
      ? '<div class="xp-ti xp-lu"><div class="xp-icon">🏆</div><div class="xp-txt"><strong>LEVEL UP! ' + t.oldLv + ' → ' + t.newLv + '</strong><span>' + levelTitle(t.newLv) + '</span></div><div class="xp-gain">+' + t.amount + ' XP</div></div>'
      : '<div class="xp-ti"><div class="xp-icon">⚡</div><div class="xp-txt"><strong>+' + t.amount + ' XP</strong><span>' + t.reason + '</span></div><div class="xp-next">' + xpToNextLevel(t.totalXP) + ' to lvl ' + (t.newLv + 1) + '</div></div>';
    toast.className = 'xp-toast xp-show';
    setTimeout(function() {
      toast.className = 'xp-toast';
      setTimeout(processToastQueue, 400);
    }, levelled ? 3000 : 2200);
  }

  // ── Profile modal ─────────────────────────────────────────────
  function openProfileModal() {
    var existing = document.getElementById('xp-profile-modal');
    if (existing) { existing.classList.add('xp-pm-show'); refreshModalData(); return; }

    var modal = document.createElement('div');
    modal.id = 'xp-profile-modal';
    modal.innerHTML = '<div class="xp-pm-backdrop" onclick="document.getElementById(\'xp-profile-modal\').classList.remove(\'xp-pm-show\')"></div>' +
      '<div class="xp-pm-card">' +
        '<button class="xp-pm-close" onclick="document.getElementById(\'xp-profile-modal\').classList.remove(\'xp-pm-show\')" aria-label="Close">✕</button>' +
        '<div class="xp-pm-header">' +
          '<div class="xp-pm-avatar" id="xpm-avatar">?</div>' +
          '<div class="xp-pm-identity">' +
            '<div class="xp-pm-username" id="xpm-username">Member</div>' +
            '<div class="xp-pm-title" id="xpm-title">Rookie</div>' +
          '</div>' +
          '<div class="xp-pm-lvl-badge" id="xpm-badge">LVL 1</div>' +
        '</div>' +
        '<div class="xp-pm-bar-section">' +
          '<div class="xp-pm-bar-row">' +
            '<span class="xp-pm-bar-label" id="xpm-xp-label">0 XP</span>' +
            '<span class="xp-pm-bar-next" id="xpm-next-label">0 to next level</span>' +
          '</div>' +
          '<div class="xp-pm-bar-track"><div class="xp-pm-bar-fill" id="xpm-fill"></div></div>' +
          '<div class="xp-pm-bar-row" style="margin-top:6px">' +
            '<span class="xp-pm-bar-label" id="xpm-lvl-from"></span>' +
            '<span class="xp-pm-bar-label" id="xpm-lvl-to"></span>' +
          '</div>' +
        '</div>' +
        '<div class="xp-pm-stats">' +
          '<div class="xp-pm-stat"><div class="xp-pm-stat-val" id="xpm-quizzes">0</div><div class="xp-pm-stat-lbl">Quizzes</div></div>' +
          '<div class="xp-pm-stat"><div class="xp-pm-stat-val" id="xpm-perfect">0</div><div class="xp-pm-stat-lbl">Perfect Scores</div></div>' +
          '<div class="xp-pm-stat"><div class="xp-pm-stat-val" id="xpm-streak">0</div><div class="xp-pm-stat-lbl">Day Streak</div></div>' +
          '<div class="xp-pm-stat"><div class="xp-pm-stat-val" id="xpm-total-xp">0</div><div class="xp-pm-stat-lbl">Total XP</div></div>' +
        '</div>' +
        '<div class="xp-pm-milestones">' +
          '<div class="xp-pm-m-title">Level Milestones</div>' +
          '<div class="xp-pm-m-row" id="xpm-milestones"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    setTimeout(function() { modal.classList.add('xp-pm-show'); }, 10);
    refreshModalData();
  }

  function refreshModalData() {
    if (!_xpData) return;
    var xp = _xpData.total_xp || 0;
    var lv = _xpData.level || 1;
    var col = levelColor(lv);
    var pct = Math.round(levelProgress(xp) * 100);
    var user = window.ssUser;
    var name = user && user.email ? user.email.split('@')[0] : 'Member';

    var av = document.getElementById('xpm-avatar');
    if (av) { av.textContent = name.charAt(0).toUpperCase(); av.style.background = col; }
    var un = document.getElementById('xpm-username'); if (un) un.textContent = name;
    var ti = document.getElementById('xpm-title'); if (ti) { ti.textContent = levelTitle(lv); ti.style.color = col; }
    var bg = document.getElementById('xpm-badge');
    if (bg) { bg.textContent = 'LVL ' + lv; bg.style.background = col; bg.style.color = lv >= 50 ? '#04080f' : '#e8f0fe'; }
    var xl = document.getElementById('xpm-xp-label'); if (xl) xl.textContent = xp.toLocaleString() + ' XP';
    var nl = document.getElementById('xpm-next-label');
    if (nl) nl.textContent = lv >= 100 ? 'Max Level!' : (xpToNextLevel(xp).toLocaleString() + ' XP to Level ' + (lv + 1));
    var fill = document.getElementById('xpm-fill');
    if (fill) { fill.style.width = pct + '%'; fill.style.background = col; }
    var lf = document.getElementById('xpm-lvl-from');
    if (lf) lf.textContent = 'Level ' + lv + ' (' + xpForLevel(lv).toLocaleString() + ' XP)';
    var lt = document.getElementById('xpm-lvl-to');
    if (lt) lt.textContent = lv < 100 ? 'Level ' + (lv + 1) + ' (' + xpForLevel(lv + 1).toLocaleString() + ' XP)' : 'Max Level!';
    var qz = document.getElementById('xpm-quizzes'); if (qz) qz.textContent = (_xpData.quizzes_completed || 0).toLocaleString();
    var pf = document.getElementById('xpm-perfect'); if (pf) pf.textContent = (_xpData.perfect_scores || 0).toLocaleString();
    var st = document.getElementById('xpm-streak'); if (st) st.textContent = (_xpData.login_streak || 0);
    var tx = document.getElementById('xpm-total-xp'); if (tx) tx.textContent = xp.toLocaleString();

    // Milestones
    var mc = document.getElementById('xpm-milestones');
    if (mc) {
      var milestones = [5, 10, 25, 50, 75, 100];
      mc.innerHTML = milestones.map(function(m) {
        var done = lv >= m;
        var c = done ? levelColor(m) : '#1a3a6a';
        return '<div class="xp-pm-m" style="border-color:' + c + ';background:' + (done ? 'rgba(0,0,0,.3)' : 'transparent') + '">' +
          '<div style="font-size:16px">' + (done ? '✓' : '⬡') + '</div>' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:900;color:' + (done ? c : '#1a3a6a') + '">LVL ' + m + '</div>' +
          '<div style="font-size:10px;color:' + (done ? '#6b8abf' : '#1a3a6a') + '">' + levelTitle(m) + '</div>' +
        '</div>';
      }).join('');
    }
  }

  // ── Widget — nav pill + sub-nav XP bar ──────────────────────────
  function updateWidget(xp, level) {
    var col = levelColor(level);
    var pct = Math.round(levelProgress(xp) * 100);

    // 1. Nav pill — small level badge injected into nav (before member widget)
    var nav = document.querySelector('nav');
    var pill = document.getElementById('xp-nav-pill');
    if (nav && !pill) {
      pill = document.createElement('button');
      pill.id = 'xp-nav-pill';
      pill.onclick = function() { window._openXPProfile && window._openXPProfile(); };
      pill.setAttribute('aria-label', 'View XP profile');
      nav.appendChild(pill);
    }
    if (pill) {
      pill.innerHTML = '<span id="xp-pill-lv">LVL ' + level + '</span>';
      pill.style.cssText = 'background:transparent;border:1.5px solid ' + col + ';color:' + col +
        ';font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:900;letter-spacing:.08em;' +
        'padding:4px 12px;border-radius:50px;cursor:pointer;flex-shrink:0;transition:all .2s;' +
        'text-transform:uppercase';
    }

    // 2. Sub-nav bar — thin XP bar that appears directly below the sticky nav
    var bar = document.getElementById('xp-subnav-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'xp-subnav-bar';
      bar.onclick = function() { window._openXPProfile && window._openXPProfile(); };
      bar.style.cssText = 'position:sticky;top:52px;z-index:999;cursor:pointer;' +
        'background:#04080f;border-bottom:1px solid #0d2040;padding:5px 16px 6px;' +
        'display:flex;align-items:center;gap:12px';
      var navEl = document.querySelector('nav');
      if (navEl && navEl.nextSibling) navEl.parentNode.insertBefore(bar, navEl.nextSibling);
      else document.body.insertBefore(bar, document.body.firstChild);
    }
    bar.innerHTML =
      '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:900;' +
        'letter-spacing:.08em;color:' + col + ';white-space:nowrap;flex-shrink:0">' +
        'LVL ' + level + ' · ' + levelTitle(level) + '</span>' +
      '<div style="flex:1;height:4px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + col + ';border-radius:99px;transition:width .6s ease"></div>' +
      '</div>' +
      '<span style="font-size:10px;color:#6b8abf;white-space:nowrap;flex-shrink:0">' +
        (level < 100 ? (xpToNextLevel(xp).toLocaleString() + ' to lvl ' + (level+1)) : 'Max Level!') +
      '</span>';
  }

  // ── Styles ────────────────────────────────────────────────────
  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = [
      // Toast
      '.xp-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);z-index:9998;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;min-width:220px;max-width:320px}',
      '.xp-toast.xp-show{opacity:1;transform:translateX(-50%) translateY(0)}',
      '.xp-ti{background:#080f1c;border:1.5px solid #1a3a6a;border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.5)}',
      '.xp-ti.xp-lu{border-color:#f5c842;background:rgba(245,200,66,.08)}',
      '.xp-icon{font-size:22px;flex-shrink:0}',
      '.xp-txt{flex:1;display:flex;flex-direction:column;gap:2px}',
      '.xp-txt strong{font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;letter-spacing:.04em;color:#e8f0fe}',
      '.xp-txt span{font-size:11px;color:#6b8abf;letter-spacing:.04em}',
      '.xp-gain{font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:900;color:#f5c842;letter-spacing:.04em;flex-shrink:0}',
      '.xp-next{font-size:10px;color:#6b8abf;letter-spacing:.04em;white-space:nowrap;flex-shrink:0}',
      // Profile modal backdrop
      '#xp-profile-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .25s}',
      '#xp-profile-modal.xp-pm-show{opacity:1;pointer-events:all}',
      '.xp-pm-backdrop{position:absolute;inset:0;background:rgba(4,8,15,.88);backdrop-filter:blur(6px)}',
      // Profile card
      '.xp-pm-card{position:relative;background:#080f1c;border:1.5px solid #1a3a6a;border-radius:20px;padding:28px 24px;max-width:420px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.7);animation:xp-pm-up .3s ease both}',
      '@keyframes xp-pm-up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.xp-pm-close{position:absolute;top:14px;right:14px;background:transparent;border:none;color:#6b8abf;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:color .2s}',
      '.xp-pm-close:hover{color:#e8f0fe}',
      '.xp-pm-header{display:flex;align-items:center;gap:14px;margin-bottom:22px}',
      '.xp-pm-avatar{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:900;color:#04080f;flex-shrink:0}',
      '.xp-pm-identity{flex:1}',
      '.xp-pm-username{font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:900;color:#e8f0fe;letter-spacing:.04em}',
      '.xp-pm-title{font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:2px}',
      '.xp-pm-lvl-badge{font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:900;letter-spacing:.08em;padding:6px 14px;border-radius:50px;flex-shrink:0}',
      '.xp-pm-bar-section{margin-bottom:22px}',
      '.xp-pm-bar-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}',
      '.xp-pm-bar-label{font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;color:#6b8abf;letter-spacing:.06em}',
      '.xp-pm-bar-next{font-size:12px;color:#6b8abf;letter-spacing:.04em}',
      '.xp-pm-bar-track{height:10px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden}',
      '.xp-pm-bar-fill{height:100%;border-radius:99px;transition:width .8s cubic-bezier(.4,0,.2,1)}',
      '.xp-pm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}',
      '.xp-pm-stat{background:#0d1829;border:1px solid #0d2040;border-radius:10px;padding:12px 8px;text-align:center}',
      '.xp-pm-stat-val{font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:900;color:#f5c842;line-height:1}',
      '.xp-pm-stat-lbl{font-size:10px;color:#6b8abf;letter-spacing:.06em;text-transform:uppercase;margin-top:4px;line-height:1.2}',
      '.xp-pm-milestones{border-top:1px solid #0d2040;padding-top:16px}',
      '.xp-pm-m-title{font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b8abf;margin-bottom:12px}',
      '.xp-pm-m-row{display:flex;gap:8px;justify-content:space-between}',
      '.xp-pm-m{flex:1;border:1.5px solid;border-radius:10px;padding:8px 4px;text-align:center;transition:all .2s}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Hook saveResult ───────────────────────────────────────────
  function hookSaveResult() {
    var orig = window.saveResult;
    window.saveResult = function(quizId, quizTitle, score, total, perfect) {
      if (typeof orig === 'function') orig(quizId, quizTitle, score, total, perfect);
      if (!_xpData || !_xpData.user_id || !score) return;
      var xpBase = score * 12;
      var perfBonus = perfect ? 75 : 0;
      var extras = { quizzes_completed: (_xpData.quizzes_completed || 0) + 1 };
      if (perfect) extras.perfect_scores = (_xpData.perfect_scores || 0) + 1;
      grantXP(_xpData.user_id, xpBase + perfBonus, perfect ? 'Perfect score! ' + quizTitle : quizTitle, extras);
    };
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    injectStyles();
    window._openXPProfile = openProfileModal;

    var attempts = 0;
    var poll = setInterval(function() {
      if (++attempts > 30) { clearInterval(poll); return; }
      if (typeof window.ssUser === 'undefined') return;
      clearInterval(poll);
      if (!window.ssUser) return;

      var userId = window.ssUser.id;
      window._sbToken = window.ssUser.access_token || SB_KEY;
      hookSaveResult();

      loadXP(userId).then(function(data) {
        if (!data) return;
        updateWidget(data.total_xp || 0, data.level || 1);
        checkDailyBonus(userId);
      });
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
