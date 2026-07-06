// ═══════════════════════════════════════════════════════════════
//  SportsStack XP & Level System  —  xp-system.js
//  Uses ssClient (authenticated Supabase client from sportstack-member.js)
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

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

  var _xpData = null;
  var _client = null;
  var _userId = null;

  // ── DB helpers using ssClient ─────────────────────────────────
  function loadXP(userId) {
    return _client.from('user_xp').select('*').eq('user_id', userId).limit(1)
      .then(function(res) {
        if (res.data && res.data.length) {
          _xpData = res.data[0];
          return _xpData;
        }
        // First visit — create row
        return _client.from('user_xp').insert({ user_id: userId, total_xp: 0, level: 1 }).select()
          .then(function(ins) {
            _xpData = (ins.data && ins.data[0]) ? ins.data[0] : { user_id: userId, total_xp: 0, level: 1, login_streak: 0, quizzes_completed: 0, perfect_scores: 0 };
            return _xpData;
          });
      });
  }

  function saveXP(updates) {
    return _client.from('user_xp').update(updates).eq('user_id', _userId).select()
      .then(function(res) {
        if (res.data && res.data[0]) _xpData = res.data[0];
        return _xpData;
      });
  }

  // ── Daily bonus ───────────────────────────────────────────────
  function checkDailyBonus() {
    if (!_xpData) return;
    var today = new Date().toISOString().slice(0, 10);
    if (_xpData.last_login_bonus === today) return;
    var streak = _xpData.login_streak || 0;
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    var newStreak = _xpData.last_login_bonus === yesterday ? streak + 1 : 1;
    var xpGain = 50 + Math.min(newStreak - 1, 29) * 5;
    grantXP(xpGain, newStreak > 1 ? newStreak + '-day login streak!' : 'Daily bonus!',
      { last_login_bonus: today, login_streak: newStreak });
  }

  // ── Grant XP ──────────────────────────────────────────────────
  function grantXP(amount, reason, extras) {
    if (!_userId || amount <= 0 || !_xpData) return;
    var oldXP = _xpData.total_xp || 0;
    var newXP = oldXP + amount;
    var oldLevel = levelFromXP(oldXP);
    var newLevel = Math.min(levelFromXP(newXP), 100);
    var updates = Object.assign({ total_xp: newXP, level: newLevel }, extras || {});
    // Optimistic local update
    Object.assign(_xpData, updates);
    saveXP(updates).then(function() {
      showXPToast(amount, reason, oldLevel, newLevel, newXP);
      updateWidget(newXP, newLevel);
    });
  }

  // ── Toast ─────────────────────────────────────────────────────
  var _toastQ = [], _toastBusy = false;
  function showXPToast(amount, reason, oldLv, newLv, totalXP) {
    _toastQ.push({ amount: amount, reason: reason, oldLv: oldLv, newLv: newLv, totalXP: totalXP });
    if (!_toastBusy) runToast();
  }
  function runToast() {
    if (!_toastQ.length) { _toastBusy = false; return; }
    _toastBusy = true;
    var t = _toastQ.shift();
    var levelled = t.newLv > t.oldLv;
    var toast = document.getElementById('xp-toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'xp-toast'; document.body.appendChild(toast); }
    toast.innerHTML = levelled
      ? '<div class="xp-ti xp-lu"><div class="xp-icon">🏆</div><div class="xp-txt"><strong>LEVEL UP! ' + t.oldLv + ' → ' + t.newLv + '</strong><span>' + levelTitle(t.newLv) + '</span></div><div class="xp-gain">+' + t.amount + ' XP</div></div>'
      : '<div class="xp-ti"><div class="xp-icon">⚡</div><div class="xp-txt"><strong>+' + t.amount + ' XP</strong><span>' + t.reason + '</span></div><div class="xp-next">' + xpToNextLevel(t.totalXP) + ' to lvl ' + (t.newLv + 1) + '</div></div>';
    toast.className = 'xp-toast xp-show';
    setTimeout(function() { toast.className = 'xp-toast'; setTimeout(runToast, 400); }, levelled ? 3000 : 2200);
  }

  // ── Profile modal (on nav pill click) ────────────────────────
  function openProfileModal() {
    var m = document.getElementById('xp-profile-modal');
    if (m) { m.classList.add('xp-pm-show'); refreshModal(); return; }
    m = document.createElement('div');
    m.id = 'xp-profile-modal';
    m.innerHTML = '<div class="xp-pm-backdrop" onclick="document.getElementById(\'xp-profile-modal\').classList.remove(\'xp-pm-show\')"></div>'
      + '<div class="xp-pm-card">'
      + '<button class="xp-pm-close" onclick="document.getElementById(\'xp-profile-modal\').classList.remove(\'xp-pm-show\')">✕</button>'
      + '<div class="xp-pm-header"><div class="xp-pm-avatar" id="xpm-av">?</div><div class="xp-pm-id"><div class="xp-pm-un" id="xpm-un">Member</div><div class="xp-pm-ti" id="xpm-ti">Rookie</div></div><div class="xp-pm-badge" id="xpm-bg">LVL 1</div></div>'
      + '<div class="xp-pm-bars"><div class="xp-pm-br"><span id="xpm-xl">0 XP</span><span id="xpm-nl">0 to next</span></div><div class="xp-pm-track"><div class="xp-pm-fill" id="xpm-fill"></div></div><div class="xp-pm-br" style="margin-top:5px"><span id="xpm-lf" style="font-size:10px;color:#6b8abf;font-family:\'Barlow Condensed\',sans-serif"></span><span id="xpm-lt" style="font-size:10px;color:#6b8abf;font-family:\'Barlow Condensed\',sans-serif"></span></div></div>'
      + '<div class="xp-pm-stats"><div class="xp-pm-st"><div class="xp-pm-sv" id="xpm-qz">0</div><div class="xp-pm-sl">Quizzes</div></div><div class="xp-pm-st"><div class="xp-pm-sv" id="xpm-pf">0</div><div class="xp-pm-sl">Perfect</div></div><div class="xp-pm-st"><div class="xp-pm-sv" id="xpm-sk">0</div><div class="xp-pm-sl">Streak</div></div><div class="xp-pm-st"><div class="xp-pm-sv" id="xpm-tx">0</div><div class="xp-pm-sl">Total XP</div></div></div>'
      + '<div class="xp-pm-ms"><div class="xp-pm-mt">Level Milestones</div><div class="xp-pm-mr" id="xpm-ms"></div></div>'
      + '</div>';
    document.body.appendChild(m);
    setTimeout(function() { m.classList.add('xp-pm-show'); }, 10);
    refreshModal();
  }
  window._openXPProfile = openProfileModal;

  function refreshModal() {
    if (!_xpData) return;
    var xp = _xpData.total_xp || 0, lv = _xpData.level || 1, col = levelColor(lv);
    var pct = Math.round(levelProgress(xp) * 100);
    var name = (window.ssUser && window.ssUser.email) ? window.ssUser.email.split('@')[0] : 'Member';
    var S = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
    var C = function(id, p, v) { var e = document.getElementById(id); if (e) e.style[p] = v; };
    S('xpm-av', name.charAt(0).toUpperCase()); C('xpm-av', 'background', col);
    S('xpm-un', name); S('xpm-ti', levelTitle(lv)); C('xpm-ti', 'color', col);
    S('xpm-bg', 'LVL ' + lv); C('xpm-bg', 'background', col); C('xpm-bg', 'color', lv >= 50 ? '#04080f' : '#fff');
    S('xpm-xl', xp.toLocaleString() + ' XP');
    S('xpm-nl', lv < 100 ? xpToNextLevel(xp).toLocaleString() + ' to Level ' + (lv + 1) : 'Max Level!');
    C('xpm-fill', 'width', pct + '%'); C('xpm-fill', 'background', col);
    S('xpm-lf', 'Level ' + lv + ' (' + xpForLevel(lv).toLocaleString() + ' XP)');
    S('xpm-lt', lv < 100 ? 'Level ' + (lv + 1) + ' (' + xpForLevel(lv + 1).toLocaleString() + ' XP)' : 'Max Level!');
    S('xpm-qz', (_xpData.quizzes_completed || 0).toLocaleString());
    S('xpm-pf', (_xpData.perfect_scores || 0).toLocaleString());
    S('xpm-sk', (_xpData.login_streak || 0));
    S('xpm-tx', xp.toLocaleString());
    var mc = document.getElementById('xpm-ms');
    if (mc) mc.innerHTML = [5,10,25,50,75,100].map(function(m) {
      var done = lv >= m, c = done ? levelColor(m) : '#1a3a6a';
      return '<div class="xp-pm-m" style="border-color:' + c + ';background:' + (done ? 'rgba(0,0,0,.3)' : 'transparent') + '">'
        + '<div style="font-size:16px">' + (done ? '✓' : '⬡') + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:900;color:' + (done ? c : '#1a3a6a') + '">LVL ' + m + '</div>'
        + '<div style="font-size:10px;color:' + (done ? '#6b8abf' : '#1a3a6a') + '">' + levelTitle(m) + '</div></div>';
    }).join('');
  }

  // ── Nav pill + sub-nav bar ────────────────────────────────────
  function updateWidget(xp, level) {
    var col = levelColor(level);
    var pct = Math.round(levelProgress(xp) * 100);
    var nav = document.querySelector('nav');
    // Nav pill
    var pill = document.getElementById('xp-nav-pill');
    if (nav && !pill) {
      pill = document.createElement('button');
      pill.id = 'xp-nav-pill';
      pill.onclick = openProfileModal;
      pill.setAttribute('aria-label', 'View XP profile');
      nav.appendChild(pill);
    }
    if (pill) {
      pill.textContent = 'LVL ' + level;
      pill.style.cssText = 'background:transparent;border:1.5px solid ' + col + ';color:' + col
        + ';font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:900;letter-spacing:.08em;'
        + 'padding:4px 12px;border-radius:50px;cursor:pointer;flex-shrink:0;text-transform:uppercase;transition:all .2s';
    }
    // Sub-nav bar
    var bar = document.getElementById('xp-subnav-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'xp-subnav-bar';
      bar.onclick = openProfileModal;
      bar.style.cssText = 'position:sticky;top:52px;z-index:999;cursor:pointer;background:#04080f;'
        + 'border-bottom:1px solid #0d2040;padding:5px 16px 6px;display:flex;align-items:center;gap:12px';
      var navEl = document.querySelector('nav');
      if (navEl && navEl.nextSibling) navEl.parentNode.insertBefore(bar, navEl.nextSibling);
      else if (navEl) navEl.parentNode.insertBefore(bar, navEl.nextElementSibling);
    }
    if (bar) bar.innerHTML = '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:900;letter-spacing:.08em;color:' + col + ';white-space:nowrap;flex-shrink:0">LVL ' + level + ' · ' + levelTitle(level) + '</span>'
      + '<div style="flex:1;height:4px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + col + ';border-radius:99px;transition:width .6s ease"></div></div>'
      + '<span style="font-size:10px;color:#6b8abf;white-space:nowrap;flex-shrink:0">' + (level < 100 ? xpToNextLevel(xp).toLocaleString() + ' to lvl ' + (level + 1) : 'Max Level!') + '</span>';
  }

  // ── Styles ────────────────────────────────────────────────────
  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = '.xp-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);z-index:9998;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;min-width:220px;max-width:320px}'
      + '.xp-toast.xp-show{opacity:1;transform:translateX(-50%) translateY(0)}'
      + '.xp-ti{background:#080f1c;border:1.5px solid #1a3a6a;border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.5)}'
      + '.xp-ti.xp-lu{border-color:#f5c842;background:rgba(245,200,66,.08)}'
      + '.xp-icon{font-size:22px;flex-shrink:0}.xp-txt{flex:1;display:flex;flex-direction:column;gap:2px}'
      + '.xp-txt strong{font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;color:#e8f0fe}'
      + '.xp-txt span{font-size:11px;color:#6b8abf}.xp-gain{font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:900;color:#f5c842;flex-shrink:0}'
      + '.xp-next{font-size:10px;color:#6b8abf;white-space:nowrap;flex-shrink:0}'
      + '#xp-profile-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .25s}'
      + '#xp-profile-modal.xp-pm-show{opacity:1;pointer-events:all}'
      + '.xp-pm-backdrop{position:absolute;inset:0;background:rgba(4,8,15,.88);backdrop-filter:blur(6px)}'
      + '.xp-pm-card{position:relative;background:#080f1c;border:1.5px solid #1a3a6a;border-radius:20px;padding:28px 24px;max-width:420px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.7)}'
      + '.xp-pm-close{position:absolute;top:14px;right:14px;background:transparent;border:none;color:#6b8abf;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px}'
      + '.xp-pm-header{display:flex;align-items:center;gap:14px;margin-bottom:20px}'
      + '.xp-pm-avatar{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:900;color:#04080f;flex-shrink:0}'
      + '.xp-pm-id{flex:1}.xp-pm-un{font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:900;color:#e8f0fe}'
      + '.xp-pm-ti{font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:2px}'
      + '.xp-pm-badge{font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;letter-spacing:.08em;padding:6px 14px;border-radius:50px;flex-shrink:0}'
      + '.xp-pm-bars{margin-bottom:20px}.xp-pm-br{display:flex;justify-content:space-between;margin-bottom:6px;font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;color:#6b8abf;letter-spacing:.06em}'
      + '.xp-pm-track{height:10px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden}.xp-pm-fill{height:100%;border-radius:99px;transition:width .8s cubic-bezier(.4,0,.2,1)}'
      + '.xp-pm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}'
      + '.xp-pm-st{background:#0d1829;border:1px solid #0d2040;border-radius:10px;padding:12px 8px;text-align:center}'
      + '.xp-pm-sv{font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:900;color:#f5c842;line-height:1}'
      + '.xp-pm-sl{font-size:10px;color:#6b8abf;letter-spacing:.06em;text-transform:uppercase;margin-top:4px}'
      + '.xp-pm-ms{border-top:1px solid #0d2040;padding-top:14px}'
      + '.xp-pm-mt{font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b8abf;margin-bottom:10px}'
      + '.xp-pm-mr{display:flex;gap:8px;justify-content:space-between}'
      + '.xp-pm-m{flex:1;border:1.5px solid;border-radius:10px;padding:8px 4px;text-align:center;transition:all .2s}';
    document.head.appendChild(s);
  }

  // ── Hook saveResult ───────────────────────────────────────────
  function hookSaveResult() {
    var orig = window.saveResult;
    window.saveResult = function(quizId, quizTitle, score, total, perfect) {
      if (typeof orig === 'function') orig(quizId, quizTitle, score, total, perfect);
      if (!_xpData || !_userId || !score) return;
      var gain = (score * 12) + (perfect ? 75 : 0);
      var extras = { quizzes_completed: (_xpData.quizzes_completed || 0) + 1 };
      if (perfect) extras.perfect_scores = (_xpData.perfect_scores || 0) + 1;
      grantXP(gain, perfect ? 'Perfect score!' : quizTitle, extras);
    };
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    injectStyles();
    var attempts = 0;
    var poll = setInterval(function() {
      if (++attempts > 40) { clearInterval(poll); return; }
      // Wait for BOTH ssUser AND ssClient to be ready
      if (typeof window.ssUser === 'undefined' || typeof window.ssClient === 'undefined') return;
      clearInterval(poll);
      if (!window.ssUser || !window.ssClient) return;
      _client = window.ssClient;
      _userId = window.ssUser.id;
      if (!_userId) return;
      hookSaveResult();
      loadXP(_userId).then(function(data) {
        if (!data) return;
        updateWidget(data.total_xp || 0, data.level || 1);
        checkDailyBonus();
      }).catch(function(e) { console.warn('XP load error:', e); });
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
