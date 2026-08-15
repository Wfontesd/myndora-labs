(() => {
  'use strict';
  const BUILD = '20260815-10';
  const ROUTES = { board:'#/projects', mine:'#/me', activity:'#/activity' };
  let proxy = null;
  let layer = null;
  let lastFocused = null;
  let mutationObserver = null;
  let routeSyncing = false;

  const escapeHtml = (value='') => String(value).replace(/[&<>\"]/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[character]));
  const initials = (name='') => name.trim().split(/\s+/).map((part) => part[0] || '').join('').slice(0,2).toUpperCase();
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

  function getProxy() {
    const root = document.querySelector('#app');
    return root?._vnode?.component?.proxy || root?.__vue_app__?._instance?.proxy || root?.__vueParentComponent?.proxy || null;
  }

  function revealEverything(root=document) {
    root.querySelectorAll?.('.reveal').forEach((element) => element.classList.add('is-visible'));
  }

  function installRevealSafety() {
    revealEverything();
    const main = document.querySelector('main') || document.body;
    mutationObserver?.disconnect();
    mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches?.('.reveal')) node.classList.add('is-visible');
          revealEverything(node);
        });
      }
      requestAnimationFrame(() => revealEverything());
    });
    mutationObserver.observe(main, { childList:true, subtree:true });
  }

  function routeFromHash(hash) {
    const clean = (hash || '').split('?')[0];
    if (clean === '#/me') return 'mine';
    if (clean === '#/activity') return 'activity';
    return 'board';
  }

  function setRoute(view, replace=false) {
    const hash = ROUTES[view] || ROUTES.board;
    if (location.hash === hash) return;
    routeSyncing = true;
    if (replace) history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    else history.pushState(null, '', `${location.pathname}${location.search}${hash}`);
    queueMicrotask(() => { routeSyncing = false; });
  }

  function applyRoute(hash, replace=false) {
    if (!proxy) return;
    const view = routeFromHash(hash);
    if (proxy.currentView !== view) proxy.currentView = view;
    proxy.userMenuOpen = false;
    requestAnimationFrame(() => {
      revealEverything();
      if (replace) setRoute(view, true);
    });
  }

  function installRouting() {
    const initialHash = window.__BLOOM_REQUESTED_HASH__ || location.hash || '#/projects';
    applyRoute(initialHash, true);

    const originalGoTo = typeof proxy.goTo === 'function' ? proxy.goTo.bind(proxy) : null;
    if (originalGoTo) {
      proxy.goTo = (view) => {
        originalGoTo(view);
        setRoute(view);
        setTimeout(revealEverything, 0);
        setTimeout(revealEverything, 260);
      };
    }

    addEventListener('popstate', () => { if (!routeSyncing) applyRoute(location.hash); });
    addEventListener('hashchange', () => { if (!routeSyncing) applyRoute(location.hash); });
  }

  function closeProfile() {
    if (!layer) return;
    layer.hidden = true;
    document.body.classList.remove('bloom-profile-open');
    lastFocused?.focus?.({ preventScroll:true });
  }

  function currentUser() {
    return proxy?.currentUser || proxy?.users?.find?.((user) => user.id === proxy.currentUserId) || proxy?.users?.[0] || {};
  }

  function profileMarkup() {
    const user = currentUser();
    const users = Array.isArray(proxy?.users) ? proxy.users : [];
    const userButtons = users.map((item) => {
      const active = item.id === user.id;
      const style = `--avatar-bg:${escapeHtml(item.avatarBg || '#ddd')};--avatar-ink:${escapeHtml(item.avatarInk || '#222')}`;
      return `<button class="bloom-profile-user${active ? ' is-active' : ''}" type="button" data-profile-user="${escapeHtml(item.id)}">
        <span class="avatar avatar--sm" style="${style}">${escapeHtml(initials(item.name))}</span>
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.role || '')}</small></span>
        <span class="bloom-profile-user__role">${item.globalRole === 'ADMIN' ? 'Admin' : active ? 'Actif' : 'Membre'}</span>
      </button>`;
    }).join('');
    const avatarStyle = `--avatar-bg:${escapeHtml(user.avatarBg || '#ddd')};--avatar-ink:${escapeHtml(user.avatarInk || '#222')}`;
    return `<section class="bloom-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="bloom-profile-title">
      <div class="bloom-profile-grab" aria-hidden="true"></div>
      <header class="bloom-profile-head">
        <span class="avatar" style="${avatarStyle}">${escapeHtml(initials(user.name))}</span>
        <span><strong id="bloom-profile-title">${escapeHtml(user.name || 'Profil')}</strong><small>${escapeHtml(user.role || '')}${user.globalRole === 'ADMIN' ? ' · Administrateur' : ' · Démonstration'}</small></span>
        <button class="bloom-profile-close" type="button" aria-label="Fermer">${icon('x')}</button>
      </header>
      <span class="bloom-profile-kicker">Changer de profil pour tester les droits</span>
      <div class="bloom-profile-users">${userButtons}</div>
      <div class="bloom-profile-actions">
        <button class="bloom-profile-action" type="button" data-profile-action="mine"><span>${icon('leaf')}</span><div><strong>Voir mon espace</strong><small>Mes idées et mes participations</small></div>${icon('arrow-up-right')}</button>
        <button class="bloom-profile-action" type="button" data-profile-action="onboarding"><span>${icon('play')}</span><div><strong>Revoir l’onboarding</strong><small>Relancer la présentation du produit</small></div>${icon('arrow-up-right')}</button>
        <button class="bloom-profile-action" type="button" data-profile-action="reset"><span>${icon('rotate')}</span><div><strong>Réinitialiser la démo</strong><small>Restaurer les projets d’origine</small></div>${icon('arrow-up-right')}</button>
      </div>
    </section>`;
  }

  function renderProfile() {
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'bloom-profile-layer';
      layer.hidden = true;
      document.body.appendChild(layer);
      layer.addEventListener('click', (event) => {
        if (event.target === layer || event.target.closest('.bloom-profile-close')) { closeProfile(); return; }
        const userButton = event.target.closest('[data-profile-user]');
        if (userButton) {
          proxy?.switchUser?.(userButton.dataset.profileUser);
          setTimeout(() => { layer.innerHTML = profileMarkup(); layer.querySelector('.bloom-profile-close')?.focus(); }, 0);
          return;
        }
        const action = event.target.closest('[data-profile-action]')?.dataset.profileAction;
        if (action === 'mine') { closeProfile(); proxy?.goTo?.('mine'); return; }
        if (action === 'onboarding') { closeProfile(); proxy?.openOnboarding?.(true); return; }
        if (action === 'reset') { closeProfile(); proxy?.resetDemo?.(); }
      });
    }
    layer.innerHTML = profileMarkup();
  }

  function openProfile(trigger) {
    if (!proxy) return;
    proxy.userMenuOpen = false;
    lastFocused = trigger || document.activeElement;
    renderProfile();
    layer.hidden = false;
    document.body.classList.add('bloom-profile-open');
    requestAnimationFrame(() => layer.querySelector('.bloom-profile-close')?.focus());
  }

  function installProfileTriggers() {
    document.addEventListener('click', (event) => {
      const desktopTrigger = event.target.closest('.profile-button');
      const mobileButtons = [...document.querySelectorAll('.mobile-nav button')];
      const mobileTrigger = event.target.closest('.mobile-nav button');
      const isMobileProfile = mobileTrigger && mobileButtons.indexOf(mobileTrigger) === mobileButtons.length - 1;
      if (!desktopTrigger && !isMobileProfile) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openProfile(desktopTrigger || mobileTrigger);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && layer && !layer.hidden) { event.preventDefault(); closeProfile(); }
      if (event.key === 'Tab' && layer && !layer.hidden) {
        const focusables = [...layer.querySelectorAll('button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }

  function installNavigationFallback() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('.desktop-nav button,.mobile-nav button');
      if (!button || button.classList.contains('mobile-nav__create')) return;
      const text = button.textContent.trim().toLocaleLowerCase('fr');
      if (text.includes('explorer')) setTimeout(() => setRoute('board'), 0);
      else if (text.includes('mon espace')) setTimeout(() => setRoute('mine'), 0);
      else if (text.includes('activité')) setTimeout(() => setRoute('activity'), 0);
      setTimeout(revealEverything, 30);
      setTimeout(revealEverything, 320);
    }, true);
  }

  function boot() {
    proxy = getProxy();
    if (!proxy) { setTimeout(boot, 50); return; }
    document.documentElement.dataset.bloomHotfix = BUILD;
    installRevealSafety();
    installRouting();
    installProfileTriggers();
    installNavigationFallback();
    setTimeout(revealEverything, 120);
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
