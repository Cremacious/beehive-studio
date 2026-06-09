/* Generation-time helper (not linked by any page). Defines ICON, NAV, frame(). */
var ICON = {
  dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  list: '<line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  wiki: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  chat: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  filepen: '<path d="M12.5 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v3"/><path d="M14 2v6h6"/><path d="M21.4 13.6a2 2 0 0 0-2.8 0l-4.6 4.6L13 22l3.8-1 4.6-4.6a2 2 0 0 0 0-2.8z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  mega: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  kebab: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  hex: '<path d="M12 2 21 7v10l-9 5-9-5V7Z" fill="currentColor" fill-opacity="0.18"/><path d="M12 7 17 10v4l-5 3-5-3v-4Z" fill="currentColor" fill-opacity="0.35"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};

function svg(name, sw){ sw = sw || 1.9; return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round">'+ICON[name]+'</svg>'; }

var HIVE_NAME = 'The Apiary Collective';

var NAV = [
  { seg: '', label: 'Dashboard', icon: 'dashboard', file: '01-dashboard.html' },
  { seg: '/outline', label: 'Outline', icon: 'list', file: '02-outline-index.html' },
  { seg: '/chapters', label: 'Chapters', icon: 'book', file: '06-chapters-index.html' },
  { seg: '/wiki', label: 'Wiki', icon: 'wiki', file: '04-wiki-shell.html' },
  { seg: '/discussions', label: 'Discussions', icon: 'chat', file: '08-discussions-list.html' },
  { seg: '/submissions', label: 'Submit Chapter', icon: 'send', file: '10-submissions-list.html' },
  { seg: '/suggestions', label: 'Edit Suggestions', icon: 'filepen', file: '14-suggestions.html' },
  { seg: '/word-goals', label: 'Word Goals', icon: 'target', file: '15-word-goals.html' },
  { seg: '/buzz', label: 'Buzz Board', icon: 'mega', file: '16-buzz.html' },
  { seg: '/members', label: 'Members', icon: 'users', file: '17-members.html' },
  { seg: '/settings', label: 'Settings', icon: 'settings', file: '18-settings.html' },
];

function sidebar(active){
  var items = NAV.map(function(n){
    var on = n.seg === active;
    var badge = (n.seg === '/word-goals')
      ? '\n        <div class="nav-badge"><span style="width:58%"></span></div>'
      : '';
    return '      <a class="nav-item'+(on?' active':'')+'" href="'+n.file+'">\n'
         + '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+ICON[n.icon]+'</svg>\n'
         + '        <span>'+n.label+'</span>\n'
         + '      </a>' + badge;
  }).join('\n');
  return '  <aside class="hive-sidebar">\n'
       + '    <div class="sb-head"><h2>'+HIVE_NAME+'</h2></div>\n'
       + '    <nav>\n'+items+'\n    </nav>\n'
       + '  </aside>';
}

/* cfg: { width:'standard'|'wide', title, subtitle, back:{href,label}|null, slot:html } */
function frame(active, cfg, body){
  var back = cfg.back
    ? '      <a class="back-link" href="'+cfg.back.href+'">'+svg('arrowLeft',2)+' Back to '+cfg.back.label+'</a>\n'
    : '';
  var sub = cfg.subtitle ? '\n          <p class="subtitle">'+cfg.subtitle+'</p>' : '';
  var slot = cfg.slot ? '\n        <div class="head-slot">'+cfg.slot+'</div>' : '';
  return '<!doctype html>\n<html lang="en">\n<head>\n'
    + '<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n'
    + '<title>'+cfg.title+' — '+HIVE_NAME+' · Beehive Studio</title>\n'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    + '<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;500;600;700&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">\n'
    + '<link rel="stylesheet" href="hive.css">\n'
    + '</head>\n<body>\n\n'
    + '<header class="app-topbar">\n'
    + '  <a class="brand-mark" href="index.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">'+ICON.hex+'</svg> Beehive</a>\n'
    + '  <span class="top-spacer"></span>\n'
    + '  <span class="top-crumb">Hive · '+HIVE_NAME+'</span>\n'
    + '  <span class="top-avatar">YO</span>\n'
    + '</header>\n\n'
    + '<div class="app-shell">\n'
    + sidebar(active) + '\n\n'
    + '  <main class="app-main">\n'
    + '    <div class="shell-wrap '+cfg.width+'" data-screen-label="'+cfg.title+'">\n'
    + back
    + '      <section class="panel">\n'
    + '        <header class="panel-head">\n'
    + '          <div class="ph-text">\n'
    + '            <h1>'+cfg.title+'</h1>'+sub+'\n'
    + '          </div>'+slot+'\n'
    + '        </header>\n'
    + body + '\n'
    + '      </section>\n'
    + '    </div>\n'
    + '  </main>\n'
    + '</div>\n\n'
    + '</body>\n</html>\n';
}

/* helpers for bodies */
function pill(token, label){ return '<span class="pill" style="--pill-accent: var('+token+')">'+label+'</span>'; }
globalThis.ICON = ICON; globalThis.svg = svg; globalThis.NAV = NAV; globalThis.frame = frame;
globalThis.pill = pill; globalThis.HIVE_NAME = HIVE_NAME; globalThis.sidebar = sidebar;
