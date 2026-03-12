// ============================================================
//  UTILIDADES - Toast, Loading, Helpers
// ============================================================
var Toast = (function() {
  var container = null;
  function init() {
    if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
  }
  function show(message, type, duration) {
    type = type || 'info'; duration = duration || 4000; init();
    var icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
    var t = document.createElement('div'); t.className = 'toast ' + type;
    t.innerHTML = '<span class="toast-icon">' + (icons[type]||icons.info) + '</span><span class="toast-message">' + message + '</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>';
    container.appendChild(t);
    setTimeout(function() { t.style.opacity='0'; t.style.transform='translateX(100px)'; t.style.transition='all 0.3s'; setTimeout(function(){t.remove();},300); }, duration);
  }
  return { show: show };
})();

var Loading = (function() {
  var ov = null;
  function show(text) {
    text = text || 'Cargando...';
    if (!ov) { ov = document.createElement('div'); ov.className = 'loading-overlay'; ov.innerHTML = '<div class="spinner"></div><span>' + text + '</span>'; document.body.appendChild(ov); }
    else { ov.querySelector('span').textContent = text; ov.style.display = 'flex'; }
  }
  function hide() { if (ov) ov.style.display = 'none'; }
  return { show: show, hide: hide };
})();

var Utils = (function() {
  function formatDate(d) {
    if (!d) return '—';
    try { var dt = new Date(d); return dt.toLocaleDateString('es-GT',{year:'numeric',month:'2-digit',day:'2-digit'}); } catch(e) { return d; }
  }
  function formatDateTime(d) {
    if (!d) return '—';
    try { var dt = new Date(d); return dt.toLocaleDateString('es-GT',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(e) { return d; }
  }
  function estadoBadge(e) {
    var m = {'ABIERTO':'badge-open','EN_PROCESO':'badge-progress','CERRADO':'badge-closed','ESCALADO':'badge-high'};
    return '<span class="badge ' + (m[e]||'badge-open') + '">' + (e||'').replace('_',' ') + '</span>';
  }
  function prioridadBadge(p) {
    var m = {'CRITICA':'badge-critical','ALTA':'badge-high','MEDIA':'badge-medium','BAJA':'badge-low'};
    return '<span class="badge ' + (m[p]||'badge-medium') + '">' + (p||'MEDIA') + '</span>';
  }
  function rolBadge(r) { return '<span class="badge badge-admin">' + (r||'') + '</span>'; }
  function estadoUsuarioBadge(e) { return '<span class="badge ' + (e==='ACTIVO'?'badge-active':'badge-inactive') + '">' + e + '</span>'; }
  function truncate(s, l) { l=l||50; if(!s) return '—'; return s.length>l ? s.substring(0,l)+'...' : s; }
  function escapeHtml(s) { var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
  function getInitials(n, a) { return ((n||'').charAt(0)+(a||'').charAt(0)).toUpperCase() || '??'; }
  function debounce(fn, delay) { var t; delay=delay||300; return function() { var args=arguments; clearTimeout(t); t=setTimeout(function(){fn.apply(null,args);},delay); }; }
  function generateColors(count) {
    var base=['#10069f','#97D700','#3b82f6','#f59e0b','#ef4444','#10b981','#8b5cf6','#ec4899','#14b8a6','#f97316'];
    var c=[]; for(var i=0;i<count;i++) c.push(base[i%base.length]); return c;
  }
  return { formatDate:formatDate, formatDateTime:formatDateTime, estadoBadge:estadoBadge, prioridadBadge:prioridadBadge,
    rolBadge:rolBadge, estadoUsuarioBadge:estadoUsuarioBadge, truncate:truncate, escapeHtml:escapeHtml,
    getInitials:getInitials, debounce:debounce, generateColors:generateColors };
})();
