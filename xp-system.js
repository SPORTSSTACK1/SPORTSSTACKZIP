// ═══════════════════════════════════════════════════════════════
//  SportsStack XP & Level System  —  xp-system.js
//  Loads after sportstack-member.js on every quiz/game page
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const SB_URL = 'https://syntfyfsyjiuowclarpf.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnRmeWZzeWppdW93Y2xhcnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODgwNzgsImV4cCI6MjA5NTk2NDA3OH0.jQVBQo7tnv1RBEnCdzZCIvx8vVjsaXWRfZ3VNm1__Ig';

  // ── Level formula ─────────────────────────────────────────────
  // Total XP required to REACH level N (level 1 = 0 XP)
  function xpForLevel(n) {
    if (n <= 1) return 0;
    return Math.floor(100 * Math.pow(n - 1, 1.85));
  }

  // Calculate level from a total XP amount
  function levelFromXP(xp) {
    var lv = 1;
    while (lv < 100 && xpForLevel(lv + 1) <= xp) lv++;
    return lv;
  }

  // Fraction progress within current level (0.0 → 1.0)
  function levelProgress(xp) {
    var lv = levelFromXP(xp);
    if (lv >= 100) return 1;
    var lo = xpForLevel(lv), hi = xpForLevel(lv + 1);
    return (xp - lo) / (hi - lo);
  }

  // XP needed to reach next level
  function xpToNextLevel(xp) {
    var lv = levelFromXP(xp);
    if (lv >= 100) return 0;
    return xpForLevel(lv + 1) - xp;
  }

  // Level colour tier
  function levelColor(lv) {
    if (lv >= 90) return '#ff6b35'; // Legendary
    if (lv >= 75) return '#a855f7'; // Purple
    if (lv >= 50) return '#f5c842'; // Gold
    if (lv >= 25) return '#3b82f6'; // Blue
    if (lv >= 10) return '#22c55e'; // Green
    return '#6b8abf';               // Grey-blue
  }

  function levelTitle(lv) {
    if (lv >= 90) return 'Legend';
    if (lv >= 75) return 'Elite';
    if (lv >= 50) return 'Expert';
    if (lv >= 25) return 'Veteran';
    if (lv >= 10) return 'Regular';
    if (lv >= 5)  return 'Rookie';
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
        'Prefer': method === 'POST' ? 'return=representation' : 'return=representation'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json(); });
  }

  // ── Load / create user XP row ─────────────────────────────────
  var _xpData = null;

  function loadXP(userId) {
    return sbFetch('GET', '/rest/v1/user_xp?user_id=eq.' + userId + '&limit=1')
      .then(function (rows) {
        if (rows && rows.length) {
          _xpData = rows[0];
          return _xpData;
        }
        // First time — create the row
        return sbFetch('POST', '/rest/v1/user_xp', { user_id: userId, total_xp: 0, level: 1 })
          .then(function (rows) {
            _xpData = rows && rows[0] ? rows[0] : { user_id: userId, total_xp: 0, level: 1 };
            return _xpData;
          });
      });
  }

  function saveXP(userId, updates) {
    return sbFetch('PATCH', '/rest/v1/user_xp?user_id=eq.' + userId, updates)
      .then(function (rows) {
        if (rows && rows.length) _xpData = rows[0];
        return _xpData;
      });
  }

  // ── Daily bonus ───────────────────────────────────────────────
  function checkDailyBonus(userId) {
    if (!_xpData) return;
    var today = new Date().toISOString().slice(0, 10);
    if (_xpData.last_login_bonus === today) return; // Already claimed

    var streak = _xpData.login_streak || 0;
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    var newStreak = _xpData.last_login_bonus === yesterday ? streak + 1 : 1;

    var xpGain = 50 + Math.min(newStreak - 1, 29) * 5; // 50 base + 5 per streak day (max +145 at 30)
    var label = newStreak > 1 ? 'Daily Bonus + ' + newStreak + ' day streak!' : 'Daily Bonus!';

    grantXP(userId, xpGain, label, {
      last_login_bonus: today,
      login_streak: newStreak
    });
  }

  // ── Grant XP ──────────────────────────────────────────────────
  function grantXP(userId, amount, reason, extraFields) {
    if (!userId || amount <= 0) return;
    var oldXP = _xpData ? (_xpData.total_xp || 0) : 0;
    var newXP = oldXP + amount;
    var oldLevel = levelFromXP(oldXP);
    var newLevel = Math.min(levelFromXP(newXP), 100);
    var updates = Object.assign({ total_xp: newXP, level: newLevel, updated_at: new Date().toISOString() }, extraFields || {});

    saveXP(userId, updates).then(function () {
      showXPToast(amount, reason, oldLevel, newLevel, newXP);
      updateWidget(newXP, newLevel);
    });
  }

  // ── XP Toast notification ─────────────────────────────────────
  var _toastQueue = [];
  var _toastActive = false;

  function showXPToast(amount, reason, oldLevel, newLevel, totalXP) {
    _toastQueue.push({ amount: amount, reason: reason, oldLevel: oldLevel, newLevel: newLevel, totalXP: totalXP });
    if (!_toastActive) processToastQueue();
  }

  function processToastQueue() {
    if (!_toastQueue.length) { _toastActive = false; return; }
    _toastActive = true;
    var t = _toastQueue.shift();
    var levelled = t.newLevel > t.oldLevel;

    var toast = document.getElementById('xp-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'xp-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = levelled
      ? '<div class="xp-toast-inner xp-levelup">' +
          '<div class="xp-toast-icon">🏆</div>' +
          '<div class="xp-toast-text">' +
            '<strong>LEVEL UP! ' + t.oldLevel + ' → ' + t.newLevel + '</strong>' +
            '<span>' + levelTitle(t.newLevel) + '</span>' +
          '</div>' +
          '<div class="xp-toast-gain">+' + t.amount + ' XP</div>' +
        '</div>'
      : '<div class="xp-toast-inner">' +
          '<div class="xp-toast-icon">⚡</div>' +
          '<div class="xp-toast-text">' +
            '<strong>+' + t.amount + ' XP</strong>' +
            '<span>' + t.reason + '</span>' +
          '</div>' +
          '<div class="xp-toast-next">' + xpToNextLevel(t.totalXP) + ' to lvl ' + (t.newLevel + 1) + '</div>' +
        '</div>';

    toast.className = 'xp-toast xp-show';
    setTimeout(function () {
      toast.className = 'xp-toast';
      setTimeout(processToastQueue, 400);
    }, levelled ? 3000 : 2200);
  }

  // ── Member widget XP bar ──────────────────────────────────────
  function updateWidget(xp, level) {
    var existing = document.getElementById('ss-xp-bar');
    var widget = document.getElementById('ss-member-widget');
    if (!widget) return;

    var pct = Math.round(levelProgress(xp) * 100);
    var col = levelColor(level);
    var html = '<div id="ss-xp-bar" style="margin-top:6px;min-width:120px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">' +
        '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:800;letter-spacing:.06em;color:' + col + '">LVL ' + level + '</span>' +
        '<span style="font-size:10px;color:#6b8abf;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:.06em">' + xp.toLocaleString() + ' XP</span>' +
      '</div>' +
      '<div style="height:4px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + col + ';border-radius:99px;transition:width .6s ease"></div>' +
      '</div>' +
    '</div>';

    if (existing) {
      existing.outerHTML = html;
    } else {
      widget.insertAdjacentHTML('beforeend', html);
    }
  }

  // ── Inject styles ─────────────────────────────────────────────
  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = [
      '.xp-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);z-index:9999;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;min-width:220px;max-width:320px}',
      '.xp-toast.xp-show{opacity:1;transform:translateX(-50%) translateY(0)}',
      '.xp-toast-inner{background:#080f1c;border:1.5px solid #1a3a6a;border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.5)}',
      '.xp-toast-inner.xp-levelup{border-color:#f5c842;background:rgba(245,200,66,.08)}',
      '.xp-toast-icon{font-size:22px;flex-shrink:0}',
      '.xp-toast-text{flex:1;display:flex;flex-direction:column;gap:2px}',
      '.xp-toast-text strong{font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;letter-spacing:.04em;color:#e8f0fe}',
      '.xp-toast-text span{font-size:11px;color:#6b8abf;letter-spacing:.04em}',
      '.xp-toast-gain{font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:900;color:#f5c842;letter-spacing:.04em;flex-shrink:0}',
      '.xp-toast-next{font-size:10px;color:#6b8abf;letter-spacing:.04em;white-space:nowrap;flex-shrink:0}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Hook into saveResult ──────────────────────────────────────
  function hookSaveResult() {
    var original = window.saveResult;
    window.saveResult = function (quizId, quizTitle, score, total, perfect) {
      if (typeof original === 'function') original(quizId, quizTitle, score, total, perfect);
      if (!_xpData || !_xpData.user_id) return;
      if (!score || score === 0) return;

      var xpBase = score * 12;
      var perfBonus = perfect ? 75 : 0;
      var totalGain = xpBase + perfBonus;
      var reason = perfect ? 'Perfect score on ' + quizTitle + '!' : quizTitle;
      var extras = { quizzes_completed: (_xpData.quizzes_completed || 0) + 1 };
      if (perfect) extras.perfect_scores = (_xpData.perfect_scores || 0) + 1;
      grantXP(_xpData.user_id, totalGain, reason, extras);
    };
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    injectStyles();

    // Poll for ssUser to be available (member.js may be async)
    var attempts = 0;
    var poll = setInterval(function () {
      attempts++;
      if (attempts > 30) { clearInterval(poll); return; } // 15s timeout

      if (typeof window.ssUser === 'undefined') return;
      clearInterval(poll);

      if (!window.ssUser) return; // Not logged in — don't track

      var userId = window.ssUser.id;
      window._sbToken = window.ssUser.access_token || SB_KEY;

      hookSaveResult();

      loadXP(userId).then(function (data) {
        if (!data) return;
        updateWidget(data.total_xp || 0, data.level || 1);
        checkDailyBonus(userId);
      });
    }, 500);
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
