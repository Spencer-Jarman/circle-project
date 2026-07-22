/* ════════════════════════════════════════════════════════════
   endmid.gg — everything the custom features DO

   Four features, in order:
     1. TOP BAR NAV      the custom tabs across the top
     2. SHORTS PLAYER    the vertical video feed
     3. TWITCH PLAYER    the live stream panel
     4. MINI GAMES       the games overlay

   (The Circle snippet loads this only AFTER markup.html is in the
   page, so every section finds the elements it looks for. Do not
   reorder those two steps.)
   ════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   1. TOP BAR NAV
   ════════════════════════════════════════════════════════════
   Builds the custom tabs in the top bar and swaps between them.
   Remembers which tab you were on, and closes the overlay on Escape.

   (Ordered: config, overlay, buttons, navigation memory, publish
   redirect, centering, header controls, escapes, observers, init.)
   ════════════════════════════════════════════════════════════ */
(function () {
  /* ---------- config ---------- */
  var VIEWS = ['chats', 'youtube', 'shorts', 'twitch', 'games'];
  var OVERLAY_VIEWS = ['shorts', 'twitch', 'games'];
  var CONTAINERS = { shorts: 'reels-wrapper', twitch: 'twitch-container', games: 'games-container' };
  var DISPLAY = { shorts: 'flex', twitch: 'block', games: 'flex' };
  var INITS = { shorts: 'ccShortsInit', twitch: 'ccTwitchInit', games: 'ccGamesInit' };
  var FEED_COL_W = 672;   /* posts column width (matches post spaces) */
  var EDGE = 24;          /* standard margin from viewport/sidebar edges */

  var ICONS = {
    chats:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2s-.2-1.5-.9-2.1c-.8-.9-1.7-.9-2.1-1C15.9 3.8 12 3.8 12 3.8s-3.9 0-6.6.3c-.4.1-1.3.1-2.1 1-.6.6-.9 2.1-.9 2.1S2.2 9 2.2 10.8v1.7c0 1.8.2 3.6.2 3.6s.2 1.5.9 2.1c.8.9 1.9.9 2.4 1 1.7.2 6.3.3 6.3.3s3.9 0 6.6-.3c.4-.1 1.3-.1 2.1-1 .6-.6.9-2.1.9-2.1s.2-1.8.2-3.6v-1.7c0-1.8-.2-3.6-.2-3.6zM9.8 14.9V8.7l5.6 3.1-5.6 3.1z"/></svg>',
    shorts:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.77 10.32l-1.6-.82c1.5-1.02 2.05-3.03 1.19-4.66-.9-1.7-3-2.36-4.7-1.46L5.5 7.06c-1.16.62-1.9 1.83-1.9 3.15 0 1.32.73 2.53 1.9 3.15l1.6.82c-1.5 1.02-2.05 3.03-1.19 4.66.62 1.17 1.83 1.9 3.15 1.9.57 0 1.14-.14 1.66-.42l7.06-3.72c1.16-.62 1.9-1.83 1.9-3.15 0-1.32-.74-2.53-1.9-3.13zM10 14.65V9.35L14.5 12 10 14.65z"/></svg>',
    twitch:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 2L2 6v14h5v2h3l2-2h4l4-4V2H4zm14 12l-2 2h-4l-2 2v-2H6V4h12v10zM16 7h-2v5h2V7zm-5 0H9v5h2V7z"/></svg>',
    games:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.97 5h8.06c3.09 0 5.62 2.4 5.84 5.48l.35 4.87A3.24 3.24 0 0119 19a3.2 3.2 0 01-2.29-.96L15 16.33H9L7.29 18.04A3.2 3.2 0 015 19a3.24 3.24 0 01-3.22-3.65l.35-4.87C2.35 7.4 4.88 5 7.97 5zM6 9v2H4v2h2v2h2v-2h2v-2H8V9H6zm12.5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-3 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>'
  };

  /* ---------- state ---------- */
  var view = sessionStorage.getItem('cc-view') || 'chats';
  var listView = OVERLAY_VIEWS.indexOf(view) === -1 ? view : 'chats';
  var barSeen = false;
  var pendingPublish = 0;
  var lastPath = window.location.pathname;
  var ro = null;

  function isAdmin() {
    return !!(window.circleUser && String(window.circleUser.isAdmin) === 'true');
  }

  /* ---------- overlay ---------- */
  function ensureOverlay() {
    var ov = document.getElementById('cc-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'cc-overlay';
      ov.style.display = 'none';
      document.body.appendChild(ov);
    }
    Object.keys(CONTAINERS).forEach(function (v) {
      var el = document.getElementById(CONTAINERS[v]);
      if (el && el.parentElement !== ov) ov.appendChild(el);
    });
    return ov;
  }

  /* retry the active overlay view's init until its container reports success */
  function ensureActiveInit() {
    if (OVERLAY_VIEWS.indexOf(view) === -1) return;
    var el = document.getElementById(CONTAINERS[view]);
    if (el && !el.hasAttribute('data-cc-init') && window[INITS[view]]) {
      window[INITS[view]]();
    }
  }

  function applyOverlay() {
    var ov = ensureOverlay();
    var isOverlayView = OVERLAY_VIEWS.indexOf(view) !== -1;

    if (view !== 'shorts' && window.ccShortsPause) window.ccShortsPause();
    if (view !== 'twitch' && window.ccTwitchPause) window.ccTwitchPause();

    Object.keys(CONTAINERS).forEach(function (v) {
      var el = document.getElementById(CONTAINERS[v]);
      if (el) el.style.display = (isOverlayView && v === view) ? DISPLAY[v] : 'none';
    });

    ov.style.display = isOverlayView ? 'block' : 'none';
    /* call the view's init on every switch (idempotent: restores if already started);
       ensureActiveInit remains the retry path for not-yet-ready containers */
    if (isOverlayView && window[INITS[view]]) {
      window[INITS[view]]();
    } else {
      ensureActiveInit();
    }
  }

  /* ---------- nav buttons ---------- */
  function mountButtons() {
    var ul = document.querySelector('[data-testid="header-navigation-bar"]');
    if (!ul || ul.querySelector('.cc-nav-btn')) return;
    VIEWS.forEach(function (v) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cc-nav-btn';
      btn.setAttribute('data-view', v);
      btn.setAttribute('aria-label', v);
      btn.innerHTML = ICONS[v];
      btn.addEventListener('click', function () { setView(v); });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    updateActive();
  }

  function updateActive() {
    document.querySelectorAll('.cc-nav-btn').forEach(function (b) {
      b.classList.toggle('cc-active', b.getAttribute('data-view') === view);
    });
  }

  function setView(v) {
    if (v === view) return;
    view = v;
    if (OVERLAY_VIEWS.indexOf(v) === -1) listView = v;
    sessionStorage.setItem('cc-view', v);
    updateActive(); /* paint the active state immediately */
    if (v === 'chats' || v === 'youtube') {
      /* give the browser one frame to render the red, then navigate */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          applyAll();
          goToStored(v);
        });
      });
    } else {
      applyAll();
    }
  }

  /* ---------- navigation memory ---------- */
  function normPath(p) {
    return (p.length > 1 && p.charAt(p.length - 1) === '/') ? p.slice(0, -1) : p;
  }

  function rememberSpace() {
    if (OVERLAY_VIEWS.indexOf(view) !== -1) return;
    var p = window.location.pathname;
    if (p.indexOf('/settings') === 0) return;
    sessionStorage.setItem('cc-last-' + listView, normPath(p));
  }

  function firstSpaceLink(v) {
    /* first link in the first visible sidebar group for this view */
    var sidebar = document.querySelector('[data-testid="standard-layout-v2-sidebar"]');
    if (!sidebar) return null;
    var groups = sidebar.querySelectorAll('div.group.relative[id]');
    for (var i = 0; i < groups.length; i++) {
      var isYt = groups[i].id.indexOf('youtube') === 0;
      if (isYt === (v === 'youtube')) {
        var a = groups[i].querySelector('a[href^="/c/"]');
        if (a) return a;
      }
    }
    return null;
  }

  function goToStored(v) {
    var stored = sessionStorage.getItem('cc-last-' + v);
    if (stored && stored === normPath(window.location.pathname)) return;
    var link = stored
      ? document.querySelector(
          '[data-testid="standard-layout-v2-sidebar"] a[href="' + stored + '"], ' +
          '[data-testid="standard-layout-v2-sidebar"] a[href="' + stored + '/"]'
        )
      : null;
    if (!link) link = firstSpaceLink(v); /* no memory yet (or stale): first space in top group */
    if (link) {
      link.click();
    } else if (stored) {
      window.location.href = stored;
    }
  }

  /* ---------- sidebar filtering (chats vs youtube groups) ---------- */
  function applySidebar() {
    var showYoutube = listView === 'youtube';
    var sidebar = document.querySelector('[data-testid="standard-layout-v2-sidebar"]');
    if (!sidebar) return;
    sidebar.querySelectorAll('div.group.relative[id]').forEach(function (g) {
      var isYt = g.id.indexOf('youtube') === 0;
      g.style.display = (isYt === showYoutube) ? '' : 'none';
    });
    sidebar.querySelectorAll('a').forEach(function (a) {
      if (a.textContent.trim() === 'Feed') a.style.display = showYoutube ? 'none' : '';
    });
  }

  /* ---------- publish redirect (back to the space after posting) ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button');
    if (!b) return;
    var isPublish = b.matches('[data-testid="perform-action-button"]') &&
                    document.querySelector('[data-testid="space-selector"]');
    var isEditSave = (b.textContent || '').trim() === 'Save' &&
                     /^\/c\/[^\/]+\/[^\/]+$/.test(window.location.pathname);
    if (isPublish || isEditSave) {
      pendingPublish = Date.now();
    }
  }, true);

  function checkPublishRedirect() {
    var p = window.location.pathname;
    var navigated = p !== lastPath;
    lastPath = p;
    if (!pendingPublish) return;
    if (Date.now() - pendingPublish > 15000) { pendingPublish = 0; return; }
    var m = p.match(/^(\/c\/[^\/]+)\/[^\/]+$/);
    if (!m) { if (navigated) pendingPublish = 0; return; }
    /* editing in place: wait a beat for the save to complete, then bounce */
    if (!navigated && Date.now() - pendingPublish < 1200) return;
    pendingPublish = 0;
    var target = m[1];
    var link = document.querySelector(
      '[data-testid="standard-layout-v2-sidebar"] a[href="' + target + '"], ' +
      '[data-testid="standard-layout-v2-sidebar"] a[href="' + target + '/"]'
    );
    if (link) {
      link.click();
    } else {
      window.location.href = target;
    }
  }

  /* ---------- centering: shared helpers ---------- */
  function getSidebarRight() {
    var sb = document.querySelector('[data-testid="standard-layout-v2-sidebar"]');
    return (sb && sb.offsetParent !== null) ? sb.getBoundingClientRect().right : 0;
  }

  function getFeedAnchor() {
    if (!document.body.classList.contains('view-homepage')) return null;
    var ps = document.querySelector('[data-testid="post_section"]');
    return (ps && ps.offsetParent !== null) ? ps : null;
  }

  function getSpaceContainer() {
    var rps = document.querySelectorAll('.react-page-space-show');
    for (var i = 0; i < rps.length; i++) {
      if (rps[i].offsetParent !== null) return rps[i].parentElement;
    }
    return null;
  }

  function getCoverRoot() {
    var ov = document.querySelector('[data-testid="cover-image-overlay"]');
    if (ov && ov.parentElement) return ov.parentElement;
    var c = document.querySelector('[data-testid="cover-image-container"], #standard-layout-v2-cover-image-container');
    if (c) return c;
    /* guest layout: no admin overlay; find by cover-ish class/id */
    var alt = document.querySelector('[id*="cover-image"], [class*="cover-image"]');
    if (alt) {
      /* climb out of inner img/overlay bits to the sized box */
      while (alt.parentElement && alt.getBoundingClientRect().width === alt.parentElement.getBoundingClientRect().width && !alt.parentElement.classList.contains('main__wrapper') && alt.parentElement !== document.body) {
        alt = alt.parentElement;
      }
      return alt;
    }
    return null;
  }

  function getPostsColumn(ps) {
    var col = ps;
    while (col.parentElement && col.parentElement !== document.body) {
      var p = col.parentElement;
      if (p.classList.contains('main__wrapper') || p.tagName === 'MAIN') break;
      var st = getComputedStyle(p);
      if (st.display.indexOf('flex') !== -1 && st.flexDirection.indexOf('row') !== -1 && p.children.length > 1) break;
      col = p;
    }
    return col;
  }

  function applyShift(el, anchorRect) {
    if (!el) return;
    var cur = parseFloat(el.dataset.ccShift || '0') || 0;
    var delta = Math.round(window.innerWidth / 2 - (anchorRect.left + anchorRect.width / 2));
    var s = cur + delta;
    var minLeft = getSidebarRight() + 16;
    var baseLeft = anchorRect.left - cur;
    if (baseLeft + s < minLeft) s = Math.round(minLeft - baseLeft);
    if (s === cur) return;
    el.dataset.ccShift = String(s);
    el.style.transform = s ? 'translateX(' + s + 'px)' : '';
  }

  function clearShift(el) {
    if (el && el.dataset.ccShift && el.dataset.ccShift !== '0') {
      el.dataset.ccShift = '0';
      el.style.transform = '';
    }
  }

  function resetPinned(except) {
    document.querySelectorAll('[data-cc-pinned]').forEach(function (el) {
      if (el === except) return;
      el.style.width = '';
      el.style.flex = '';
      el.style.maxWidth = '';
      el.style.marginLeft = '';
      el.style.marginRight = '';
      el.removeAttribute('data-cc-pinned');
      clearShift(el);
    });
  }

  function widthOf(el, fallback) {
    if (!el) return 0;
    var w = el.getBoundingClientRect().width;
    if (w > 0) { el.dataset.ccW = String(Math.round(w)); return w; }
    return parseFloat(el.dataset.ccW || '') || fallback;
  }

  /* ---------- centering: main pass ---------- */
  function centerContent() {
    var small = window.innerWidth < 1024;
    var feedPs = getFeedAnchor();

    /* — feed — */
    if (feedPs) {
      var col = getPostsColumn(feedPs);
      var flexC = col.parentElement;

      if (small) {
        clearShift(flexC);
        resetPinned(null);
        var card0 = document.querySelector('.trending-posts');
        if (card0) card0.style.display = '';
        /* collapsed layout: center the fixed-width posts */
        col.style.maxWidth = FEED_COL_W + 'px';
        col.style.marginLeft = 'auto';
        col.style.marginRight = 'auto';
        col.dataset.ccPinned = '1';
        return;
      }

      /* posts column never shrinks (matches post-space width) */
      resetPinned(col);
      col.style.flex = '0 0 auto';
      col.style.width = FEED_COL_W + 'px';
      col.style.maxWidth = '';
      col.style.marginLeft = '';
      col.style.marginRight = '';
      col.dataset.ccPinned = '1';

      /* trending hides when it can no longer fit beside the posts */
      var card = document.querySelector('.trending-posts');
      if (card) {
        var cardW = widthOf(card, 340);
        var psRect0 = feedPs.getBoundingClientRect();
        var fits = (window.innerWidth - EDGE) - (psRect0.right + 16) >= cardW;
        card.style.display = fits ? '' : 'none';
      }

      /* shift the whole flex row (posts + trending together) */
      applyShift(flexC, feedPs.getBoundingClientRect());
      return;
    }

    /* — space pages (posts / events / empty states / covers) — */
    var c = getSpaceContainer();
    var cov = getCoverRoot();

/* cover behaves like a post: fixed posts-width, centered, always visible */
    if (cov) {
      if (small) {
        document.querySelectorAll('[data-cc-cover]').forEach(function (el) {
          el.style.width = ''; el.style.maxWidth = '';
          el.style.marginLeft = ''; el.style.marginRight = '';
          el.removeAttribute('data-cc-cover');
          clearShift(el);
        });
      } else {
        cov.dataset.ccCover = '1';
        /* match the width of an actual post card (any layout, any width) */
        var postsW = FEED_COL_W;
        var post0 = document.querySelector('[data-testid="post-container"]');
        if (post0 && post0.offsetParent !== null) {
          var w0 = post0.getBoundingClientRect().width;
          if (w0 > 100) postsW = Math.round(w0);
        }
        cov.style.width = postsW + 'px';
        cov.style.maxWidth = postsW + 'px';
        cov.style.marginLeft = 'auto';
        cov.style.marginRight = 'auto';
        applyShift(cov, cov.getBoundingClientRect());
      }
      cov.style.display = '';
    }

    if (!c) return;

    if (small) {
      clearShift(c);
      return;
    }

    /* center the visible inner content, not the container box */
    var rpVis = c.querySelector('.react-page-space-show');
    var anchor = (rpVis && rpVis.firstElementChild) ? rpVis.firstElementChild : c;
    applyShift(c, anchor.getBoundingClientRect());
  }

  /* ---------- floating header controls (sort + members + settings) ---------- */
  function getHeaderBlock() {
    var hc = document.querySelector('#standard-layout-header-child > div');
    if (!hc) return null;
    var kids = hc.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].querySelector('[data-testid="dropdown"]') && !kids[i].querySelector('h1')) return kids[i];
    }
    return null;
  }

  function layoutHeaderControls() {
    var block = getHeaderBlock();
    if (!block) return;

    /* chat pages keep Circle's own layout (search + rail toggle) */
    if (document.querySelector('[data-testid="chat-room-wrapper"]')) {
      block.style.visibility = '';
      block.style.top = '';
      block.style.right = '';
      return;
    }
    
    var header = document.querySelector('#standard-layout-header-child > div');
    var headerRect = header.getBoundingClientRect();
    var isFeed = document.body.classList.contains('view-homepage');

    /* classify controls */
    var gap6 = block.querySelector('.gap-6') || block;
    var sortEl = null, memEl = null, dotsEl = null;
    Array.prototype.forEach.call(gap6.children, function (d) {
      if (d.querySelector('[data-testid="three-user-row"]')) memEl = d;
      else if (d.querySelector('[data-testid="space-settings-v3"], [data-testid="feed-settings"]')) dotsEl = d;
      else if (d.querySelector('[data-testid="dropdown-button"]')) sortEl = d;
    });

    /* — feed: top-right corner; tucks under trending when tight; hides with it — */
    if (isFeed) {
      block.style.top = '12px';
      block.style.right = EDGE + 'px';
      var card = document.querySelector('.trending-posts');
      if (!card || card.offsetParent === null) {
        block.style.visibility = 'hidden';
        return;
      }
      var cardRect = card.getBoundingClientRect();
      var bw = widthOf(block, 100);
      var defaultLeft = headerRect.right - EDGE - bw;
      if (cardRect.right + 33 > defaultLeft) {
        /* tuck under the trending card, right edges aligned */
        block.style.top = Math.round(cardRect.bottom - headerRect.top + 12) + 'px';
        block.style.right = Math.round(headerRect.right - cardRect.right) + 'px';
      }
      block.style.visibility = '';
      return;
    }

    /* — post/event spaces: pin to viewport corner, drop controls as room runs out — */
    block.style.top = '12px';
    block.style.right = Math.round(headerRect.right - (window.innerWidth - EDGE)) + 'px';

    var c = getSpaceContainer();
    var contentRight = c ? c.getBoundingClientRect().right : 0;
    var budget = (window.innerWidth - EDGE) - (contentRight + EDGE);

    if (memEl) memEl.style.display = '';
    if (dotsEl) dotsEl.style.display = '';
    block.style.visibility = '';

    var GAP = 24; /* gap-6 */
    var need = widthOf(sortEl, 90) +
               (memEl ? widthOf(memEl, 100) + GAP : 0) +
               (dotsEl ? widthOf(dotsEl, 36) + GAP : 0);
    if (memEl && need > budget) {
      memEl.style.display = 'none';
      need = widthOf(sortEl, 90) + (dotsEl ? widthOf(dotsEl, 36) + GAP : 0);
    }
    if (dotsEl && need > budget) {
      dotsEl.style.display = 'none';
      need = widthOf(sortEl, 90);
    }
    if (need > budget) block.style.visibility = 'hidden';
  }

  /* ---------- escapes & lockdowns ---------- */
  function settingsEscape() {
    var bar = document.querySelector('[data-testid="navigation-bar-wrapper"]');
    if (bar) barSeen = true;
    if (OVERLAY_VIEWS.indexOf(view) === -1) return;
    var barGone = barSeen && !bar; /* only trust "missing" after first sighting */
    var onSettings = window.location.pathname.indexOf('/settings') === 0;
    if (barGone || onSettings) {
      view = 'chats';
      listView = 'chats';
      sessionStorage.setItem('cc-view', 'chats');
      applyAll();
    }
  }

  function lockdownLogo() {
    if (isAdmin()) return;
    var menu = document.querySelector('[data-testid="community-menu"]');
    if (!menu || menu.hasAttribute('data-cc-locked')) return;
    menu.setAttribute('data-cc-locked', '1');
    menu.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      view = 'chats';
      listView = 'chats';
      sessionStorage.setItem('cc-view', 'chats');
      applyAll();
      var feedLink = document.querySelector('[data-testid="standard-layout-v2-sidebar"] a[href="/feed"], [data-testid="standard-layout-v2-sidebar"] a[href^="/feed"]');
      if (feedLink) {
        feedLink.click();
      } else {
        window.location.href = '/feed';
      }
    }, true);
  }

  /* ---------- observers ---------- */
  function applyAll() { updateActive(); applySidebar(); applyOverlay(); centerContent(); layoutHeaderControls(); }

  function observeSizes() {
    if (!window.ResizeObserver) return;
    if (!ro) {
      ro = new ResizeObserver(function () {
        centerContent();
        layoutHeaderControls();
      });
      ro.observe(document.body);
    }
    [getFeedAnchor(), getSpaceContainer(), getCoverRoot()].forEach(function (t) {
      if (t && !t.hasAttribute('data-cc-ro')) {
        t.setAttribute('data-cc-ro', '1');
        ro.observe(t);
      }
    });
  }

  var scheduled = false;
  var obs = new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      mountButtons();
      ensureOverlay();
      ensureActiveInit();
      applySidebar();
      centerContent();
      layoutHeaderControls();
      observeSizes();
      rememberSpace();
      checkPublishRedirect();
      settingsEscape();
      lockdownLogo();
    });
  });

  /* ---------- init ---------- */
  function init() {
    ensureOverlay();
    mountButtons();
    applyAll();
    observeSizes();
    rememberSpace();
    settingsEscape();
    lockdownLogo();
    window.addEventListener('resize', function () {
      centerContent();
      layoutHeaderControls();
    });
    [400, 1200, 3000].forEach(function (ms) {
      setTimeout(function () { centerContent(); layoutHeaderControls(); ensureActiveInit(); }, ms);
    });
    /* warm the Twitch player in the background (top stream, muted) */
    setTimeout(function () {
      if (window.ccTwitchInit) window.ccTwitchInit();
    }, 2500);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ════════════════════════════════════════════════════════════
   2. SHORTS PLAYER
   ════════════════════════════════════════════════════════════
   The vertical video feed behind the Shorts tab. Handles scrolling
   between clips, play/pause, volume, and the like/comment counts.

   (Counts come from the YouTube API through the Lambda proxy, never
   direct — the API key must stay server side.)
   ════════════════════════════════════════════════════════════ */
(function () {
  const API_BASE = "https://api.nichebeast.gg/api/v1";
  const FETCH_PER_PAGE = 7;
  const FETCH_AHEAD = 3;
  const PRELOAD_COUNT = 7;
  const TRANSITION_MS = 460;
  const WHEEL_THRESHOLD = 38;
  const SWIPE_THRESHOLD = 42;
  const VIEWER_ID_KEY = "shorts_viewer_id";
  const DEFAULT_VOLUME = 40;

  const PROXY_BASE = "https://xgwl4tg7hl7f3ndodrw2yxp6ji0dtqlh.lambda-url.us-east-1.on.aws";

  function getOrCreateViewerId() {
    try {
      let id = localStorage.getItem(VIEWER_ID_KEY);
      if (!id) {
        id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
        localStorage.setItem(VIEWER_ID_KEY, id);
      }
      return id;
    } catch (_) {
      return null;
    }
  }

  function recordViewed(dbId) {
    if (!dbId) return;
    const viewerId = getOrCreateViewerId();
    if (!viewerId) return;
    fetch(`${API_BASE}/shorts/public/viewed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewer_id: viewerId, video_ids: [dbId] }),
    }).catch(() => {});
  }

  let shorts = [];
  let currentIndex = 0;
  let isTransitioning = false;
  let currentPage = 0;
  let totalShorts = null;
  let isFetching = false;
  let hasStarted = false;
  let listenersAttached = false;
  let youtubeApiPromise = null;
  let currentVolume = DEFAULT_VOLUME;
  let isMuted = false;
  /* Module scope because three things drive playback now — the pill, a click
     on the video, and syncPlayers on navigation — and they have to agree on
     the state or the icon desyncs from what the video is doing. */
  let isPlaying = true;
  const players = new Map();
  const mountedFrames = new Map();

  function isShortsVisible() {
    const w = document.getElementById("reels-wrapper");
    return !!w && w.offsetParent !== null;
  }

  function loadYoutubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (!youtubeApiPromise) {
      youtubeApiPromise = new Promise((resolve) => {
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof previousReady === "function") previousReady();
          resolve(window.YT);
        };
        if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
        }
      });
    }
    return youtubeApiPromise;
  }

  function getEmbedUrl(id) {
    return `https://www.youtube.com/embed/${id}?enablejsapi=1&autoplay=0&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&loop=1&modestbranding=1&playsinline=1&rel=0&playlist=${id}`;
  }

  function setPlayerState(message) {
    const playerContainer = document.getElementById("reels-player");
    if (!playerContainer) return;
    playerContainer.querySelector(".reels-loader")?.remove();
    playerContainer.querySelector(".reels-empty-message")?.remove();
    if (!message) return;
    const el = document.createElement("div");
    el.className = message === "loading" ? "reels-loader" : "reels-empty-message";
    if (message !== "loading") el.textContent = message;
    playerContainer.appendChild(el);
  }

  function normalizeShort(short) {
    const videoId = short.video_id || extractVideoId(short.embed_url || "");
    if (!videoId) return null;
    return {
      id: String(short.id || videoId),
      dbId: short.id || null,
      videoId,
      title: short.title || "YouTube Short",
      channel: short.channel_title || "",
      /* The shorts API carries no engagement fields at all, so these stay
         null until the YouTube stats call fills them in. There is no
         `shares` any more: the Data API has no share count to read. */
      likes: null,
      comments: null,
      /* Nor any channel id, avatar or handle — all three come from YouTube. */
      channelId: "",
      channelHandle: "",
      channelAvatar: "",
    };
  }

  function extractVideoId(url) {
    try {
      const parsed = new URL(url);
      const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/shorts/")[1].split("?")[0];
      if (parsed.searchParams.has("v")) return parsed.searchParams.get("v");
    } catch (error) {}
    return "";
  }

  function formatCount(n) {
    if (n === null || n === undefined) return "—";
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  async function fetchYouTubeStats(videoIds) {
    if (videoIds.length === 0) return {};
    try {
      const ids = videoIds.join(",");
      const res = await fetch(
        `${PROXY_BASE}/youtube/stats?id=${encodeURIComponent(ids)}`
      );
      if (!res.ok) return {};
      const data = await res.json();
      const map = {};
      /* `parseInt(x) || null` used to sit here, which turned a genuine zero
         into null and drew it as an em dash — a video with no comments read
         as a video whose count failed to load. Only a non-number is unknown. */
      const toCount = (raw) => {
        const n = parseInt(raw ?? "", 10);
        return Number.isFinite(n) ? n : null;
      };
      for (const item of data.items || []) {
        map[item.id] = {
          likes:    toCount(item.statistics.likeCount),
          comments: toCount(item.statistics.commentCount),
          channelId:    item.snippet?.channelId || "",
          channelTitle: item.snippet?.channelTitle || "",
        };
      }
      return map;
    } catch (_) {
      return {};
    }
  }

  /* Channel avatars and handles, keyed by channel id. Cached for the session
     because a playlist tends to revisit the same few channels, and every
     repeat lookup would otherwise cost another quota unit. */
  const channelCache = new Map();

  async function fetchChannels(channelIds) {
    const missing = [...new Set(channelIds.filter((id) => id && !channelCache.has(id)))];
    if (missing.length === 0) return channelCache;
    try {
      const res = await fetch(
        `${PROXY_BASE}/youtube/channels?id=${encodeURIComponent(missing.join(","))}`
      );
      if (res.ok) {
        const data = await res.json();
        for (const c of data.items || []) channelCache.set(c.id, c);
      }
    } catch (_) {}
    /* Cache the misses too, otherwise a channel the API will not return keeps
       being re-requested on every page of shorts. */
    for (const id of missing) if (!channelCache.has(id)) channelCache.set(id, null);
    return channelCache;
  }

  function videoUrl(short) {
    return `https://www.youtube.com/shorts/${short.videoId}`;
  }

  /* A claimed @handle gives the readable /@name URL; without one the only
     stable address is /channel/<id>. */
  function channelUrl(short) {
    if (short.channelHandle) return `https://www.youtube.com/${short.channelHandle}`;
    if (short.channelId) return `https://www.youtube.com/channel/${short.channelId}`;
    return "";
  }

  function updateEngagementPanel(index) {
    const short = shorts[index];
    const likesEl    = document.getElementById("reels-likes-count");
    const commentsEl = document.getElementById("reels-comments-count");
    if (likesEl)    likesEl.textContent    = short ? formatCount(short.likes)    : "—";
    if (commentsEl) commentsEl.textContent = short ? formatCount(short.comments) : "—";
    updateAttribution(short);
    syncCommentsPanel();
  }

  function updateAttribution(short) {
    const railLink   = document.getElementById("reels-channel-link");
    const railAvatar = document.getElementById("reels-channel-avatar");
    const attrLink   = document.getElementById("reels-attr-channel");
    const attrAvatar = document.getElementById("reels-attr-avatar");
    const attrHandle = document.getElementById("reels-attr-handle");
    const ytLink     = document.getElementById("reels-attr-yt");

    const chUrl = short ? channelUrl(short) : "";
    const avatar = short?.channelAvatar || "";
    /* Handle when the channel claimed one, otherwise the plain title — never
       an empty @, which is what a bare customUrl fallback would render. */
    const label = short ? (short.channelHandle || short.channel || "") : "";

    [railLink, attrLink].forEach((el) => {
      if (!el) return;
      if (chUrl) {
        el.href = chUrl;
        el.removeAttribute("aria-disabled");
        el.style.visibility = "";
      } else {
        el.removeAttribute("href");
        el.setAttribute("aria-disabled", "true");
      }
    });

    [railAvatar, attrAvatar].forEach((el) => {
      if (!el) return;
      /* Leave the element in place with its placeholder background when there
         is no avatar; clearing src would draw a broken-image glyph. */
      if (avatar) el.src = avatar;
      else el.removeAttribute("src");
      el.alt = label ? `${label} channel avatar` : "";
    });

    /* The rail avatar is the only rail item that can be empty, so hide it
       rather than leaving a bare ring floating under Share. */
    if (railLink) railLink.style.display = avatar || chUrl ? "" : "none";

    if (attrHandle) attrHandle.textContent = label;

    /* The shorts API's title is the same string YouTube shows. "YouTube Short"
       is normalizeShort's placeholder for a missing one — printing it would be
       worse than printing nothing, and :empty hides the row. */
    const titleEl = document.getElementById("reels-attr-title");
    if (titleEl) {
      const t = short?.title || "";
      titleEl.textContent = t === "YouTube Short" ? "" : t;
    }

    if (ytLink && short) ytLink.href = videoUrl(short);
  }

  /* ---------- share ---------- */

  function showToast(text) {
    const player = document.getElementById("reels-player");
    if (!player) return;
    let toast = document.getElementById("reels-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "reels-toast";
      toast.className = "reels-toast";
      player.appendChild(toast);
    }
    toast.textContent = text;
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove("show"), 1900);
  }

  async function shareCurrent() {
    const short = shorts[currentIndex];
    if (!short) return;
    const url = `https://www.youtube.com/shorts/${short.videoId}`;

    /* navigator.share exists on mobile and almost nowhere on desktop, so the
       clipboard branch is the one most viewers here will actually hit.
       A cancelled share sheet throws AbortError — that is the user declining,
       not a failure, so it must not fall through to copying. */
    if (navigator.share) {
      try {
        await navigator.share({ title: short.title, url });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch (_) {
      showToast("Couldn't copy the link");
    }
  }

  /* ---------- comments panel ---------- */

  let commentsOpen = false;
  let commentsVideoId = null;
  let commentsToken = null;
  /* Every fetch takes a ticket. Scrolling to the next short while a request
     is in flight bumps the counter, so the stale response lands and is
     dropped instead of painting the previous video's comments. */
  let commentsRequestId = 0;

  function setCommentsOpen(open) {
    const panel = document.getElementById("reels-comments-panel");
    const btn = document.getElementById("reels-comments-btn");
    if (!panel) return;
    commentsOpen = open;
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) syncCommentsPanel();
  }

  function syncCommentsPanel() {
    if (!commentsOpen) return;
    const short = shorts[currentIndex];
    if (!short) return;
    const total = document.getElementById("reels-comments-total");
    if (total) {
      total.textContent = short.comments === null ? "" : formatCount(short.comments);
    }
    if (short.videoId !== commentsVideoId) loadComments(short.videoId, false);
  }

  function setCommentsState(text) {
    const body = document.getElementById("reels-comments-body");
    if (!body) return;
    body.textContent = "";
    const div = document.createElement("div");
    div.className = "reels-comments-state";
    div.textContent = text;
    body.appendChild(div);
  }

  function relativeTime(iso) {
    const then = Date.parse(iso);
    if (!Number.isFinite(then)) return "";
    const secs = Math.max(0, (Date.now() - then) / 1000);
    const units = [
      ["y", 31536000], ["mo", 2592000], ["w", 604800],
      ["d", 86400], ["h", 3600], ["m", 60],
    ];
    for (const [label, size] of units) {
      if (secs >= size) return Math.floor(secs / size) + label + " ago";
    }
    return "just now";
  }

  function buildComment(c) {
    const row = document.createElement("div");
    row.className = "reels-comment";

    const avatar = document.createElement("img");
    avatar.className = "reels-comment-avatar";
    avatar.src = c.avatar || "";
    avatar.alt = "";
    avatar.loading = "lazy";
    /* A dead avatar URL would otherwise draw a broken-image glyph. */
    avatar.addEventListener("error", () => { avatar.removeAttribute("src"); });
    row.appendChild(avatar);

    const main = document.createElement("div");
    main.className = "reels-comment-main";

    const head = document.createElement("div");
    const author = document.createElement("span");
    author.className = "reels-comment-author";
    author.textContent = c.author || "Unknown";
    const when = document.createElement("span");
    when.className = "reels-comment-when";
    when.textContent = relativeTime(c.published);
    head.appendChild(author);
    head.appendChild(when);

    const text = document.createElement("div");
    text.className = "reels-comment-text";
    /* textContent, not innerHTML: this is arbitrary text from strangers and
       the proxy already asked YouTube for the plain-text variant. */
    text.textContent = c.text || "";

    const meta = document.createElement("div");
    meta.className = "reels-comment-meta";
    const likes = document.createElement("span");
    likes.textContent = formatCount(c.likes || 0) + (c.likes === 1 ? " like" : " likes");
    meta.appendChild(likes);
    if (c.replies > 0) {
      const replies = document.createElement("span");
      replies.textContent = c.replies + (c.replies === 1 ? " reply" : " replies");
      meta.appendChild(replies);
    }

    main.appendChild(head);
    main.appendChild(text);
    main.appendChild(meta);
    row.appendChild(main);
    return row;
  }

  async function loadComments(videoId, append) {
    const body = document.getElementById("reels-comments-body");
    if (!body) return;

    const ticket = ++commentsRequestId;
    if (!append) {
      commentsVideoId = videoId;
      commentsToken = null;
      setCommentsState("Loading comments…");
    }

    try {
      const token = append && commentsToken
        ? `&pageToken=${encodeURIComponent(commentsToken)}`
        : "";
      const res = await fetch(
        `${PROXY_BASE}/youtube/comments?videoId=${encodeURIComponent(videoId)}${token}`
      );
      if (ticket !== commentsRequestId) return;

      if (!res.ok) {
        if (!append) setCommentsState("Couldn't load comments.");
        return;
      }
      const data = await res.json();
      if (ticket !== commentsRequestId) return;

      if (data.disabled) {
        setCommentsState("Comments are turned off for this video.");
        return;
      }

      const items = data.items || [];
      if (!append) {
        body.textContent = "";
        if (items.length === 0) {
          setCommentsState("No comments on this video yet.");
          return;
        }
      }
      const oldMore = body.querySelector(".reels-comments-more");
      if (oldMore) oldMore.remove();

      items.forEach((c) => body.appendChild(buildComment(c)));
      commentsToken = data.nextPageToken || null;

      if (commentsToken) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "reels-comments-more";
        more.textContent = "Load more comments";
        more.addEventListener("click", () => {
          more.disabled = true;
          more.textContent = "Loading…";
          loadComments(videoId, true);
        });
        body.appendChild(more);
      }
    } catch (_) {
      if (ticket === commentsRequestId && !append) {
        setCommentsState("Couldn't load comments.");
      }
    }
  }

  function updateVolumeIcon() {
    const icon = document.getElementById("reels-volume-icon");
    if (!icon) return;
    const muted = isMuted || currentVolume === 0;
    if (muted) {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
    } else if (currentVolume < 50) {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
    } else {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>';
    }
  }

  function togglePlayback() {
    const player = players.get(currentIndex);
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo?.();
      isPlaying = false;
    } else {
      player.playVideo?.();
      isPlaying = true;
    }
    updatePlayIcon(isPlaying);
  }

  function updatePlayIcon(playing) {
    const icon = document.getElementById("reels-play-icon");
    if (!icon) return;
    if (playing) {
      icon.innerHTML = '<line x1="6" y1="4" x2="6" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/>';
    } else {
      icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
  }

  async function fetchMoreShorts() {
    if (isFetching) return;
    if (totalShorts !== null && currentPage * FETCH_PER_PAGE >= totalShorts) return;
    isFetching = true;
    const nextPage = currentPage + 1;
    try {
      const viewerId = getOrCreateViewerId();
      const viewerParam = viewerId ? `&viewer_id=${encodeURIComponent(viewerId)}` : "";
      const response = await fetch(`${API_BASE}/shorts/public/videos?page=${nextPage}&per_page=${FETCH_PER_PAGE}${viewerParam}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      currentPage = nextPage;
      const total = Number(data.pagination?.total);
      totalShorts = Number.isFinite(total) ? total : totalShorts;
      const existingIds = new Set(shorts.map((short) => short.videoId));
      const incoming = (data.shorts || [])
        .map(normalizeShort)
        .filter((short) => short && !existingIds.has(short.videoId));
      if (incoming.length > 0) {
        const statsMap = await fetchYouTubeStats(incoming.map((s) => s.videoId));
        /* YouTube is authoritative for these — the counts are meant to be
           the ones a viewer would see on YouTube itself. */
        incoming.forEach((s) => {
          const yt = statsMap[s.videoId];
          if (yt) {
            s.likes = yt.likes;
            s.comments = yt.comments;
            s.channelId = yt.channelId;
            if (yt.channelTitle) s.channel = yt.channelTitle;
          }
        });
        /* One batched lookup for the whole page rather than one per video. */
        const channels = await fetchChannels(incoming.map((s) => s.channelId));
        incoming.forEach((s) => {
          const c = channels.get(s.channelId);
          if (c) {
            s.channelAvatar = c.avatar || "";
            s.channelHandle = c.handle || "";
            if (c.title) s.channel = c.title;
          }
        });
      }
      shorts = shorts.concat(incoming);
      if (shorts.length > 0) {
        setPlayerState("");
        renderBufferedFrames();
        syncPlayers();
        updateNavigationState();
      } else {
        setPlayerState("No shorts are available right now.");
      }
    } catch (error) {
      console.error("Failed to fetch public shorts:", error);
      if (shorts.length === 0) setPlayerState("Unable to load shorts right now.");
    } finally {
      isFetching = false;
    }
  }

  function getOrCreateScrollTrack() {
    const playerContainer = document.getElementById("reels-player");
    let track = playerContainer.querySelector(".reels-scroll-track");
    if (!track) {
      track = document.createElement("div");
      track.className = "reels-scroll-track";
      playerContainer.appendChild(track);
    }
    return track;
  }

  function createFrame(index) {
    const short = shorts[index];
    if (!short || mountedFrames.has(index)) return;
    const track = getOrCreateScrollTrack();
    const cell = document.createElement("div");
    cell.className = "reels-cell";
    cell.style.top = `${index * 100}%`;
    const iframe = document.createElement("iframe");
    iframe.className = "reels-frame";
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("title", short.title);
    iframe.setAttribute("src", getEmbedUrl(short.videoId));
    cell.appendChild(iframe);
    const cover = document.createElement("div");
    cover.className = "reels-cell-cover";
    cell.appendChild(cover);
    track.appendChild(cell);
    mountedFrames.set(index, { iframe, cell, cover, player: null });
    loadYoutubeApi().then((YT) => {
      if (!mountedFrames.has(index)) return;
      const player = new YT.Player(iframe, {
        events: {
          onReady: (event) => {
            players.set(index, event.target);
            const entry = mountedFrames.get(index);
            if (entry) entry.player = event.target;
            syncPlayers();
          },
          onStateChange: (event) => {
            /* The cover comes off only once the frame is actually playing —
               any earlier and the poster and play button show through. */
            if (event.data === YT.PlayerState.PLAYING) {
              const entry = mountedFrames.get(index);
              if (entry && index === currentIndex) uncover(entry);
            }
            /* Backstop only, and deliberately late. loop=1 in the embed URL
               restarts the video by itself and does so without drawing any
               chrome — an API seek is what summons the overlay, so seeking
               here immediately would cause the exact flash this avoids. If
               the native loop has not taken over within a second, something
               is wrong and a visible restart beats a stuck video. */
            if (event.data === YT.PlayerState.ENDED) {
              const player = event.target;
              setTimeout(() => {
                if (player.getPlayerState?.() === YT.PlayerState.ENDED) {
                  player.seekTo(0, true);
                  player.playVideo();
                }
              }, 1000);
            }
          },
        },
      });
      const entry = mountedFrames.get(index);
      if (entry) entry.player = player;
    });
  }

  /* There was a watcher here that restarted the video 0.22s early, on the
     theory that the flash was YouTube's end screen. It was not. Instrumenting
     the live player showed ENDED never fires at all — loop=1 restarts the
     video first — while the overlay reproduced perfectly on a bare
     seekTo(0). The seek was the cause, so the watcher was the cause, and
     removing it is the fix. YouTube's own loop is silent; ours was not. */

  /* The cover exists to hide the embed's poster and play button until the
     video is worth looking at, and normally PLAYING lifts it within a few
     hundred ms. But PLAYING is not guaranteed — autoplay can be refused, the
     network can stall, a backgrounded tab throttles media — and a cover with
     no way out strands the viewer on a black rectangle, which is worse than
     the chrome it was hiding. This bounds that: show whatever YouTube is
     showing rather than nothing at all. */
  const COVER_FALLBACK_MS = 2200;

  function uncover(entry) {
    if (!entry) return;
    clearTimeout(entry.coverTimer);
    entry.coverTimer = null;
    entry.cover.classList.add("uncovered");
  }

  function recover(entry) {
    if (!entry) return;
    clearTimeout(entry.coverTimer);
    entry.coverTimer = null;
    entry.cover.classList.remove("uncovered");
  }

  function armCoverFallback(entry) {
    if (!entry || entry.coverTimer || entry.cover.classList.contains("uncovered")) return;
    entry.coverTimer = setTimeout(() => uncover(entry), COVER_FALLBACK_MS);
  }

  function renderBufferedFrames() {
    const preloadRadius = Math.max(1, Math.floor(PRELOAD_COUNT / 2));
    const start = Math.max(0, currentIndex - preloadRadius);
    const end = Math.min(shorts.length - 1, currentIndex + preloadRadius);
    for (let index = start; index <= end; index += 1) {
      createFrame(index);
    }
    mountedFrames.forEach((entry, index) => {
      if (index < start || index > end) {
        players.delete(index);
        entry.player?.destroy?.();
        entry.cell.remove();
        mountedFrames.delete(index);
      } else {
        entry.iframe.classList.toggle("active", index === currentIndex);
      }
    });

    const track = document.querySelector(".reels-scroll-track");
    if (track) {
      track.style.transform = `translateY(${-currentIndex * 100}%)`;
    }
  }

  function syncPlayers(resetActive) {
    if (!isShortsVisible()) return; /* don't autoplay while hidden */
    players.forEach((player, index) => {
      const entry = mountedFrames.get(index);
      if (index === currentIndex) {
        if (isMuted || currentVolume === 0) {
          player.mute?.();
        } else {
          player.unMute?.();
          player.setVolume?.(currentVolume);
        }
        if (resetActive) player.seekTo?.(0, true);
        player.playVideo?.();
        isPlaying = true;
        updatePlayIcon(true);
        armCoverFallback(entry);
      } else {
        player.mute?.();
        player.pauseVideo?.();
        /* Re-cover anything in the background. A paused embed shows its play
           overlay, and these sit paused off-screen until you scroll to them —
           uncovered, that overlay is the first thing you would see on arrival.
           The active frame is deliberately left alone so a deliberate pause
           still shows the video. */
        recover(entry);
      }
    });
  }

  function updateNavigationState() {
    const navUp = document.getElementById("reels-nav-up");
    const navDown = document.getElementById("reels-nav-down");
    const hasMore = totalShorts === null || shorts.length < totalShorts;
    navUp?.classList.toggle("disabled", currentIndex <= 0);
    navDown?.classList.toggle("disabled", currentIndex >= shorts.length - 1 && !hasMore);
  }

  function loadVideo(index) {
    if (index < 0 || index >= shorts.length) return;
    currentIndex = index;
    renderBufferedFrames();
    syncPlayers(true);
    updateNavigationState();
    updateEngagementPanel(index);
    if (shorts.length > 0 && currentIndex >= shorts.length - FETCH_AHEAD) {
      fetchMoreShorts();
    }
  }

  function navigateVideo(direction) {
    if (isTransitioning || shorts.length === 0) return;
    const delta = direction === "up" ? -1 : 1;
    const next = Math.min(Math.max(currentIndex + delta, 0), shorts.length - 1);
    if (next === currentIndex) {
      if (direction === "down") fetchMoreShorts();
      return;
    }
    recordViewed(shorts[currentIndex]?.dbId);
    isTransitioning = true;
    loadVideo(next);
    setTimeout(() => { isTransitioning = false; }, TRANSITION_MS);
  }

  function setupEventListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    const navUp        = document.getElementById("reels-nav-up");
    const navDown      = document.getElementById("reels-nav-down");
    const wrapper      = document.getElementById("reels-wrapper");
    const volumeSlider = document.getElementById("reels-volume-slider");

    navUp.addEventListener("click", () => navigateVideo("up"));
    navDown.addEventListener("click", () => navigateVideo("down"));

    document.getElementById("reels-share-btn")
      ?.addEventListener("click", shareCurrent);
    document.getElementById("reels-comments-btn")
      ?.addEventListener("click", () => setCommentsOpen(!commentsOpen));
    document.getElementById("reels-comments-close")
      ?.addEventListener("click", () => setCommentsOpen(false));

    /* The frame takes no pointer events, so a click on the video lands here.
       Attribution is handled by the two channel links and the YouTube pill, so
       this is free to be play/pause. Those and the top-left controls own their
       own clicks and must not also toggle playback. */
    document.getElementById("reels-player")?.addEventListener("click", (e) => {
      if (e.target.closest(".reels-attribution, .reels-top-left")) return;
      togglePlayback();
    });

    /* The panel scrolls its own list; without this the wheel handler further
       down would read it as a swipe and jump to the next video. */
    document.getElementById("reels-comments-panel")
      ?.addEventListener("wheel", (e) => e.stopPropagation());

    document.getElementById("reels-play-btn")
      .addEventListener("click", togglePlayback);

    volumeSlider.addEventListener("input", () => {
      currentVolume = parseInt(volumeSlider.value, 10);
      isMuted = currentVolume === 0;
      updateVolumeIcon();
      const player = players.get(currentIndex);
      if (player) {
        if (isMuted) { player.mute?.(); }
        else { player.unMute?.(); player.setVolume?.(currentVolume); }
      }
    });

    document.getElementById("reels-volume-icon").closest(".reels-volume-pill-icon").addEventListener("click", (e) => {
      e.stopPropagation();
      isMuted = !isMuted;
      if (!isMuted && currentVolume === 0) {
        currentVolume = DEFAULT_VOLUME;
        volumeSlider.value = currentVolume;
      }
      updateVolumeIcon();
      const player = players.get(currentIndex);
      if (player) {
        if (isMuted) { player.mute?.(); }
        else { player.unMute?.(); player.setVolume?.(currentVolume); }
      }
    });

    volumeSlider.addEventListener("click", (e) => e.stopPropagation());

    wrapper.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) > WHEEL_THRESHOLD) {
        navigateVideo(e.deltaY > 0 ? "down" : "up");
      }
    }, { passive: false });

    let touchStart = null;
    wrapper.addEventListener("touchstart", (e) => {
      /* A swipe that begins inside the comments list is the viewer scrolling
         it, not asking for the next video. */
      if (e.target.closest?.("#reels-comments-panel")) { touchStart = null; return; }
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    wrapper.addEventListener("touchend", (e) => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dy = t.clientY - touchStart.y;
      const dx = t.clientX - touchStart.x;
      touchStart = null;
      if (Math.abs(dy) < SWIPE_THRESHOLD || Math.abs(dy) < Math.abs(dx)) return;
      navigateVideo(dy < 0 ? "down" : "up");
    }, { passive: true });

    document.addEventListener("keydown", (e) => {
      if (!isShortsVisible()) return;
      /* Never swallow a space someone is typing — Circle has composers and
         search fields on the page behind this, and the volume slider answers
         to space itself once focused. */
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      switch (e.key) {
        case "ArrowUp": e.preventDefault(); navigateVideo("up"); break;
        case "ArrowDown": e.preventDefault(); navigateVideo("down"); break;
        case " ":
        case "Spacebar": e.preventDefault(); togglePlayback(); break;
        case "Escape": if (commentsOpen) { e.preventDefault(); setCommentsOpen(false); } break;
      }
    });
  }

async function setupReelsPlayer() {
    if (!document.getElementById('reels-player')) return;
    if (hasStarted) {
      renderBufferedFrames();
      syncPlayers();
      return;
    }
    hasStarted = true;
    document.getElementById('reels-wrapper').setAttribute('data-cc-init', '1');
    setupEventListeners();
    setPlayerState("loading");
    await Promise.all([loadYoutubeApi(), fetchMoreShorts()]);
    if (shorts.length > 0) loadVideo(currentIndex);
  }

  window.ccShortsInit = setupReelsPlayer;
  window.ccShortsPause = function () {
    players.forEach(function (p) { p.pauseVideo && p.pauseVideo(); });
  };
})();

/* ════════════════════════════════════════════════════════════
   3. TWITCH PLAYER
   ════════════════════════════════════════════════════════════
   The live stream panel. The top stream preloads muted so the first
   open is instant. Streams keep playing when you switch tabs, muted
   while you are away, and come back at your volume.

   (Stream list comes from the Twitch API through the Lambda proxy.
   Remaining players are only created on the first real visit.)
   ════════════════════════════════════════════════════════════ */
(function () {
  const PROXY_BASE = "https://xgwl4tg7hl7f3ndodrw2yxp6ji0dtqlh.lambda-url.us-east-1.on.aws";
  const DOTA2_GAME_ID = "29595";
  const bannedStreamers = ['judah_xx', 'zuyzyan'];

  let players = {};
  let currentStream = localStorage.getItem('twitchViewerCurrentStream') || null;
  let liveStreamData = {};
  let apiCheckInterval = null;
  let currentPage = 0;
  let streamsPerPage = 5;
  let allStreamers = [];
  let userVolume = parseFloat(localStorage.getItem('twitchViewerVolume')) || 0.5;
  let userMuted = localStorage.getItem('twitchViewerMuted') === 'true' || false;
  let settingVolume = false;
  let awayMuted = false;
  let twitchApiPromise = null;
  let hasStarted = false;
  let listenersAttached = false;
  let playerScope = 'preload'; /* only the top stream is created until the tab is first opened */

  function isTwitchVisible() {
    const t = document.getElementById('twitch-container');
    return !!t && t.offsetParent !== null;
  }

  function loadTwitchApi() {
    if (window.Twitch && window.Twitch.Player) return Promise.resolve(window.Twitch);
    if (!twitchApiPromise) {
      twitchApiPromise = new Promise((resolve) => {
        const existing = document.querySelector("script[src='https://embed.twitch.tv/embed/v1.js']");
        if (existing) {
          existing.addEventListener('load', () => resolve(window.Twitch));
          if (window.Twitch) resolve(window.Twitch);
          return;
        }
        const tag = document.createElement("script");
        tag.src = "https://embed.twitch.tv/embed/v1.js";
        tag.addEventListener('load', () => resolve(window.Twitch));
        document.head.appendChild(tag);
      });
    }
    return twitchApiPromise;
  }

  async function fetchLiveStreams() {
    const url = `${PROXY_BASE}/twitch/streams?game_id=${DOTA2_GAME_ID}`;
    try {
      await loadTwitchApi();
      const response = await fetch(url);
      if (!response.ok) return;
      const data = await response.json();

      const newLiveStreamData = {};
      data.data.forEach(stream => {
        const username = stream.user_login.toLowerCase();
        if (!bannedStreamers.includes(username)) {
          newLiveStreamData[username] = { username: username, viewers: stream.viewer_count };
        }
      });

      if (currentStream && !newLiveStreamData[currentStream]) {
        const availableStreams = Object.keys(newLiveStreamData);
        if (availableStreams.length > 0) {
          openStream(availableStreams[0]);
        } else {
          currentStream = null;
        }
      }

      liveStreamData = newLiveStreamData;

      const sortedStreamers = Object.values(liveStreamData)
        .sort((a, b) => b.viewers - a.viewers)
        .map(stream => stream.username);

      if (sortedStreamers.length > 0 && !currentStream) {
        currentStream = sortedStreamers[0];
        localStorage.setItem('twitchViewerCurrentStream', currentStream);
      }

      updateStreamButtons(sortedStreamers);
      updatePlayers(sortedStreamers);
    } catch (error) {
      /* Silently fail */
    }
  }

  function updatePlayers(liveStreamers) {
    const wrapper = document.getElementById("video-wrapper");
    const currentPlayerDivs = Array.from(wrapper.children).map(div => div.id.replace('player-', ''));

    currentPlayerDivs.forEach(channel => {
      if (!liveStreamers.includes(channel)) {
        const div = document.getElementById(`player-${channel}`);
        if (div) div.remove();
        const chatFrame = document.getElementById(`chat-${channel}`);
        if (chatFrame) chatFrame.remove();
        delete players[channel];
      }
    });

    liveStreamers.forEach((channel) => {
      if (playerScope === 'preload' && channel !== currentStream) return;
      const existingDiv = document.getElementById(`player-${channel}`);
      if (!existingDiv) {
        const containerId = `player-${channel}`;
        const div = document.createElement("div");
        div.id = containerId;
        div.style = "flex-grow: 1; height: 100%; display: none;";
        wrapper.appendChild(div);

        setTimeout(() => {
          const player = new Twitch.Player(containerId, {
            channel,
            parent: ["www.endmid.gg"],
            width: "100%",
            height: "100%",
            autoplay: true,
            muted: true,
            volume: userVolume
          });

          player.addEventListener(Twitch.Player.READY, () => {
            players[channel] = player;
            if (channel === currentStream) {
              const div = document.getElementById(`player-${channel}`);
              if (div) div.style.display = "block";
              if (isTwitchVisible()) {
                openStream(channel);
              } else {
                awayMuted = true; /* already muted via constructor; playing warm */
              }
            }
          });
        }, 0);
      }
    });
  }

  function updateStreamButtons(liveStreamers) {
    allStreamers = liveStreamers;
    if (!isTwitchVisible()) return; /* hidden: keep data, skip DOM */

    const container = document.getElementById("stream-buttons");
    const controlBar = document.getElementById("control-bar");
    if (!controlBar || !container) return;

    const arrowsContainer = document.getElementById("twitch-pagination");
    if (!arrowsContainer) return;

    const arrowsLeft = arrowsContainer.offsetLeft;
    const containerLeft = container.offsetLeft;
    const availableWidth = arrowsLeft - containerLeft - 6;

    const startIndex = currentPage * streamsPerPage;
    const estimatedMaxButtons = Math.ceil(availableWidth / 100) + 2;
    const streamersToRender = liveStreamers.slice(startIndex, startIndex + estimatedMaxButtons);

    const makeButton = (channel) => {
      const btn = document.createElement("button");
      btn.className = "stream-button";
      btn.dataset.channel = channel;
      btn.textContent = `${capitalize(channel)} (${liveStreamData[channel].viewers.toLocaleString()})`;
      if (channel === currentStream) btn.classList.add('cc-live-active');
      btn.onclick = () => openStream(channel);
      return btn;
    };

    container.innerHTML = "";
    streamersToRender.forEach(channel => container.appendChild(makeButton(channel)));
    container.offsetWidth; /* force layout */

    const buttons = Array.from(container.children);
    let totalWidth = 0;
    let buttonsFit = 0;
    for (let i = 0; i < buttons.length; i++) {
      const rightEdge = totalWidth + (i > 0 ? 4 : 0) + buttons[i].offsetWidth;
      if (rightEdge <= availableWidth) {
        totalWidth = rightEdge;
        buttonsFit++;
      } else {
        break;
      }
    }
    streamsPerPage = Math.max(1, buttonsFit);

    container.innerHTML = "";
    liveStreamers.slice(startIndex, startIndex + buttonsFit).forEach(channel => container.appendChild(makeButton(channel)));

    const prevButton = document.getElementById("prev-button");
    const nextButton = document.getElementById("next-button");
    if (prevButton && nextButton) {
      prevButton.disabled = currentPage === 0;
      nextButton.disabled = (startIndex + buttonsFit) >= liveStreamers.length;
    }
  }

  function nextPage() {
    const totalPages = Math.ceil(allStreamers.length / streamsPerPage);
    if (currentPage < totalPages - 1) {
      currentPage++;
      updateStreamButtons(allStreamers);
    }
  }

  function previousPage() {
    if (currentPage > 0) {
      currentPage--;
      updateStreamButtons(allStreamers);
    }
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function openStream(channel) {
    if (channel === currentStream && players[channel]) return; /* already watching */
    const wrapper = document.getElementById("video-wrapper");
    wrapper.querySelectorAll('[id^="player-"]').forEach(div => {
      div.style.display = "none";
      const channelName = div.id.replace('player-', '');
      if (players[channelName]) players[channelName].setMuted(true);
    });

    const activeDiv = document.getElementById(`player-${channel}`);
    if (activeDiv) activeDiv.style.display = "block";

    const player = players[channel];
    if (player) {
      settingVolume = true;
      player.setMuted(userMuted);
      player.setVolume(userVolume);
      settingVolume = false;
      player.play && player.play();
    }

    const chatWrapper = document.getElementById("chat-wrapper");
    chatWrapper.querySelectorAll('[id^="chat-"]').forEach(chat => { chat.style.display = "none"; });

    let activeChat = document.getElementById(`chat-${channel}`);
    if (!activeChat) {
      activeChat = document.createElement("iframe");
      activeChat.id = `chat-${channel}`;
      activeChat.className = "chat-frame";
      activeChat.src = `https://www.twitch.tv/embed/${channel}/chat?parent=www.endmid.gg&darkpopout`;
      chatWrapper.appendChild(activeChat);
    }
    activeChat.style.display = "block";
    document.querySelectorAll('#stream-buttons .stream-button').forEach(b => {
      b.classList.toggle('cc-live-active', b.dataset.channel === channel);
    });
    currentStream = channel;
    localStorage.setItem('twitchViewerCurrentStream', channel);
  }

  function toggleChat() {
    const chatWrapper = document.getElementById("chat-wrapper");
    const videoWrapper = document.getElementById("video-wrapper");
    const button = document.getElementById("toggle-chat-button");
    const isChatVisible = chatWrapper.style.right === "0px";
    if (isChatVisible) {
      chatWrapper.style.right = "-25%";
      videoWrapper.style.width = "100%";
      button.innerText = "Show Chat";
    } else {
      chatWrapper.style.right = "0px";
      videoWrapper.style.width = "75%";
      button.innerText = "Hide Chat";
    }
  }

  function restoreTwitchSection() {
    const streamButtons = document.getElementById("stream-buttons");
    if (!streamButtons) return;
    if (streamButtons.children.length === 0) {
      if (allStreamers.length > 0) {
        updateStreamButtons(allStreamers); /* data ready, render now that we're visible */
      } else {
        fetchLiveStreams();
        return;
      }
    }

    /* unmute back to the user's saved state (stream never stopped playing) */
    if (awayMuted && currentStream && players[currentStream]) {
      const player = players[currentStream];
      settingVolume = true;
      player.setMuted(userMuted);
      player.setVolume(userVolume);
      settingVolume = false;
      awayMuted = false;
      player.play && player.play();
    }

    const currentPlayerDiv = currentStream ? document.getElementById(`player-${currentStream}`) : null;

    if (currentPlayerDiv && players[currentStream] && allStreamers.includes(currentStream)) {
      currentPlayerDiv.style.display = "block";
      const chatWrapper = document.getElementById("chat-wrapper");
      let activeChat = document.getElementById(`chat-${currentStream}`);
      if (!activeChat) {
        activeChat = document.createElement("iframe");
        activeChat.id = `chat-${currentStream}`;
        activeChat.className = "chat-frame";
        activeChat.src = `https://www.twitch.tv/embed/${currentStream}/chat?parent=www.endmid.gg&darkpopout`;
        chatWrapper.appendChild(activeChat);
      }
      activeChat.style.display = "block";
    } else if (currentStream && allStreamers.includes(currentStream)) {
      openStream(currentStream);
    } else if (allStreamers.length > 0) {
      currentPage = 0;
      updateStreamButtons(allStreamers);
      const firstButton = streamButtons.children[0];
      if (firstButton && firstButton.dataset.channel) {
        openStream(firstButton.dataset.channel);
      }
    }
  }

  function setupTwitchListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    document.getElementById("toggle-chat-button").addEventListener('click', toggleChat);
    document.getElementById("prev-button").addEventListener('click', previousPage);
    document.getElementById("next-button").addEventListener('click', nextPage);

    let rafScheduled = false;
    let resizeTimeout = null;
    let isUpdating = false;

    window.addEventListener('resize', () => {
      if (!rafScheduled && !isUpdating) {
        rafScheduled = true;
        requestAnimationFrame(() => {
          rafScheduled = false;
          if (allStreamers.length > 0 && !isUpdating) {
            isUpdating = true;
            updateStreamButtons(allStreamers);
            isUpdating = false;
          }
        });
      }
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resizeTimeout = null;
        if (allStreamers.length > 0 && !isUpdating) {
          requestAnimationFrame(() => {
            if (!isUpdating) {
              isUpdating = true;
              updateStreamButtons(allStreamers);
              isUpdating = false;
            }
          });
        }
      }, 300);
    });

    /* volume sync poller: skipped while away-muted so the temporary
       mute never overwrites the user's saved preference */
    setTimeout(() => {
      setInterval(() => {
        if (awayMuted) return;
        if (currentStream && players[currentStream] && !settingVolume) {
          const player = players[currentStream];
          const vol = player.getVolume();
          const mute = player.getMuted();
          if (vol !== userVolume || mute !== userMuted) {
            userVolume = vol;
            userMuted = mute;
            localStorage.setItem('twitchViewerVolume', vol.toString());
            localStorage.setItem('twitchViewerMuted', mute.toString());
          }
        }
      }, 500);
    }, 2000);
  }

  function startApiChecks() {
    if (apiCheckInterval) clearInterval(apiCheckInterval);
    apiCheckInterval = setInterval(() => { fetchLiveStreams(); }, 60000);
  }

  async function initTwitch() {
    if (!document.getElementById('twitch-container') || !document.getElementById('toggle-chat-button')) return;
    if (isTwitchVisible()) {
      if (playerScope === 'preload') {
        playerScope = 'all';
        if (allStreamers.length > 0) updatePlayers(allStreamers);
      }
      /* always re-render buttons on reveal (hidden-time renders are skipped) */
      requestAnimationFrame(() => {
        if (allStreamers.length > 0) updateStreamButtons(allStreamers);
      });
    }
    if (hasStarted) {
      restoreTwitchSection();
      return;
    }
    hasStarted = true;
    document.getElementById('twitch-container').setAttribute('data-cc-init', '1');
    setupTwitchListeners();
    await loadTwitchApi();
    fetchLiveStreams();
    startApiChecks();
  }

  window.ccTwitchInit = initTwitch;
  window.ccTwitchPause = function () {
    /* mute (don't pause) the active stream while on another tab */
    if (currentStream && players[currentStream]) {
      awayMuted = true;
      settingVolume = true;
      players[currentStream].setMuted(true);
      settingVolume = false;
    }
  };
})();

/* ════════════════════════════════════════════════════════════
   4. MINI GAMES
   ════════════════════════════════════════════════════════════
   The games overlay: the spinner wheel and the Slark runner.

   (This used to live in Circle's head box to dodge the JS field
   character limit. Loading from GitHub removed that limit, so it is
   back with the rest of the code.)
   ════════════════════════════════════════════════════════════ */
(function () {
  /* ---------- Shared: menu switching ---------- */
  let initialized = false;
  let activeGame = 'wheel';

  function showGame(game) {
    activeGame = game;
    document.querySelectorAll('.games-menu-btn').forEach(function (b) {
      b.classList.toggle('games-active', b.getAttribute('data-game') === game);
    });
    document.getElementById('wheel-area').style.display = (game === 'wheel') ? 'flex' : 'none';
    document.getElementById('slark-area').classList.toggle('active', game === 'slark');
    document.getElementById('wheel-winner').classList.remove('show');
    document.getElementById('slark-death').classList.remove('show');
    if (game === 'slark') slarkResume();
  }

  /* ---------- Game 1: Hero Wheel ---------- */
  const HEROES = [
    "Alchemist","Axe","Bristleback","Centaur Warrunner","Chaos Knight","Clockwerk","Dawnbreaker","Doom","Dragon Knight","Earth Spirit","Earthshaker","Elder Titan","Huskar","Kunkka","Largo","Legion Commander","Lifestealer","Lycan","Mars","Night Stalker","Ogre Magi","Omniknight","Phoenix","Primal Beast","Pudge","Slardar","Spirit Breaker","Sven","Tidehunter","Timbersaw","Tiny","Treant Protector","Tusk","Underlord","Undying","Wraith King",
    "Anti-Mage","Bloodseeker","Bounty Hunter","Broodmother","Clinkz","Drow Ranger","Ember Spirit","Faceless Void","Gyrocopter","Hoodwink","Juggernaut","Kez","Lone Druid","Luna","Medusa","Meepo","Mirana","Monkey King","Morphling","Naga Siren","Phantom Assassin","Phantom Lancer","Razor","Riki","Shadow Fiend","Slark","Sniper","Spectre","Templar Assassin","Terrorblade","Troll Warlord","Ursa","Vengeful Spirit","Viper","Weaver",
    "Ancient Apparition","Chen","Crystal Maiden","Dark Seer","Dark Willow","Disruptor","Enchantress","Grimstroke","Invoker","Jakiro","Keeper of the Light","Leshrac","Lich","Lina","Lion","Muerta","Necrophos","Oracle","Outworld Destroyer","Puck","Pugna","Queen of Pain","Ringmaster","Rubick","Shadow Demon","Shadow Shaman","Silencer","Skywrath Mage","Storm Spirit","Tinker","Warlock","Winter Wyvern","Witch Doctor","Zeus",
    "Abaddon","Arc Warden","Bane","Batrider","Beastmaster","Brewmaster","Dazzle","Death Prophet","Enigma","Io","Magnus","Marci","Nature's Prophet","Nyx Assassin","Pangolier","Sand King","Snapfire","Spirit Bear","Techies","Venomancer","Visage","Void Spirit"
  ];

  const COLORS = ["#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c","#3498db","#9b59b6","#e84393","#fd79a8","#00cec9","#6c5ce7","#fdcb6e"];

  let wCanvas, wCtx, wSize, wRadius;
  let rotation = 0;
  let spinning = false;

  function drawWheel() {
    const n = HEROES.length;
    const arc = (Math.PI * 2) / n;
    wCtx.clearRect(0, 0, wSize, wSize);
    wCtx.save();
    wCtx.translate(wSize / 2, wSize / 2);
    wCtx.rotate(rotation);

    for (let i = 0; i < n; i++) {
      const start = i * arc;
      wCtx.beginPath();
      wCtx.moveTo(0, 0);
      wCtx.arc(0, 0, wRadius, start, start + arc);
      wCtx.closePath();
      wCtx.fillStyle = COLORS[i % COLORS.length];
      wCtx.fill();
      wCtx.strokeStyle = "rgba(0,0,0,0.25)";
      wCtx.lineWidth = 1;
      wCtx.stroke();

      wCtx.save();
      wCtx.rotate(start + arc / 2);
      wCtx.textAlign = "right";
      wCtx.textBaseline = "middle";
      wCtx.fillStyle = "#111";
      wCtx.font = "700 9px Arial, sans-serif";
      wCtx.fillText(HEROES[i], wRadius - 8, 0);
      wCtx.restore();
    }

    wCtx.beginPath();
    wCtx.arc(0, 0, 56, 0, Math.PI * 2);
    wCtx.fillStyle = "#1b1d21";
    wCtx.fill();
    wCtx.restore();
  }

  function currentWinnerIndex() {
    const n = HEROES.length;
    const arc = (Math.PI * 2) / n;
    let a = ((-Math.PI / 2) - rotation) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return Math.floor(a / arc) % n;
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    document.getElementById("wheel-spin-btn").disabled = true;

    const target = Math.random() * Math.PI * 2;
    const turns = 6 + Math.floor(Math.random() * 3);
    const startRotation = rotation % (Math.PI * 2);
    const delta = (turns * Math.PI * 2) + target - startRotation;
    const duration = 5200;
    const startTime = performance.now();

    function frame(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      rotation = startRotation + delta * eased;
      drawWheel();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        spinning = false;
        document.getElementById("wheel-spin-btn").disabled = false;
        document.getElementById("wheel-winner-name").textContent = HEROES[currentWinnerIndex()];
        document.getElementById("wheel-winner").classList.add("show");
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Game 2: Slarky Run ---------- */
  const S = {
    canvas: null, ctx: null, W: 900, H: 320,
    GROUND: 270,
    state: 'idle',          /* idle | running | dead | paused */
    frames: 0,
    speed: 6,
    player: { x: 90, y: 0, vy: 0, standH: 44, duckH: 24, w: 52, duck: false, onGround: true },
    obstacles: [],
    spawnIn: 90,
    score: 0,
    high: parseFloat(sessionStorage.getItem('slarkHighScore')) || 0,
    rafId: null
  };

  function slarkVisible() {
    const gc = document.getElementById('games-container');
    return gc && gc.style.display !== 'none' && activeGame === 'slark';
  }

  function playerH() { return S.player.duck ? S.player.duckH : S.player.standH; }

  function slarkReset() {
    S.frames = 0;
    S.speed = 6;
    S.obstacles = [];
    S.spawnIn = 90;
    S.score = 0;
    S.player.y = S.GROUND;
    S.player.vy = 0;
    S.player.duck = false;
    S.player.onGround = true;
  }

  function slarkStart() {
    slarkReset();
    S.state = 'running';
    loop();
  }

  function slarkResume() {
    if (S.state === 'paused') {
      S.state = 'running';
      loop();
    } else {
      drawSlarkFrame(); /* repaint idle/dead screen */
    }
  }

  function jump() {
    if (S.state === 'idle' || S.state === 'dead') {
      document.getElementById('slark-death').classList.remove('show');
      slarkStart();
      return;
    }
    if (S.state === 'running' && S.player.onGround) {
      S.player.vy = -11.5;
      S.player.onGround = false;
    }
  }

  function spawnObstacle() {
    const high = Math.random() < 0.35 && S.frames > 600; /* swimming sharks appear after ~10s */
    S.obstacles.push({
      x: S.W + 60,
      type: high ? 'high' : 'ground',
      w: high ? 74 : 62,
      h: high ? 40 : 36,
      bob: Math.random() * Math.PI * 2
    });
    const base = Math.max(46, 110 - S.speed * 5);
    S.spawnIn = base + Math.random() * 55;
  }

  function drawSlark(ctx, x, groundY, h, duck, t) {
    const w = S.player.w;
    const y = groundY - h;
    const wig = Math.sin(t / 4) * (duck ? 1 : 2);
    ctx.save();
    /* tail */
    ctx.fillStyle = '#2f8f7f';
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x - 16, y + h / 2 - 10 + wig);
    ctx.lineTo(x - 16, y + h / 2 + 10 + wig);
    ctx.closePath();
    ctx.fill();
    /* body */
    ctx.fillStyle = '#3fae99';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    /* belly */
    ctx.fillStyle = '#7fd6c4';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.68, w / 2.4, h / 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    /* dorsal fin */
    if (!duck) {
      ctx.fillStyle = '#2f8f7f';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.42, y + 2);
      ctx.lineTo(x + w * 0.58, y - 12);
      ctx.lineTo(x + w * 0.68, y + 4);
      ctx.closePath();
      ctx.fill();
    }
    /* eye */
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(x + w * 0.74, y + h * 0.38, duck ? 3 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + w * 0.76, y + h * 0.38, duck ? 1.4 : 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShark(ctx, o, t) {
    const groundY = S.GROUND;
    let y;
    if (o.type === 'ground') {
      y = groundY - o.h;
    } else {
      y = groundY - 70 + Math.sin(t / 10 + o.bob) * 3;
    }
    ctx.save();
    /* body */
    ctx.fillStyle = '#8a97a5';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    /* belly */
    ctx.fillStyle = '#c8d2db';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, y + o.h * 0.7, o.w / 2.5, o.h / 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    /* dorsal fin */
    ctx.fillStyle = '#6d7a88';
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * 0.42, y + 2);
    ctx.lineTo(o.x + o.w * 0.52, y - 16);
    ctx.lineTo(o.x + o.w * 0.66, y + 4);
    ctx.closePath();
    ctx.fill();
    /* tail */
    ctx.beginPath();
    ctx.moveTo(o.x + o.w, y + o.h / 2);
    ctx.lineTo(o.x + o.w + 14, y + o.h / 2 - 12);
    ctx.lineTo(o.x + o.w + 14, y + o.h / 2 + 12);
    ctx.closePath();
    ctx.fill();
    /* eye (facing left, toward the player) */
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(o.x + o.w * 0.2, y + o.h * 0.4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    /* mouth */
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(o.x + o.w * 0.12, y + o.h * 0.62, 6, -0.4, 1.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSlarkFrame() {
    const ctx = S.ctx;
    if (!ctx) return;
    /* background */
    ctx.fillStyle = '#0c1418';
    ctx.fillRect(0, 0, S.W, S.H);
    /* ground line */
    ctx.strokeStyle = '#2b3a41';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, S.GROUND + 1);
    ctx.lineTo(S.W, S.GROUND + 1);
    ctx.stroke();
    /* ground speckles (scroll with speed) */
    ctx.fillStyle = '#22313a';
    for (let i = 0; i < 22; i++) {
      const sx = ((i * 97) - (S.frames * S.speed)) % S.W;
      const px = sx < 0 ? sx + S.W : sx;
      ctx.fillRect(px, S.GROUND + 10 + (i % 3) * 9, 14, 3);
    }
    /* obstacles */
    S.obstacles.forEach(function (o) { drawShark(ctx, o, S.frames); });
    /* player */
    drawSlark(ctx, S.player.x, S.player.y, playerH(), S.player.duck, S.frames);
    /* score */
    ctx.fillStyle = '#E4E7EB';
    ctx.font = '700 18px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(S.score.toFixed(1) + 's', S.W - 18, 34);
    ctx.fillStyle = '#7a838c';
    ctx.font = '600 13px Arial, sans-serif';
    ctx.fillText('BEST ' + S.high.toFixed(1) + 's', S.W - 18, 54);
    /* idle prompt */
    if (S.state === 'idle') {
      ctx.fillStyle = '#E4E7EB';
      ctx.textAlign = 'center';
      ctx.font = '800 26px Arial, sans-serif';
      ctx.fillText('SLARKY RUN', S.W / 2, 120);
      ctx.font = '600 15px Arial, sans-serif';
      ctx.fillStyle = '#A5A9AD';
      ctx.fillText('Press Space or click to start', S.W / 2, 150);
    }
  }

  function slarkStep() {
    S.frames++;
    S.score = S.frames / 60;
    S.speed = Math.min(13, 6 + S.frames * 0.0012);

    /* player physics */
    const p = S.player;
    if (!p.onGround) {
      p.vy += 0.55;
      p.y += p.vy;
      if (p.y >= S.GROUND) {
        p.y = S.GROUND;
        p.vy = 0;
        p.onGround = true;
      }
    }

    /* obstacles */
    S.spawnIn--;
    if (S.spawnIn <= 0) spawnObstacle();
    S.obstacles.forEach(function (o) { o.x -= S.speed; });
    S.obstacles = S.obstacles.filter(function (o) { return o.x + o.w + 20 > 0; });

    /* collision (AABB with padding) */
    const pad = 6;
    const ph = playerH();
    const px1 = p.x + pad, px2 = p.x + p.w - pad;
    const py1 = p.y - ph + pad, py2 = p.y - pad;
    for (const o of S.obstacles) {
      let oy;
      if (o.type === 'ground') oy = S.GROUND - o.h;
      else oy = S.GROUND - 70;
      const ox1 = o.x + pad, ox2 = o.x + o.w - pad;
      const oy1 = oy + pad, oy2 = oy + o.h - pad;
      if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
        slarkDie();
        return;
      }
    }
  }

  function slarkDie() {
    S.state = 'dead';
    const isRecord = S.score > S.high;
    if (isRecord) {
      S.high = S.score;
      sessionStorage.setItem('slarkHighScore', String(S.high));
    }
    document.getElementById('slark-death-score').textContent = S.score.toFixed(1) + 's';
    document.getElementById('slark-death-best').textContent = 'Best this session: ' + S.high.toFixed(1) + 's';
    document.getElementById('slark-death-record').classList.toggle('show', isRecord);
    document.getElementById('slark-death').classList.add('show');
  }

  function loop() {
    if (S.state !== 'running') return;
    if (!slarkVisible()) {
      S.state = 'paused';
      return;
    }
    slarkStep();
    drawSlarkFrame();
    if (S.state === 'running') S.rafId = requestAnimationFrame(loop);
  }

  /* ---------- Init ---------- */
  function initGames() {
    if (!document.getElementById('wheel-canvas') || !document.getElementById('slark-canvas')) return;
    if (initialized) {
      if (activeGame === 'wheel') drawWheel();
      else slarkResume();
      return;
    }
    initialized = true;
    document.getElementById('games-container').setAttribute('data-cc-init', '1');

    /* wheel */
    wCanvas = document.getElementById("wheel-canvas");
    wCtx = wCanvas.getContext("2d");
    wSize = wCanvas.width;
    wRadius = wSize / 2 - 4;
    document.getElementById("wheel-spin-btn").addEventListener("click", spin);
    document.getElementById("wheel-winner-close").addEventListener("click", function () {
      document.getElementById("wheel-winner").classList.remove("show");
    });
    drawWheel();

    /* slark */
    S.canvas = document.getElementById('slark-canvas');
    S.ctx = S.canvas.getContext('2d');
    S.player.y = S.GROUND;
    drawSlarkFrame();

    S.canvas.addEventListener('click', function () { if (slarkVisible()) jump(); });
    document.getElementById('slark-death-close').addEventListener('click', function () {
      document.getElementById('slark-death').classList.remove('show');
      slarkStart();
    });

    document.addEventListener('keydown', function (e) {
      if (!slarkVisible()) return;
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        S.player.duck = true;
      }
    });
    document.addEventListener('keyup', function (e) {
      if (e.code === 'ArrowDown') S.player.duck = false;
    });

    /* menu switching */
    document.querySelectorAll('.games-menu-btn').forEach(function (b) {
      b.addEventListener('click', function () { showGame(b.getAttribute('data-game')); });
    });
  }

  window.ccGamesInit = initGames;
})();
