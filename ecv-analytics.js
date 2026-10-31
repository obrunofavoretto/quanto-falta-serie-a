/* ECV analytics v1. No free text, user identifiers or automatic selections. */
(function () {
  'use strict';
  if (window.ECVAnalytics) return;
  const ID = 'G-3X2SF5L8FV';
  const leagues = {'calculadora-45-pontos':'brasileirao','quanto-falta-brasileirao':'brasileirao','quanto-falta-premier-league':'premier_league','quanto-falta-la-liga':'la_liga','quanto-falta-serie-a':'serie_a','quanto-falta-bundesliga':'bundesliga','quanto-falta-ligue-1':'ligue_1'};
  const project = location.pathname.split('/').filter(Boolean)[0];
  const league = leagues[project];
  if (!league) return;
  const pageTools = {'projetor.html':'projetor','raio-x.html':'raio-x','termometro.html':'termometro'};
  const pageTool = pageTools[location.pathname.split('/').pop()] || null;
  // Embedded documents share the parent's tag and session; never add a second page_view.
  if (parent !== window) {
    try { if (parent.ECVAnalytics) parent.ECVAnalytics.attach(document, pageTool); } catch (_) {}
    return;
  }
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID);
    const script = document.createElement('script'); script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.append(script);
  }
  const used = new Set(), attached = new WeakSet(), seen = new Set();
  const validTools = new Set(['quanto-falta','mudancas','rankings-gols','casa-fora','relogio-dos-gols','viradas-e-reacoes','antes-e-depois','projetor','raio-x','termometro']);
  const debug = new URLSearchParams(location.search).get('ecv_debug') === '1';
  function send(name, tool, extra) {
    if (!validTools.has(tool)) return;
    try { window.gtag('event', name, Object.assign({send_to:ID,ecv_league:league,ecv_tool:tool,ecv_project:project,transport_type:'beacon'}, debug ? {debug_mode:true} : {}, extra || {})); } catch (_) {}
  }
  function use(tool) { if (!used.has(tool)) { used.add(tool); send('ecv_use_tool',tool); } }
  function text(el) { return (el?.textContent || '').trim().slice(0,80); }
  function teamName(doc, tool) {
    const ids = {'quanto-falta':'selection','projetor':'team','casa-fora':'mando-team','relogio-dos-gols':'gc-team','viradas-e-reacoes':'vr-team','antes-e-depois':'cp-team','termometro':'detail'};
    const el = doc.getElementById(ids[tool]);
    if (el?.tagName === 'SELECT') return text(el.selectedOptions[0]);
    if (tool === 'termometro') return text(doc.querySelector('#teams [aria-pressed="true"]'));
    return el ? text(el) : '';
  }
  function attach(doc, fixedTool) {
    if (attached.has(doc)) return;
    attached.add(doc);
    let simulationTimer, lastSimulation = '';
    function context(el) { return fixedTool || el.closest('section[id]')?.id || 'quanto-falta'; }
    function interaction(event) {
      if (!event.isTrusted) return;
      const target = event.target;
      if (!target?.closest) return;
      const button = target.closest('button,a,summary');
      const tool = context(target);
      if (event.type === 'click') {
        const link = target.closest('a');
        if (link) {
          const url = new URL(link.href, location.href);
          if (url.hostname === 'esportecomvalor.wordpress.com') { send('ecv_click_blog',tool); return; }
          if (url.origin === location.origin && validTools.has(url.hash.slice(1))) { send('ecv_navigate_tool',url.hash.slice(1)); return; }
          return;
        }
        if (!button || !validTools.has(tool)) return;
        if (button.tagName === 'SUMMARY') { if (!button.parentElement.open) send('ecv_expand_help',tool); return; }
        const isTeam = button.matches('#teams button,[data-vr-team],[data-club],[data-team],#ranking [data-id]');
        if (isTeam) {
          // Capture the known club label before a synchronous re-render removes this button.
          const name = text(button) || (button.getAttribute('aria-label') || '').replace(/^(Selecionar |Ver jogos de )/,'');
          use(tool); send('ecv_select_team',tool,{ecv_team:name}); return;
        }
        const mode = button.dataset.mode;
        if (mode && ['season','5','10'].includes(mode)) { use(tool); send('ecv_filter_change',tool,{ecv_control:'recorte',ecv_option:mode,ecv_team:teamName(doc,tool)}); return; }
        if (['manual','reset','restore','clear','compare','refresh','gc-refresh','vr-refresh','cp-refresh'].includes(button.id)) {
          use(tool);
          send(button.id.includes('refresh') ? 'ecv_refresh_data' : 'ecv_action',tool,{ecv_control:button.id,ecv_team:teamName(doc,tool)});
        }
        return;
      }
      const id = target.id;
      if ((tool === 'quanto-falta' || tool === 'projetor') && (['points','played','target','total'].includes(id) || /^g\d$/.test(id))) {
        if (event.type !== 'input') return;
        clearTimeout(simulationTimer);
        simulationTimer = setTimeout(function () {
          const fields = ['points','played','target','total'].map(k=>doc.getElementById(k));
          if (fields.some(el=>!el || el.value === '' || !el.checkValidity())) return;
          const [p,j,t,n] = fields.map(el=>Number(el.value));
          if (![p,j,t,n].every(Number.isInteger) || p<0 || j<0 || t<1 || n<1 || n>1000 || j>n || p>3*j) return;
          if (doc.getElementById('error')?.textContent.trim()) return;
          const signature = JSON.stringify([p,j,t,n,...Array.from(doc.querySelectorAll('#games select')).map(el=>el.value)]);
          if (signature === lastSimulation) return;
          lastSimulation = signature; use(tool);
          send('ecv_simulate',tool,{ecv_team:teamName(doc,tool),ecv_control:id,ecv_target_points:t,ecv_current_points:p,ecv_played:j,ecv_remaining:n-j});
        }, 1000);
        return;
      }
      if (event.type !== 'change') return;
      if (['team','mando-team','gc-team','vr-team','cp-team'].includes(id)) {
        use(tool); send('ecv_select_team',tool,{ecv_team:text(target.selectedOptions[0])}); return;
      }
      if (['gc-venue','vr-venue','vr-metric','cp-venue','cp-limit','cp-cut','count','filter','sort','manualMode'].includes(id)) {
        use(tool);
        // Match ids are intentionally grouped; no per-match high-cardinality dimension.
        const option = id === 'cp-cut' ? (target.value ? 'marco_selecionado' : 'sem_marco') : target.type === 'checkbox' ? String(target.checked) : target.value;
        send('ecv_filter_change',tool,{ecv_control:id,ecv_option:option,ecv_team:teamName(doc,tool)});
      }
    }
    ['click','input','change'].forEach(type=>doc.addEventListener(type,interaction,true));
  }
  window.ECVAnalytics = {attach:attach,version:'1.0.0'};
  attach(document,pageTool);
  if (!pageTool) document.querySelectorAll('iframe').forEach(frame=>{
    const tool = frame.closest('section[id]')?.id;
    const connect = ()=>{try {if (frame.contentDocument?.readyState === 'complete') attach(frame.contentDocument,tool);} catch (_) {}};
    frame.addEventListener('load',connect); connect();
  });
  // Observe only the top document. A section must expose >=200px (or half its height)
  // for two continuous visible seconds. Returning to the section does not count again.
  const pending = new Map();
  const sections = pageTool ? [[document.querySelector('main'),pageTool]] : Array.from(validTools).map(tool=>[document.getElementById(tool),tool]);
  function checkViews() {
    sections.forEach(([el,tool])=>{
      if (!el || seen.has(tool)) return;
      const r=el.getBoundingClientRect(), visible=Math.min(r.bottom,innerHeight)-Math.max(r.top,0);
      const qualifies = document.visibilityState === 'visible' && visible >= Math.min(200,r.height/2) && r.height>0;
      if (!qualifies) {clearTimeout(pending.get(tool));pending.delete(tool);return;}
      if (!pending.has(tool)) pending.set(tool,setTimeout(()=>{pending.delete(tool);seen.add(tool);send('ecv_view_tool',tool);},2000));
    });
  }
  window.addEventListener('scroll',checkViews,{passive:true}); window.addEventListener('resize',checkViews);
  document.addEventListener('visibilitychange',checkViews);
  if (window.ResizeObserver) {const observer=new ResizeObserver(checkViews);sections.forEach(([el])=>{if(el)observer.observe(el);});}
  checkViews();
})();
