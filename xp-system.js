// ═══════════════════════════════════════════════════════════════
//  SportsStack XP & Level System  —  xp-system.js
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var SB_URL = 'https://syntfyfsyjiuowclarpf.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnRmeWZzeWppdW93Y2xhcnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODgwNzgsImV4cCI6MjA5NTk2NDA3OH0.jQVBQo7tnv1RBEnCdzZCIvx8vVjsaXWRfZ3VNm1__Ig';

  // Level formula
  function xpForLevel(n){return n<=1?0:Math.floor(100*Math.pow(n-1,1.85));}
  function levelFromXP(xp){var l=1;while(l<100&&xpForLevel(l+1)<=xp)l++;return l;}
  function levelProgress(xp){var l=levelFromXP(xp);if(l>=100)return 1;return(xp-xpForLevel(l))/(xpForLevel(l+1)-xpForLevel(l));}
  function xpToNextLevel(xp){var l=levelFromXP(xp);return l>=100?0:xpForLevel(l+1)-xp;}
  function levelColor(l){if(l>=90)return'#ff6b35';if(l>=75)return'#a855f7';if(l>=50)return'#f5c842';if(l>=25)return'#3b82f6';if(l>=10)return'#22c55e';return'#6b8abf';}
  function levelTitle(l){if(l>=90)return'Legend';if(l>=75)return'Elite';if(l>=50)return'Expert';if(l>=25)return'Veteran';if(l>=10)return'Regular';return'Rookie';}

  var db = null;   // our own Supabase client
  var xpRow = null;
  var userId = null;

  // ── Init: create our own Supabase client ─────────────────────
  // window.supabase is available because every page loads supabase-js from CDN
  function initClient() {
    if (!window.supabase) return false;
    db = window.supabase.createClient(SB_URL, SB_KEY);
    return true;
  }

  // ── Get current user from our client's session ───────────────
  function getUser() {
    return db.auth.getUser().then(function(res) {
      if (res.data && res.data.user) return res.data.user;
      return null;
    });
  }

  // ── Load or create XP row ─────────────────────────────────────
  function loadXP(uid) {
    return db.from('user_xp').select('*').eq('user_id', uid).limit(1)
      .then(function(res) {
        if (res.error) { console.warn('XP load error:', res.error.message); return null; }
        if (res.data && res.data.length) { xpRow = res.data[0]; return xpRow; }
        // First time — insert row
        return db.from('user_xp').insert({ user_id: uid, total_xp: 0, level: 1,
          login_streak: 0, quizzes_completed: 0, perfect_scores: 0 }).select()
          .then(function(ins) {
            if (ins.error) { console.warn('XP insert error:', ins.error.message); return null; }
            xpRow = (ins.data && ins.data[0]) || { user_id: uid, total_xp: 0, level: 1, login_streak: 0, quizzes_completed: 0, perfect_scores: 0 };
            return xpRow;
          });
      });
  }

  // ── Save XP ───────────────────────────────────────────────────
  function saveXP(updates) {
    Object.assign(xpRow, updates);
    return db.from('user_xp').update(updates).eq('user_id', userId).select()
      .then(function(res) {
        if (res.error) console.warn('XP save error:', res.error.message);
        if (res.data && res.data[0]) xpRow = res.data[0];
      });
  }

  // ── Daily login bonus ─────────────────────────────────────────
  function checkDailyBonus() {
    if (!xpRow) return;
    var today = new Date().toISOString().slice(0, 10);
    if (xpRow.last_login_bonus === today) return;
    var streak = xpRow.login_streak || 0;
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    var newStreak = xpRow.last_login_bonus === yesterday ? streak + 1 : 1;
    var gain = 50 + Math.min(newStreak - 1, 29) * 5;
    grantXP(gain, newStreak > 1 ? newStreak + '-day login streak!' : 'Daily bonus!',
      { last_login_bonus: today, login_streak: newStreak });
  }

  // ── Grant XP ──────────────────────────────────────────────────
  function grantXP(amount, reason, extras) {
    if (!userId || !xpRow || amount <= 0) return;
    var oldXP = xpRow.total_xp || 0;
    var newXP = oldXP + amount;
    var oldLv = levelFromXP(oldXP);
    var newLv = Math.min(levelFromXP(newXP), 100);
    var updates = Object.assign({ total_xp: newXP, level: newLv }, extras || {});
    saveXP(updates).then(function() {
      showToast(amount, reason, oldLv, newLv, newXP);
      renderWidget(newXP, newLv);
    });
  }

  // ── Toast ─────────────────────────────────────────────────────
  var toastQ = [], toastBusy = false;
  function showToast(amount, reason, oldLv, newLv, totalXP) {
    toastQ.push({ amount:amount, reason:reason, oldLv:oldLv, newLv:newLv, totalXP:totalXP });
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    if (!toastQ.length) { toastBusy = false; return; }
    toastBusy = true;
    var t = toastQ.shift();
    var levelled = t.newLv > t.oldLv;
    var el = document.getElementById('xp-toast');
    if (!el) { el = document.createElement('div'); el.id = 'xp-toast'; document.body.appendChild(el); }
    el.innerHTML = levelled
      ? '<div class="xp-ti xp-lu"><span class="xp-ic">🏆</span><div class="xp-tx"><strong>LEVEL UP! '+t.oldLv+' → '+t.newLv+'</strong><span>'+levelTitle(t.newLv)+'</span></div><span class="xp-gn">+'+t.amount+' XP</span></div>'
      : '<div class="xp-ti"><span class="xp-ic">⚡</span><div class="xp-tx"><strong>+'+t.amount+' XP</strong><span>'+t.reason+'</span></div><span class="xp-nx">'+xpToNextLevel(t.totalXP)+' to lvl '+(t.newLv+1)+'</span></div>';
    el.className = 'xp-toast xp-show';
    setTimeout(function(){ el.className='xp-toast'; setTimeout(nextToast,400); }, levelled?3000:2200);
  }

  // ── Render nav pill + sub-nav bar ─────────────────────────────
  function renderWidget(xp, level) {
    var col = levelColor(level);
    var pct = Math.round(levelProgress(xp) * 100);
    var nav = document.querySelector('nav');

    // Level pill in nav
    var pill = document.getElementById('xp-nav-pill');
    if (nav && !pill) {
      pill = document.createElement('button');
      pill.id = 'xp-nav-pill';
      pill.onclick = openModal;
      pill.setAttribute('title', 'View your XP profile');
      nav.appendChild(pill);
    }
    if (pill) {
      pill.textContent = 'LVL ' + level;
      pill.style.cssText = 'background:transparent;border:1.5px solid '+col+';color:'+col
        +';font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:900;'
        +'letter-spacing:.08em;padding:4px 12px;border-radius:50px;cursor:pointer;'
        +'flex-shrink:0;text-transform:uppercase;transition:all .2s';
    }

    // Sub-nav XP bar
    var bar = document.getElementById('xp-subnav-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'xp-subnav-bar';
      bar.onclick = openModal;
      bar.style.cssText = 'position:sticky;top:52px;z-index:999;cursor:pointer;background:#04080f;'
        +'border-bottom:1px solid #0d2040;padding:5px 16px 6px;display:flex;align-items:center;gap:12px';
      var nav2 = document.querySelector('nav');
      if (nav2 && nav2.parentNode) {
        if (nav2.nextSibling) nav2.parentNode.insertBefore(bar, nav2.nextSibling);
        else nav2.parentNode.appendChild(bar);
      }
    }
    if (bar) bar.innerHTML =
      '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:900;letter-spacing:.08em;color:'+col+';white-space:nowrap;flex-shrink:0">LVL '+level+' · '+levelTitle(level)+'</span>'
      +'<div style="flex:1;height:4px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:99px;transition:width .6s ease"></div></div>'
      +'<span style="font-size:10px;color:#6b8abf;white-space:nowrap;flex-shrink:0">'+(level<100?xpToNextLevel(xp).toLocaleString()+' to lvl '+(level+1):'Max Level!')+'</span>';
  }

  // ── Profile modal ─────────────────────────────────────────────
  function openModal() {
    var m = document.getElementById('xp-modal');
    if (m) { m.classList.add('xp-ms'); refreshModal(); return; }
    m = document.createElement('div'); m.id = 'xp-modal';
    m.innerHTML = '<div class="xp-mb" onclick="document.getElementById(\'xp-modal\').classList.remove(\'xp-ms\')"></div>'
      +'<div class="xp-mc"><button class="xp-mclose" onclick="document.getElementById(\'xp-modal\').classList.remove(\'xp-ms\')">✕</button>'
      +'<div class="xp-mh"><div class="xp-mav" id="xm-av">?</div><div class="xp-mid"><div class="xp-mun" id="xm-un">Member</div><div class="xp-mti" id="xm-ti">Rookie</div></div><div class="xp-mbg" id="xm-bg">LVL 1</div></div>'
      +'<div class="xp-mbr"><div class="xp-mrl"><span id="xm-xp">0 XP</span><span id="xm-nx">0 to next</span></div><div class="xp-mbt"><div class="xp-mbf" id="xm-bf"></div></div><div class="xp-mrl" style="margin-top:5px"><span id="xm-lf" style="font-size:10px;color:#6b8abf;font-family:\'Barlow Condensed\',sans-serif"></span><span id="xm-lt" style="font-size:10px;color:#6b8abf;font-family:\'Barlow Condensed\',sans-serif"></span></div></div>'
      +'<div class="xp-mst"><div class="xp-ms1"><div class="xp-msv" id="xm-qz">0</div><div class="xp-msl">Quizzes</div></div><div class="xp-ms1"><div class="xp-msv" id="xm-pf">0</div><div class="xp-msl">Perfect</div></div><div class="xp-ms1"><div class="xp-msv" id="xm-sk">0</div><div class="xp-msl">Streak</div></div><div class="xp-ms1"><div class="xp-msv" id="xm-tx">0</div><div class="xp-msl">Total XP</div></div></div>'
      +'<div class="xp-mml"><div class="xp-mmt">Level Milestones</div><div class="xp-mmr" id="xm-ms"></div></div></div>';
    document.body.appendChild(m);
    setTimeout(function(){ m.classList.add('xp-ms'); }, 10);
    window._openXPProfile = openModal;
    refreshModal();
  }
  window._openXPProfile = openModal;

  function refreshModal() {
    if (!xpRow) return;
    var xp = xpRow.total_xp||0, lv = xpRow.level||1, col = levelColor(lv);
    var pct = Math.round(levelProgress(xp)*100);
    var name = userId ? (window.ssUser && window.ssUser.email ? window.ssUser.email.split('@')[0] : userId.slice(0,8)) : 'Member';
    var S=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
    var C=function(id,p,v){var e=document.getElementById(id);if(e)e.style[p]=v;};
    S('xm-av',name.charAt(0).toUpperCase()); C('xm-av','background',col);
    S('xm-un',name); S('xm-ti',levelTitle(lv)); C('xm-ti','color',col);
    S('xm-bg','LVL '+lv); C('xm-bg','background',col); C('xm-bg','color',lv>=50?'#04080f':'#e8f0fe');
    S('xm-xp',xp.toLocaleString()+' XP');
    S('xm-nx',lv<100?xpToNextLevel(xp).toLocaleString()+' to Level '+(lv+1):'Max Level!');
    C('xm-bf','width',pct+'%'); C('xm-bf','background',col);
    S('xm-lf','Level '+lv+' ('+xpForLevel(lv).toLocaleString()+' XP)');
    S('xm-lt',lv<100?'Level '+(lv+1)+' ('+xpForLevel(lv+1).toLocaleString()+' XP)':'Max Level!');
    S('xm-qz',(xpRow.quizzes_completed||0).toLocaleString());
    S('xm-pf',(xpRow.perfect_scores||0).toLocaleString());
    S('xm-sk',(xpRow.login_streak||0));
    S('xm-tx',xp.toLocaleString());
    var mc=document.getElementById('xm-ms');
    if(mc)mc.innerHTML=[5,10,25,50,75,100].map(function(m){
      var done=lv>=m,c=done?levelColor(m):'#1a3a6a';
      return'<div class="xp-mm" style="border-color:'+c+';background:'+(done?'rgba(0,0,0,.3)':'transparent')+'">'
        +'<div style="font-size:16px">'+(done?'✓':'⬡')+'</div>'
        +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:900;color:'+(done?c:'#1a3a6a')+'">LVL '+m+'</div>'
        +'<div style="font-size:10px;color:'+(done?'#6b8abf':'#1a3a6a')+'">'+levelTitle(m)+'</div></div>';
    }).join('');
  }

  // ── Hook saveResult ───────────────────────────────────────────
  function hookSaveResult() {
    var orig = window.saveResult;
    window.saveResult = function(quizId, quizTitle, score, total, perfect) {
      if (typeof orig === 'function') orig(quizId, quizTitle, score, total, perfect);
      if (!xpRow || !userId || !score) return;
      var gain = (score * 12) + (perfect ? 75 : 0);
      var extras = { quizzes_completed: (xpRow.quizzes_completed||0) + 1 };
      if (perfect) extras.perfect_scores = (xpRow.perfect_scores||0) + 1;
      grantXP(gain, perfect ? 'Perfect score!' : quizTitle, extras);
    };
  }

  // ── Styles ────────────────────────────────────────────────────
  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = '.xp-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);z-index:9998;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;min-width:220px;max-width:320px}'
      +'.xp-toast.xp-show{opacity:1;transform:translateX(-50%) translateY(0)}'
      +'.xp-ti{background:#080f1c;border:1.5px solid #1a3a6a;border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.5)}'
      +'.xp-ti.xp-lu{border-color:#f5c842;background:rgba(245,200,66,.08)}'
      +'.xp-ic{font-size:22px;flex-shrink:0}.xp-tx{flex:1;display:flex;flex-direction:column;gap:2px}'
      +'.xp-tx strong{font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;color:#e8f0fe}'
      +'.xp-tx span{font-size:11px;color:#6b8abf}.xp-gn{font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:900;color:#f5c842;flex-shrink:0}'
      +'.xp-nx{font-size:10px;color:#6b8abf;white-space:nowrap;flex-shrink:0}'
      +'#xp-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .25s}'
      +'#xp-modal.xp-ms{opacity:1;pointer-events:all}'
      +'.xp-mb{position:absolute;inset:0;background:rgba(4,8,15,.88);backdrop-filter:blur(6px)}'
      +'.xp-mc{position:relative;background:#080f1c;border:1.5px solid #1a3a6a;border-radius:20px;padding:28px 24px;max-width:420px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.7)}'
      +'.xp-mclose{position:absolute;top:14px;right:14px;background:transparent;border:none;color:#6b8abf;font-size:18px;cursor:pointer;padding:4px 8px}'
      +'.xp-mh{display:flex;align-items:center;gap:14px;margin-bottom:20px}'
      +'.xp-mav{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:900;color:#04080f;flex-shrink:0}'
      +'.xp-mid{flex:1}.xp-mun{font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:900;color:#e8f0fe}'
      +'.xp-mti{font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:2px}'
      +'.xp-mbg{font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;letter-spacing:.08em;padding:6px 14px;border-radius:50px;flex-shrink:0}'
      +'.xp-mbr{margin-bottom:20px}.xp-mrl{display:flex;justify-content:space-between;margin-bottom:6px;font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;color:#6b8abf}'
      +'.xp-mbt{height:10px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden}.xp-mbf{height:100%;border-radius:99px;transition:width .8s}'
      +'.xp-mst{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}'
      +'.xp-ms1{background:#0d1829;border:1px solid #0d2040;border-radius:10px;padding:12px 8px;text-align:center}'
      +'.xp-msv{font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:900;color:#f5c842;line-height:1}'
      +'.xp-msl{font-size:10px;color:#6b8abf;letter-spacing:.06em;text-transform:uppercase;margin-top:4px}'
      +'.xp-mml{border-top:1px solid #0d2040;padding-top:14px}'
      +'.xp-mmt{font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b8abf;margin-bottom:10px}'
      +'.xp-mmr{display:flex;gap:8px;justify-content:space-between}'
      +'.xp-mm{flex:1;border:1.5px solid;border-radius:10px;padding:8px 4px;text-align:center}';
    document.head.appendChild(s);
  }

  // ── Main ──────────────────────────────────────────────────────
  function main() {
    injectStyles();
    if (!initClient()) {
      // supabase.js not loaded yet — wait briefly and retry once
      setTimeout(function() {
        if (!initClient()) return; // give up
        run();
      }, 1000);
      return;
    }
    run();
  }

  function run() {
    getUser().then(function(user) {
      if (!user) return; // not logged in
      userId = user.id;
      hookSaveResult();
      loadXP(userId).then(function(row) {
        if (!row) return;
        renderWidget(row.total_xp || 0, row.level || 1);
        checkDailyBonus();
      });
    }).catch(function(e) { console.warn('XP init error:', e); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();

}());
