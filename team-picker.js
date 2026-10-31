/* Open club badge pickers. Native selects remain as a progressive fallback and state source. */
(function () {
  'use strict';
  if (window.ECVTeamPickers) return;
  const selector = 'select#mando-team,select#gc-team,select#vr-team,select#cp-team';
  const badges = new Map(), names = new Map();
  document.querySelectorAll('#teams button').forEach(button => {
    const image = button.querySelector('img');
    if (!image) return;
    const name = button.textContent.trim();
    const value = button.dataset.ecvClubId;
    const source = image.getAttribute('src');
    if (value) badges.set(value, source);
    names.set(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), source);
  });
  const style = document.createElement('style');
  style.textContent = `
select[data-ecv-team-select],label[data-ecv-team-label]{display:none!important}
.ecv-team-picker{box-sizing:border-box;min-width:0;width:100%;flex:1 0 100%;grid-column:1/-1;margin:0 0 18px;padding:0;border:0;color:#f4f7fb}
.ecv-team-picker legend{padding:0;margin-bottom:12px;font-size:14px;font-weight:600;color:#b3c2d6}
.ecv-team-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(86px,1fr));gap:8px;width:100%}
.ecv-team-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;width:100%;min-width:0;min-height:92px;padding:10px 5px;border:1px solid #30415a;border-radius:10px;background:#0b192b;color:#f4f7fb;font:inherit;font-size:11px;line-height:1.3;text-align:center;cursor:pointer}
.ecv-team-button img{display:block;width:36px;height:36px;object-fit:contain}.ecv-team-button span{overflow-wrap:anywhere}.ecv-team-button[aria-pressed="true"]{border:2px solid #e8bd65;background:#293449;padding:9px 4px}.ecv-team-button:hover{border-color:#e8bd65}.ecv-team-button:focus-visible{outline:3px solid #e8bd65;outline-offset:3px}.ecv-team-button:disabled{opacity:.5;cursor:default}
.ecv-team-fallback{display:grid;place-items:center;width:36px;height:36px;border:1px solid #52647d;border-radius:50%;font-size:12px;color:#e8bd65}
@media(max-width:480px){.ecv-team-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.ecv-team-button{min-height:88px}}
`;
  document.head.append(style);
  let pendingFocus = null;
  function enhance() {
    document.querySelectorAll(selector).forEach(select => {
      let group = select._ecvPicker;
      if (!group || !group.isConnected) {
        const label = select.closest('label');
        const title = label ? Array.from(label.childNodes).filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim() : 'Escolha o time';
        group = document.createElement('fieldset');
        group.className = 'ecv-team-picker';
        group.dataset.ecvPickerFor = select.id;
        const legend = document.createElement('legend'); legend.textContent = title || 'Escolha o time';
        const grid = document.createElement('div'); grid.className = 'ecv-team-grid';
        group.append(legend, grid);
        Array.from(select.options).forEach(option => {
          if (!option.value) return;
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'ecv-team-button';
          button.dataset.ecvTeam = option.value;
          button.setAttribute('aria-label', 'Selecionar ' + option.textContent.trim());
          const name = option.textContent.trim();
          const source = badges.get(option.value) || names.get(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
          const fallback = () => {
            const initials = document.createElement('span'); initials.className = 'ecv-team-fallback'; initials.setAttribute('aria-hidden','true');
            initials.textContent = name.split(/\s+/).map(word=>word[0]).slice(0,3).join(''); return initials;
          };
          if (source) {
            const image = document.createElement('img'); image.src = source; image.alt = ''; image.loading = 'lazy';
            image.addEventListener('error', () => image.replaceWith(fallback()), {once:true}); button.append(image);
          } else button.append(fallback());
          const text = document.createElement('span'); text.textContent = name; button.append(text);
          button.addEventListener('click', () => {
            if (select.disabled) return;
            pendingFocus = document.activeElement === button ? {id:select.id,value:option.value} : null;
            select.value = option.value;
            // Existing tool handlers keep all calculations, filters and reset rules intact.
            select.dispatchEvent(new Event('change', {bubbles:true}));
            enhance();
          });
          grid.append(button);
        });
        // Hide the old control only after the replacement is ready.
        if (label) {label.after(group); label.dataset.ecvTeamLabel = ''; label.hidden = true;}
        else select.after(group);
        select.dataset.ecvTeamSelect = ''; select.hidden = true; select._ecvPicker = group;
      }
      group.disabled = select.disabled;
      group.querySelectorAll('button[data-ecv-team]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.ecvTeam === select.value)));
    });
    if (pendingFocus) {
      const select = document.getElementById(pendingFocus.id);
      const button = select?._ecvPicker?.querySelector('button[data-ecv-team="' + pendingFocus.value + '"]');
      pendingFocus = null;
      button?.focus({preventScroll:true});
    }
  }
  window.ECVTeamPickers = {refresh:enhance};
  enhance();
  // Goal clock, reactions and period comparison replace their entire contents on each selection.
  const observer = new MutationObserver(enhance);
  observer.observe(document.body, {childList:true,subtree:true});
})();
