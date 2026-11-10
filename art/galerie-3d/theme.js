/* Theme de la galerie publique, sans modifier les oeuvres ni leur eclairage. */
(function () {
  'use strict';
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  if (params.has('capture') || params.has('carte') || params.has('embed')) return;
  var key = 'deligny-galerie-theme';
  var theme = 'clair';
  try { if (localStorage.getItem(key) === 'sombre') theme = 'sombre'; } catch (_) {}
  root.dataset.theme = theme;
  var style = document.createElement('style');
  style.textContent = `
    html[data-theme="clair"] { color-scheme:light; --bg:#f5f2ea; --panel:#fffdf8; --line:#d4cec0;
      --ink:#25231e; --dim:#686052; --accent:#805e27; --ok:#426d36; }
    html[data-theme="clair"] #scene { background:radial-gradient(ellipse at 50% 30%,#fffefa,var(--bg) 70%); }
    .galerie-theme { display:flex; gap:4px; width:fit-content; padding:3px; border:1px solid var(--line);
      border-radius:7px; background:var(--panel); }
    .galerie-theme button { border:1px solid transparent; border-radius:4px; padding:7px 12px;
      font:500 11px "Helvetica Neue",Arial,sans-serif; letter-spacing:.04em; color:var(--dim);
      background:transparent; cursor:pointer; min-height:32px; }
    .galerie-theme button[aria-pressed="true"] { color:var(--ink); border-color:var(--accent); background:var(--bg); }
    .galerie-theme button:hover { color:var(--ink); }
    .galerie-theme button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  `;
  document.head.appendChild(style);
  function mount() {
    var host = document.querySelector('.marque-col') || document.querySelector('header');
    if (!host) return;
    var group = document.createElement('div');
    group.className = 'galerie-theme';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Apparence de la galerie');
    ['clair', 'sombre'].forEach(function (value) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = value === 'clair' ? 'Clair' : 'Sombre';
      b.setAttribute('aria-pressed', String(theme === value));
      b.addEventListener('click', function () {
        theme = value;
        root.dataset.theme = theme;
        group.querySelectorAll('button').forEach(function (button) {
          button.setAttribute('aria-pressed', String(button === b));
        });
        try { localStorage.setItem(key, theme); } catch (_) {}
      });
      group.appendChild(b);
    });
    host.appendChild(group);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
