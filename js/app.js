// ============================================================
//  APP.JS v2 - Sistema Municipal de Incidentes
//  Permisos dinámicos, enfoque servicio al ciudadano
// ============================================================
var App = (function() {
  var catalogosCache = null;
  var rolesCache = null;
  var chartInstances = {};

  function log(msg) { console.log('[APP] ' + msg); }

  // ==================== INIT ====================
  async function init() {
    log('Iniciando sistema municipal v2...');
    try {
      Router.register('login', renderLogin);
      Router.register('dashboard', renderDashboard);
      Router.register('incidentes', renderIncidentes);
      Router.register('nuevo-incidente', renderNuevoIncidente);
      Router.register('usuarios', renderUsuarios);
      Router.register('roles', renderRoles);
      Router.register('catalogos', renderCatalogos);
      Router.register('reportes', renderReportes);
      Router.init();
    } catch (err) {
      console.error('Error fatal:', err);
      renderLogin();
    }
  }

  // ==================== SIDEBAR (permission-based) ====================
  function renderAppLayout(content, activeRoute) {
    var user = API.getUser();
    var appEl = document.getElementById('app');
    if (!appEl) return;

    var navItems = '';
    // Siempre visible: incidentes
    navItems += '<div class="nav-section-label">Atención Ciudadana</div>';
    if (API.hasPermission('ver_dashboard'))
      navItems += navBtn('dashboard', '📊', 'Dashboard', activeRoute);
    navItems += navBtn('incidentes', '📋', 'Incidentes', activeRoute);
    if (API.hasPermission('crear_incidentes'))
      navItems += navBtn('nuevo-incidente', '➕', 'Nuevo Incidente', activeRoute);
    if (API.hasPermission('ver_reportes'))
      navItems += navBtn('reportes', '📈', 'Reportes', activeRoute);

    // Admin section
    if (API.hasAnyPermission(['gestionar_usuarios', 'gestionar_roles', 'gestionar_catalogos'])) {
      navItems += '<div class="nav-section-label">Administración</div>';
      if (API.hasPermission('gestionar_usuarios'))
        navItems += navBtn('usuarios', '👥', 'Usuarios', activeRoute);
      if (API.hasPermission('gestionar_roles'))
        navItems += navBtn('roles', '🔐', 'Roles y Permisos', activeRoute);
      if (API.hasPermission('gestionar_catalogos'))
        navItems += navBtn('catalogos', '⚙️', 'Catálogos', activeRoute);
    }

    appEl.innerHTML =
      '<div class="app-layout">' +
        '<aside class="sidebar" id="sidebar">' +
          '<div class="sidebar-header">' +
            '<img src="assets/ESCUDO_MUNI.png" alt="Logo" onerror="this.style.display=\'none\'">' +
            '<div class="brand-text"><h2>Dirección de Atención al Vecino</h2><span>Gestión de Incidentes</span></div>' +
          '</div>' +
          '<nav class="sidebar-nav">' + navItems + '</nav>' +
          '<div class="sidebar-footer">' +
            '<div class="user-info-mini" onclick="API.logout()">' +
              '<div class="user-avatar">' + Utils.getInitials(user && user.nombre, user && user.apellido) + '</div>' +
              '<div class="user-details">' +
                '<div class="user-name">' + esc(gv(user,'nombre')) + ' ' + esc(gv(user,'apellido')) + '</div>' +
                '<div class="user-role">' + esc(gv(user,'rolNombre')) + '</div>' +
              '</div>' +
              '<span style="color:rgba(255,255,255,0.4);font-size:18px" title="Cerrar Sesión">⏻</span>' +
            '</div>' +
          '</div>' +
        '</aside>' +
        '<main class="main-content">' +
          '<header class="top-header">' +
            '<button class="mobile-menu-btn" onclick="document.getElementById(\'sidebar\').classList.toggle(\'open\')">☰</button>' +
            '<div class="header-search"><span class="search-icon">🔍</span>' +
              '<input type="text" placeholder="Buscar por ticket, nombre, DPI..." id="globalSearch" onkeydown="if(event.key===\'Enter\')App.globalSearch(this.value)"></div>' +
            '<div class="header-actions">' +
              (API.hasPermission('crear_incidentes') ? '<button class="btn btn-accent btn-sm" onclick="Router.navigate(\'nuevo-incidente\')">➕ Nuevo</button>' : '') +
            '</div>' +
          '</header>' +
          '<div class="page-content" id="pageContent">' + content + '</div>' +
        '</main>' +
      '</div>';
  }

  function navBtn(route, icon, label, active) {
    return '<button class="nav-item ' + (active === route ? 'active' : '') + '" data-route="' + route + '" onclick="Router.navigate(\'' + route + '\')">' +
      '<span class="nav-icon">' + icon + '</span> ' + label + '</button>';
  }

  // Shorthand helpers
  function esc(s) { return Utils.escapeHtml(s); }
  function gv(obj, key) { return (obj && obj[key]) || ''; }

  // ==================== LOGIN ====================
  function renderLogin() {
    log('Renderizando Login');
    document.getElementById('app').innerHTML =
      '<div class="login-container">' +
        '<div class="login-card">' +
          '<div class="login-logo">' +
            '<img src="assets/ESCUDO_MUNI.png" alt="Logo" onerror="this.style.display=\'none\'">' +
            '<h1>Municipalidad de Guatemala</h1>' +
            '<p>Sistema de Gestión de Incidentes DAV</p>' +
          '</div>' +
          '<div class="login-tabs">' +
            '<button class="login-tab active" onclick="App.switchLoginTab(\'credentials\',this)">Usuario / Contraseña</button>' +
            '<button class="login-tab" onclick="App.switchLoginTab(\'google\',this)">Google</button>' +
          '</div>' +
          '<div id="loginCredentials">' +
            '<div class="form-group"><label>Usuario</label>' +
              '<div class="input-icon-wrapper"><span class="input-icon">👤</span>' +
              '<input type="text" class="form-control" id="loginUsername" placeholder="Tu usuario" onkeydown="if(event.key===\'Enter\')document.getElementById(\'loginPassword\').focus()"></div></div>' +
            '<div class="form-group"><label>Contraseña</label>' +
              '<div class="input-icon-wrapper"><span class="input-icon">🔒</span>' +
              '<div class="password-wrapper" style="flex:1">' +
              '<input type="password" class="form-control" id="loginPassword" placeholder="Tu contraseña" style="padding-left:42px" onkeydown="if(event.key===\'Enter\')App.doLogin()">' +
              '<button type="button" class="password-toggle" onclick="App.togglePassword()" id="btnTogglePwd" title="Ver contraseña">👁️</button>' +
              '</div></div></div>' +
            '<button class="btn btn-primary btn-block btn-lg" onclick="App.doLogin()" id="btnLogin">Iniciar Sesión</button>' +
          '</div>' +
          '<div id="loginGoogle" style="display:none">' +
            '<p style="text-align:center;color:var(--text-secondary);font-size:13px;margin-bottom:20px">Usa tu cuenta institucional de Google</p>' +
            '<button class="btn btn-google btn-block btn-lg" onclick="App.doGoogleLogin()">' +
              '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G"> Continuar con Google</button>' +
          '</div>' +
          '<div id="loginError" style="display:none;margin-top:16px;padding:12px;background:rgba(239,68,68,0.08);border-radius:8px;color:#dc2626;font-size:13px;text-align:center"></div>' +
        '</div>' +
      '</div>';
  }

  function switchLoginTab(tab, btn) {
    document.querySelectorAll('.login-tab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('loginCredentials').style.display = tab === 'credentials' ? 'block' : 'none';
    document.getElementById('loginGoogle').style.display = tab === 'google' ? 'block' : 'none';
    var err = document.getElementById('loginError'); if (err) err.style.display = 'none';
  }

  function togglePassword() {
    var pwd = document.getElementById('loginPassword');
    var btn = document.getElementById('btnTogglePwd');
    if (!pwd || !btn) return;
    if (pwd.type === 'password') {
      pwd.type = 'text';
      btn.textContent = '🔒';
      btn.title = 'Ocultar contraseña';
    } else {
      pwd.type = 'password';
      btn.textContent = '👁️';
      btn.title = 'Ver contraseña';
    }
  }

  async function doLogin() {
    var u = document.getElementById('loginUsername'), p = document.getElementById('loginPassword');
    if (!u || !p || !u.value.trim() || !p.value) { showLoginError('Completa todos los campos'); return; }
    var btn = document.getElementById('btnLogin');
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
    try {
      var res = await API.login(u.value.trim(), p.value);
      if (btn) { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
      if (res.success) {
        Toast.show('¡Bienvenido, ' + res.data.user.nombre + '!', 'success');
        // Navegar al primer módulo que tenga permiso
        if (res.data.user.permisos.indexOf('ver_dashboard') !== -1) Router.navigate('dashboard');
        else Router.navigate('incidentes');
      } else { showLoginError(res.error || 'Error'); }
    } catch(e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
      showLoginError('Error de conexión');
    }
  }

  async function doGoogleLogin() {
    var email = prompt('Email institucional registrado:');
    if (!email) return;
    Loading.show('Verificando...');
    try {
      var res = await API.loginWithGoogle({ email: email });
      Loading.hide();
      if (res.success) { Toast.show('¡Bienvenido!', 'success'); Router.navigate('dashboard'); }
      else { showLoginError(res.error); }
    } catch(e) { Loading.hide(); showLoginError('Error de conexión'); }
  }

  function showLoginError(msg) {
    var el = document.getElementById('loginError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  // ==================== DASHBOARD ====================
  async function renderDashboard() {
    if (!API.hasPermission('ver_dashboard')) { Router.navigate('incidentes'); return; }
    renderAppLayout('<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>', 'dashboard');
    try {
      var res = await API.getDashboardData();
      var pc = document.getElementById('pageContent');
      if (!pc) return;
      if (!res.success) { pc.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error</h3><p>' + (res.error||'') + '</p><button class="btn btn-primary" onclick="App.renderDashboard()" style="margin-top:16px">🔄 Reintentar</button></div>'; return; }

      var d = res.data;
      pc.innerHTML =
        '<div class="page-title-bar"><div><h1>Dashboard Municipal</h1><div class="subtitle">Resumen de atención ciudadana</div></div>' +
        '<button class="btn btn-outline btn-sm" onclick="App.renderDashboard()">🔄 Actualizar</button></div>' +
        '<div class="stats-grid">' +
          statCard('primary', '📋', d.total, 'Total Incidentes') +
          statCard('info', '📂', d.abiertos, 'Abiertos') +
          statCard('warning', '⏳', d.enProceso, 'En Proceso') +
          statCard('success', '✅', d.cerrados, 'Cerrados') +
          statCard('danger', '🚨', d.escalados, 'Escalados') +
        '</div>' +
        '<div class="charts-grid">' +
          chartCard('chartSede', 'Incidentes por Sede') +
          chartCard('chartEstado', 'Por Estado') +
          chartCard('chartTipo', 'Por Tipo de Incidente') +
          chartCard('chartTendencia', 'Tendencia (30 días)') +
        '</div>' +
        '<div class="card"><div class="card-header"><h3>Últimos Incidentes</h3>' +
          '<button class="btn btn-ghost btn-sm" onclick="Router.navigate(\'incidentes\')">Ver todos →</button></div>' +
          '<div class="card-body" style="padding:0"><div class="table-wrapper"><table><thead><tr>' +
            '<th>Ticket</th><th>Ciudadano</th><th>Tipo</th><th>Sede</th><th>Estado</th><th>Canal</th><th>Fecha</th></tr></thead><tbody>' +
          buildUltimos(d.ultimos) + '</tbody></table></div></div></div>';

      renderCharts(d);
    } catch(e) { console.error('Dashboard error:', e); }
  }

  function statCard(cls, icon, val, label) {
    return '<div class="stat-card ' + cls + '"><div class="stat-icon">' + icon + '</div><div class="stat-info"><div class="stat-value">' + (val||0) + '</div><div class="stat-label">' + label + '</div></div></div>';
  }
  function chartCard(id, title) {
    return '<div class="card"><div class="card-header"><h3>' + title + '</h3></div><div class="card-body"><div class="chart-container"><canvas id="' + id + '"></canvas></div></div></div>';
  }
  function buildUltimos(items) {
    if (!items || !items.length) return '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">Sin incidentes</td></tr>';
    return items.map(function(i) {
      return '<tr style="cursor:pointer" onclick="App.viewIncidente(\'' + i.ID_INCIDENCIA + '\')">' +
        '<td><strong>' + esc(i.NO_TICKET||'') + '</strong></td>' +
        '<td>' + esc(i.NOMBRE_AFECTADO||'') + ' ' + esc(i.APELLIDO_AFECTADO||'') + '</td>' +
        '<td>' + esc(i.TIPO_INCIDENCIA||'') + '</td>' +
        '<td>' + esc(i.SEDE||'') + '</td>' +
        '<td>' + Utils.estadoBadge(i.ESTADO) + '</td>' +
        '<td>' + esc(i.CANAL_RECEPCION||'—') + '</td>' +
        '<td>' + Utils.formatDate(i.FECHA_INCIDENTE) + '</td></tr>';
    }).join('');
  }

  function renderCharts(data) {
    if (typeof Chart === 'undefined') { setTimeout(function() { renderCharts(data); }, 1500); return; }
    try {
      Object.values(chartInstances).forEach(function(c) { if (c && c.destroy) c.destroy(); });
      chartInstances = {};

      var el;
      el = document.getElementById('chartSede');
      if (el) chartInstances.sede = new Chart(el, { type:'bar', data:{ labels:Object.keys(data.porSede||{}), datasets:[{label:'Incidentes',data:Object.values(data.porSede||{}),backgroundColor:'#10069f',borderRadius:6}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}},x:{grid:{display:false}}}}});

      el = document.getElementById('chartEstado');
      if (el) chartInstances.estado = new Chart(el, { type:'doughnut', data:{ labels:Object.keys(data.porEstado||{}).map(function(e){return e.replace('_',' ');}), datasets:[{data:Object.values(data.porEstado||{}),backgroundColor:['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6'],borderWidth:2,borderColor:'#fff'}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});

      el = document.getElementById('chartTipo');
      if (el) chartInstances.tipo = new Chart(el, { type:'polarArea', data:{ labels:Object.keys(data.porTipo||{}), datasets:[{data:Object.values(data.porTipo||{}),backgroundColor:Utils.generateColors(Object.keys(data.porTipo||{}).length).map(function(c){return c+'99';})}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}});

      el = document.getElementById('chartTendencia');
      if (el) chartInstances.tend = new Chart(el, { type:'line', data:{ labels:Object.keys(data.tendencia||{}).map(function(d){return d.slice(5);}), datasets:[{label:'Incidentes',data:Object.values(data.tendencia||{}),borderColor:'#97D700',backgroundColor:'rgba(151,215,0,0.1)',fill:true,tension:0.4,pointRadius:2}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}},x:{grid:{display:false},ticks:{maxTicksLimit:10}}}}});
    } catch(e) { console.warn('Chart error:', e); }
  }

  // ==================== INCIDENTES ====================
  var incPage = 1, incFilters = {};

  async function renderIncidentes() {
    renderAppLayout('<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>', 'incidentes');
    await loadCatalogos();
    await loadIncList();
  }

  async function loadIncList() {
    try {
      var res = await API.getIncidentes(Object.assign({}, incFilters, { page: incPage, limit: 20 }));
      var pc = document.getElementById('pageContent');
      if (!pc || !res.success) return;

      var incs = res.data.incidentes, pag = res.data.pagination;
      var sedes = gc('sedes'), tipos = gc('tiposIncidencia');
      var canEdit = API.hasPermission('editar_incidentes');
      var canDel = API.hasPermission('eliminar_incidentes');
      var canCreate = API.hasPermission('crear_incidentes');

      var rows = incs.map(function(i) {
        return '<tr>' +
          '<td><strong style="color:var(--primary)">' + esc(i.NO_TICKET||'') + '</strong></td>' +
          '<td>' + esc(i.DPI_AFECTADO||'') + '</td>' +
          '<td>' + esc(i.NOMBRE_AFECTADO||'') + ' ' + esc(i.APELLIDO_AFECTADO||'') + '</td>' +
          '<td>' + esc(i.TELEFONO_AFECTADO||'') + '</td>' +
          '<td>' + esc(i.SEDE||'') + '</td>' +
          '<td>' + esc(i.TIPO_INCIDENCIA||'') + '</td>' +
          '<td>' + Utils.estadoBadge(i.ESTADO) + '</td>' +
          '<td>' + Utils.prioridadBadge(i.PRIORIDAD) + '</td>' +
          '<td>' + esc(i.CANAL_RECEPCION||'—') + '</td>' +
          '<td>' + Utils.formatDate(i.FECHA_INCIDENTE) + '</td>' +
          '<td><div style="display:flex;gap:4px">' +
            '<button class="btn btn-ghost btn-sm" onclick="App.viewIncidente(\'' + i.ID_INCIDENCIA + '\')" title="Ver">👁️</button>' +
            (canEdit ? '<button class="btn btn-ghost btn-sm" onclick="App.editIncidente(\'' + i.ID_INCIDENCIA + '\')" title="Editar">✏️</button>' : '') +
            (canDel ? '<button class="btn btn-ghost btn-sm" onclick="App.deleteIncidente(\'' + i.ID_INCIDENCIA + '\',\'' + i.NO_TICKET + '\')" title="Eliminar">🗑️</button>' : '') +
          '</div></td></tr>';
      }).join('');
      if (!incs.length) rows = '<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-muted)">No se encontraron incidentes</td></tr>';

      pc.innerHTML =
        '<div class="page-title-bar"><div><h1>Incidentes Ciudadanos</h1><div class="subtitle">' + pag.total + ' registros</div></div>' +
          (canCreate ? '<button class="btn btn-accent" onclick="Router.navigate(\'nuevo-incidente\')">➕ Nuevo Incidente</button>' : '') + '</div>' +
        '<div class="card" style="margin-bottom:20px"><div class="card-body"><div class="filter-bar">' +
          selFilter('sede', 'Todas las sedes', sedes) +
          selFilter('tipo', 'Todos los tipos', tipos) +
          '<select class="form-control" onchange="App.filterInc(\'estado\',this.value)"><option value="">Todos los estados</option><option value="ABIERTO">Abierto</option><option value="EN_PROCESO">En Proceso</option><option value="ESCALADO">Escalado</option><option value="CERRADO">Cerrado</option></select>' +
          '<input type="date" class="form-control" onchange="App.filterInc(\'fechaDesde\',this.value)" value="' + (incFilters.fechaDesde||'') + '">' +
          '<input type="date" class="form-control" onchange="App.filterInc(\'fechaHasta\',this.value)" value="' + (incFilters.fechaHasta||'') + '">' +
          '<button class="btn btn-ghost btn-sm" onclick="App.clearFilters()">Limpiar</button>' +
        '</div></div></div>' +
        '<div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper"><table><thead><tr>' +
          '<th>Ticket</th><th>DPI</th><th>Ciudadano</th><th>Tel</th><th>Sede</th><th>Tipo</th><th>Estado</th><th>Prioridad</th><th>Canal</th><th>Fecha</th><th>Acciones</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
    } catch(e) { console.error('Error incidentes:', e); }
  }

  function selFilter(key, placeholder, items) {
    var opts = items.map(function(i) {
      return '<option value="' + i.NOMBRE + '"' + (incFilters[key] === i.NOMBRE ? ' selected' : '') + '>' + i.NOMBRE + '</option>';
    }).join('');
    return '<select class="form-control" onchange="App.filterInc(\'' + key + '\',this.value)"><option value="">' + placeholder + '</option>' + opts + '</select>';
  }

  function filterInc(k, v) { if (v) incFilters[k] = v; else delete incFilters[k]; incPage = 1; loadIncList(); }
  function clearFilters() { incFilters = {}; incPage = 1; loadIncList(); }

  // ==================== NUEVO / EDITAR INCIDENTE ====================
  async function renderNuevoIncidente(editData) {
    if (!API.hasPermission('crear_incidentes') && !editData) { Toast.show('Sin permisos', 'error'); return; }
    await loadCatalogos();
    var sedes = gc('sedes'), tipos = gc('tiposIncidencia'), gestiones = gc('gestiones');
    var isEdit = !!editData;
    var e = editData || {};

    // Guatemala timezone default
    var nowLocal = new Date(new Date().getTime() - 6*3600000).toISOString().slice(0,16);
    var fechaVal = e.FECHA_INCIDENTE ? e.FECHA_INCIDENTE.slice(0,16) : nowLocal;

    var content =
      '<div class="page-title-bar"><div><h1>' + (isEdit ? 'Editar ' + (e.NO_TICKET||'') : '📝 Nuevo Incidente Ciudadano') + '</h1></div>' +
        '<button class="btn btn-outline" onclick="Router.navigate(\'incidentes\')">← Volver</button></div>' +
      '<div class="card"><div class="card-header"><h3>Datos del Incidente</h3></div><div class="card-body"><div class="form-grid">' +
        fgroup('DPI Ciudadano', 'text', 'fDpi', e.DPI_AFECTADO) +
        fgroup('Teléfono *', 'text', 'fTelefono', e.TELEFONO_AFECTADO) +
        fgroup('Nombres *', 'text', 'fNombre', e.NOMBRE_AFECTADO) +
        fgroup('Apellidos *', 'text', 'fApellido', e.APELLIDO_AFECTADO) +
        fsel('Sede *', 'fSede', sedes, e.SEDE) +
        '<div class="form-group"><label>Fecha del Incidente *</label><input type="datetime-local" class="form-control" id="fFecha" value="' + fechaVal + '"></div>' +
        fsel('Tipo de Incidente *', 'fTipo', tipos, e.TIPO_INCIDENCIA) +
        fsel('Gestión Realizada', 'fGestion', gestiones, e.GESTION_REALIZADA) +
        '<div class="form-group"><label>Canal de Recepción</label><select class="form-control" id="fCanal">' +
          chanOpt('Presencial', e.CANAL_RECEPCION) + chanOpt('Teléfono', e.CANAL_RECEPCION) + chanOpt('WhatsApp', e.CANAL_RECEPCION) +
          chanOpt('Redes Sociales', e.CANAL_RECEPCION) + chanOpt('Correo Electrónico', e.CANAL_RECEPCION) + chanOpt('App Móvil', e.CANAL_RECEPCION) +
          chanOpt('Página Web', e.CANAL_RECEPCION) + chanOpt('Oficio / Documento', e.CANAL_RECEPCION) + '</select></div>' +
        '<div class="form-group"><label>Prioridad</label><select class="form-control" id="fPrioridad">' +
          priOpt('BAJA', e.PRIORIDAD) + priOpt('MEDIA', e.PRIORIDAD, true) + priOpt('ALTA', e.PRIORIDAD) + priOpt('CRITICA', e.PRIORIDAD) + '</select></div>' +
        (isEdit ? '<div class="form-group"><label>Estado</label><select class="form-control" id="fEstado">' +
          estOpt('ABIERTO', e.ESTADO) + estOpt('EN_PROCESO', e.ESTADO) + estOpt('ESCALADO', e.ESTADO) + estOpt('CERRADO', e.ESTADO) + '</select></div>' : '') +
        //fgroup('Dirección del Incidente', 'text', 'fDir', e.DIRECCION_INCIDENTE, true) +
        //fgroup('Zona', 'text', 'fZona', e.ZONA) +
        '<div class="form-group full-width"><label>Descripción del Incidente *</label><textarea class="form-control" id="fDesc" rows="3">' + esc(e.DESCRIPCION_DEL_INCIDENTE||'') + '</textarea></div>' +
        '<div class="form-group full-width"><label>Descripción del Apoyo / Resolución</label><textarea class="form-control" id="fApoyo" rows="3">' + esc(e.DESCRIPCION_DEL_APOYO||'') + '</textarea></div>' +
        Photos.getUploadHTML() +
      '</div></div>' +
      '<div class="card-footer" style="display:flex;justify-content:flex-end;gap:10px">' +
        '<button class="btn btn-outline" onclick="Router.navigate(\'incidentes\')">Cancelar</button>' +
        '<button class="btn btn-primary btn-lg" onclick="App.saveInc(' + (isEdit ? "'" + e.ID_INCIDENCIA + "'" : 'null') + ')">' + (isEdit ? '💾 Guardar' : '✅ Registrar') + '</button>' +
      '</div></div>';

    if (!isEdit) renderAppLayout(content, 'nuevo-incidente');
    else { var pc = document.getElementById('pageContent'); if (pc) pc.innerHTML = content; }

    // Inicializar fotos
    if (isEdit && e.FOTOS) {
      try { Photos.setPhotos(JSON.parse(e.FOTOS)); } catch(ex) { Photos.clear(); }
    } else { Photos.clear(); }
    Photos.renderSlots();
  }

  function fgroup(label, type, id, val, full) {
    return '<div class="form-group' + (full ? ' full-width' : '') + '"><label>' + label + '</label><input type="' + type + '" class="form-control" id="' + id + '" value="' + esc(val||'') + '"></div>';
  }
  function fsel(label, id, items, sel) {
    var opts = items.map(function(i) { return '<option value="' + i.NOMBRE + '"' + (sel === i.NOMBRE ? ' selected' : '') + '>' + i.NOMBRE + '</option>'; }).join('');
    return '<div class="form-group"><label>' + label + '</label><select class="form-control" id="' + id + '"><option value="">-- Seleccionar --</option>' + opts + '</select></div>';
  }
  function chanOpt(v, sel) { return '<option value="' + v + '"' + (sel === v ? ' selected' : '') + '>' + v + '</option>'; }
  function priOpt(v, sel, def) { return '<option value="' + v + '"' + ((sel === v || (!sel && def)) ? ' selected' : '') + '>' + v.charAt(0) + v.slice(1).toLowerCase() + '</option>'; }
  function estOpt(v, sel) { return '<option value="' + v + '"' + (sel === v ? ' selected' : '') + '>' + v.replace('_', ' ') + '</option>'; }

  async function saveInc(id) {
    var data = {
      dpiAfectado: gval('fDpi'), nombreAfectado: gval('fNombre'), apellidoAfectado: gval('fApellido'),
      telefonoAfectado: gval('fTelefono'), sede: gval('fSede'), fechaIncidente: gval('fFecha'),
      tipoIncidencia: gval('fTipo'), gestionRealizada: gval('fGestion'),
      descripcionIncidente: gval('fDesc'), descripcionApoyo: gval('fApoyo'),
      prioridad: gval('fPrioridad'), //direccionIncidente: gval('fDir'),
      //zona: gval('fZona'), canalRecepcion: gval('fCanal'),
      fotos: JSON.stringify(Photos.getPhotos().filter(function(p){return !!p;}))
    };
    if (!data.nombreAfectado || !data.sede || !data.tipoIncidencia || !data.descripcionIncidente) {
      Toast.show('Completa los campos obligatorios (*)', 'warning'); return;
    }
    Loading.show(id ? 'Actualizando...' : 'Registrando...');
    try {
      var res;
      if (id) { data.idIncidencia = id; var est = document.getElementById('fEstado'); if (est) data.estado = est.value; res = await API.updateIncidente(data); }
      else { res = await API.createIncidente(data); }
      Loading.hide();
      if (res.success) { Toast.show(res.message||'Guardado', 'success'); Router.navigate('incidentes'); }
      else Toast.show(res.error, 'error');
    } catch(e) { Loading.hide(); Toast.show('Error de conexión', 'error'); }
  }

  function gval(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  async function viewIncidente(id) {
    Loading.show('Cargando...');
    try {
      var res = await API.getIncidenteById(id); Loading.hide();
      if (!res.success) { Toast.show('No encontrado', 'error'); return; }
      var i = res.data;
      openModal('Incidente ' + i.NO_TICKET,
        '<div class="detail-grid">' +
          drow('Ticket', '<strong>' + esc(i.NO_TICKET) + '</strong>') +
          drow('DPI', esc(i.DPI_AFECTADO||'—')) + drow('Ciudadano', esc(i.NOMBRE_AFECTADO||'') + ' ' + esc(i.APELLIDO_AFECTADO||'')) +
          drow('Teléfono', esc(i.TELEFONO_AFECTADO||'—')) + drow('Sede', esc(i.SEDE||'')) +
          drow('Tipo', esc(i.TIPO_INCIDENCIA||'')) + drow('Estado', Utils.estadoBadge(i.ESTADO)) +
          drow('Prioridad', Utils.prioridadBadge(i.PRIORIDAD)) + drow('Canal', esc(i.CANAL_RECEPCION||'—')) +
          drow('Gestión', esc(i.GESTION_REALIZADA||'—')) + drow('Dirección', esc(i.DIRECCION_INCIDENTE||'—')) +
          drow('Zona', esc(i.ZONA||'—')) + drow('Fecha', Utils.formatDateTime(i.FECHA_INCIDENTE)) +
        '</div>' +
        '<div style="margin-top:16px"><strong>Descripción:</strong><div style="white-space:pre-wrap;border:1px solid var(--border);padding:12px;border-radius:8px;background:var(--primary-alpha);margin-top:6px">' + esc(i.DESCRIPCION_DEL_INCIDENTE||'') + '</div></div>' +
        '<div style="margin-top:12px"><strong>Apoyo/Resolución:</strong><div style="white-space:pre-wrap;border:1px solid var(--border);padding:12px;border-radius:8px;margin-top:6px">' + esc(i.DESCRIPCION_DEL_APOYO||'Sin descripción') + '</div></div>' +
        Photos.getGalleryHTML(i.FOTOS)
      );
    } catch(e) { Loading.hide(); Toast.show('Error', 'error'); }
  }
  function drow(label, val) { return '<div class="detail-label">' + label + '</div><div class="detail-value">' + val + '</div>'; }

  async function editIncidente(id) {
    Loading.show('Cargando...'); try { var res = await API.getIncidenteById(id); Loading.hide();
    if (res.success) renderNuevoIncidente(res.data); else Toast.show('No encontrado', 'error');
    } catch(e) { Loading.hide(); Toast.show('Error', 'error'); }
  }

  async function deleteIncidente(id, ticket) {
    if (!confirm('¿Eliminar incidente ' + ticket + '?')) return;
    Loading.show('Eliminando...');
    try { var res = await API.deleteIncidente(id); Loading.hide();
    if (res.success) { Toast.show('Eliminado', 'success'); loadIncList(); } else Toast.show(res.error, 'error');
    } catch(e) { Loading.hide(); Toast.show('Error', 'error'); }
  }

  // ==================== USUARIOS ====================
  async function renderUsuarios() {
    if (!API.hasPermission('gestionar_usuarios')) { Toast.show('Sin permisos', 'error'); return; }
    renderAppLayout('<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>', 'usuarios');
    await loadCatalogos(); await loadRoles();
    try {
      var res = await API.getUsuarios(); var pc = document.getElementById('pageContent'); if (!pc || !res.success) return;
      var users = res.data;
      var rows = users.map(function(u) {
        return '<tr><td><code>' + u.ID_USUARIO + '</code></td><td><strong>' + esc(u.USERNAME||'') + '</strong></td>' +
          '<td>' + esc(u.NOMBRE||'') + ' ' + esc(u.APELLIDO||'') + '</td><td>' + esc(u.EMAIL||'') + '</td>' +
          '<td>' + Utils.rolBadge(u.ROL_NOMBRE||'') + '</td><td>' + esc(u.SEDE||'') + '</td>' +
          '<td>' + Utils.estadoUsuarioBadge(u.ESTADO) + '</td><td>' + Utils.formatDateTime(u.ULTIMO_ACCESO) + '</td>' +
          '<td><div style="display:flex;gap:4px"><button class="btn btn-ghost btn-sm" onclick="App.showUserModal(\'' + u.ID_USUARIO + '\')">✏️</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.toggleUser(\'' + u.ID_USUARIO + '\',\'' + u.ESTADO + '\')">' + (u.ESTADO==='ACTIVO'?'🔴':'🟢') + '</button></div></td></tr>';
      }).join('');

      pc.innerHTML =
        '<div class="page-title-bar"><div><h1>Usuarios del Sistema</h1><div class="subtitle">' + users.length + ' registrados</div></div>' +
        '<button class="btn btn-accent" onclick="App.showUserModal()">➕ Nuevo Usuario</button></div>' +
        '<div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper"><table><thead><tr>' +
        '<th>ID</th><th>Usuario</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Sede</th><th>Estado</th><th>Último Acceso</th><th>Acciones</th></tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
    } catch(e) { console.error(e); }
  }

  function showUserModal(userId) {
    var sedes = gc('sedes');
    var roles = rolesCache || [];
    var isEdit = !!userId;
    var sedeOpts = sedes.map(function(s) { return '<option value="' + s.NOMBRE + '">' + s.NOMBRE + '</option>'; }).join('');
    var rolOpts = roles.map(function(r) { return '<option value="' + r.ID_ROL + '">' + r.NOMBRE + '</option>'; }).join('');

    openModal(isEdit ? 'Editar Usuario' : 'Nuevo Usuario',
      '<div class="form-grid">' +
        '<div class="form-group"><label>Username *</label><input type="text" class="form-control" id="uUser" ' + (isEdit?'disabled':'') + '></div>' +
        '<div class="form-group"><label>' + (isEdit?'Nueva Contraseña':'Contraseña *') + '</label><input type="password" class="form-control" id="uPass"></div>' +
        '<div class="form-group"><label>Nombre *</label><input type="text" class="form-control" id="uNom"></div>' +
        '<div class="form-group"><label>Apellido</label><input type="text" class="form-control" id="uApe"></div>' +
        '<div class="form-group"><label>Email *</label><input type="email" class="form-control" id="uEmail"></div>' +
        '<div class="form-group"><label>Rol *</label><select class="form-control" id="uRol">' + rolOpts + '</select></div>' +
        '<div class="form-group full-width"><label>Sede</label><select class="form-control" id="uSede"><option value="TODAS">Todas las sedes</option>' + sedeOpts + '</select></div>' +
      '</div>',
      '<button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="App.saveUser(' + (isEdit?"'"+userId+"'":'null') + ')">' + (isEdit?'💾 Guardar':'✅ Crear') + '</button>'
    );
  }

  async function saveUser(userId) {
    var d = { username:gval('uUser'), password:gval('uPass'), nombre:gval('uNom'), apellido:gval('uApe'), email:gval('uEmail'), rolId:gval('uRol'), sede:gval('uSede') };
    if (!userId && (!d.username || !d.password)) { Toast.show('Username y contraseña requeridos', 'warning'); return; }
    if (!d.nombre || !d.email) { Toast.show('Nombre y email requeridos', 'warning'); return; }
    Loading.show('Guardando...');
    try { var res; if (userId) { d.idUsuario=userId; if(!d.password) delete d.password; res=await API.updateUsuario(d); } else { res=await API.createUsuario(d); }
    Loading.hide(); if (res.success) { Toast.show(res.message||'Guardado','success'); closeModal(); renderUsuarios(); } else Toast.show(res.error,'error');
    } catch(e) { Loading.hide(); Toast.show('Error','error'); }
  }

  async function toggleUser(id, st) {
    if (!confirm('¿' + (st==='ACTIVO'?'Desactivar':'Activar') + ' este usuario?')) return;
    Loading.show('...'); try { var r=await API.toggleUsuario(id); Loading.hide();
    if (r.success) { Toast.show(r.message,'success'); renderUsuarios(); } else Toast.show(r.error,'error');
    } catch(e) { Loading.hide(); }
  }

  // ==================== ROLES ====================
  async function renderRoles() {
    if (!API.hasPermission('gestionar_roles')) { Toast.show('Sin permisos', 'error'); return; }
    renderAppLayout('<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>', 'roles');
    try {
      var resR = await API.getRoles();
      var resP = await API.getPermisos();
      var pc = document.getElementById('pageContent'); if (!pc) return;
      if (!resR.success) { pc.innerHTML = '<div class="empty-state"><h3>Error</h3><p>' + (resR.error||'') + '</p></div>'; return; }

      var roles = resR.data;
      var permsList = resP.success ? resP.data : [];

      var rows = roles.map(function(r) {
        var perms = []; try { perms = JSON.parse(r.PERMISOS||'[]'); } catch(e) {}
        return '<tr><td><code>' + r.ID_ROL + '</code></td><td><strong>' + esc(r.NOMBRE) + '</strong></td>' +
          '<td>' + esc(r.DESCRIPCION||'') + '</td>' +
          '<td>' + perms.length + ' permisos</td>' +
          '<td>' + (r.ES_SISTEMA==='SI' ? '<span class="badge badge-admin">Sistema</span>' : '<span class="badge badge-user">Custom</span>') + '</td>' +
          '<td><div style="display:flex;gap:4px">' +
            '<button class="btn btn-ghost btn-sm" onclick="App.showRolModal(\'' + r.ID_ROL + '\')">✏️</button>' +
            (r.ES_SISTEMA !== 'SI' ? '<button class="btn btn-ghost btn-sm" onclick="App.deleteRol(\'' + r.ID_ROL + '\')">🗑️</button>' : '') +
          '</div></td></tr>';
      }).join('');

      pc.innerHTML =
        '<div class="page-title-bar"><div><h1>🔐 Roles y Permisos</h1><div class="subtitle">Administra los roles del sistema y sus permisos</div></div>' +
        '<button class="btn btn-accent" onclick="App.showRolModal()">➕ Nuevo Rol</button></div>' +
        '<div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper"><table><thead><tr>' +
        '<th>ID</th><th>Nombre</th><th>Descripción</th><th>Permisos</th><th>Tipo</th><th>Acciones</th></tr></thead><tbody>' + rows + '</tbody></table></div></div></div>' +
        '<div class="card" style="margin-top:20px"><div class="card-header"><h3>📋 Permisos Disponibles</h3></div><div class="card-body">' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">' +
          permsList.map(function(p) { return '<div style="padding:8px 12px;background:var(--primary-alpha);border-radius:8px;font-size:13px"><strong>' + p.id + '</strong><br><span style="color:var(--text-secondary)">' + p.label + '</span></div>'; }).join('') +
        '</div></div></div>';

      // Store perms for modal
      window._permsList = permsList;
    } catch(e) { console.error(e); }
  }

  async function showRolModal(rolId) {
    var permsList = window._permsList || [];
    var isEdit = !!rolId;
    var existingPerms = [];

    if (isEdit) {
      try {
        var res = await API.getRoles();
        if (res.success) {
          var rol = res.data.find(function(r) { return r.ID_ROL === rolId; });
          if (rol) { try { existingPerms = JSON.parse(rol.PERMISOS||'[]'); } catch(e) {} }
        }
      } catch(e) {}
    }

    var checkboxes = permsList.map(function(p) {
      var checked = existingPerms.indexOf(p.id) !== -1 ? ' checked' : '';
      return '<label style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;font-size:13px;cursor:pointer">' +
        '<input type="checkbox" class="perm-check" value="' + p.id + '"' + checked + ' style="margin-top:2px">' +
        '<span><strong>' + p.id + '</strong><br><span style="color:var(--text-secondary);font-size:12px">' + p.label + '</span></span></label>';
    }).join('');

    openModal(isEdit ? 'Editar Rol' : 'Nuevo Rol',
      '<div class="form-grid">' +
        '<div class="form-group"><label>Nombre del Rol *</label><input type="text" class="form-control" id="rNom"></div>' +
        '<div class="form-group"><label>Descripción</label><input type="text" class="form-control" id="rDesc"></div>' +
      '</div>' +
      '<div style="margin-top:16px"><label style="font-weight:700;font-size:14px">Permisos:</label>' +
      '<div style="max-height:300px;overflow-y:auto;margin-top:8px;border:1px solid var(--border);border-radius:8px;padding:12px">' + checkboxes + '</div></div>',
      '<button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="App.saveRol(' + (isEdit?"'"+rolId+"'":'null') + ')">' + (isEdit?'💾 Guardar':'✅ Crear Rol') + '</button>'
    );
  }

  async function saveRol(rolId) {
    var nombre = gval('rNom'), desc = gval('rDesc');
    if (!nombre) { Toast.show('Nombre requerido', 'warning'); return; }
    var perms = [];
    document.querySelectorAll('.perm-check:checked').forEach(function(cb) { perms.push(cb.value); });

    Loading.show('Guardando...');
    try { var res;
    if (rolId) { res = await API.updateRol({ idRol: rolId, nombre: nombre, descripcion: desc, permisos: perms }); }
    else { res = await API.createRol({ nombre: nombre, descripcion: desc, permisos: perms }); }
    Loading.hide();
    if (res.success) { Toast.show(res.message||'Guardado', 'success'); closeModal(); renderRoles(); }
    else Toast.show(res.error, 'error');
    } catch(e) { Loading.hide(); Toast.show('Error', 'error'); }
  }

  async function deleteRol(id) {
    if (!confirm('¿Eliminar este rol?')) return;
    Loading.show('...'); try { var r=await API.deleteRol(id); Loading.hide();
    if (r.success) { Toast.show('Eliminado','success'); renderRoles(); } else Toast.show(r.error,'error');
    } catch(e) { Loading.hide(); }
  }

  // ==================== CATÁLOGOS ====================
  async function renderCatalogos() {
    if (!API.hasPermission('gestionar_catalogos')) { Toast.show('Sin permisos', 'error'); return; }
    renderAppLayout('<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>', 'catalogos');
    await loadCatalogos(true);
    var pc = document.getElementById('pageContent'); if (!pc) return;
    pc.innerHTML =
      '<div class="page-title-bar"><h1>Catálogos del Sistema</h1></div>' +
      '<div class="tabs">' +
        '<button class="tab-btn active" onclick="App.switchCat(\'sedes\',this)">Sedes</button>' +
        '<button class="tab-btn" onclick="App.switchCat(\'tipos\',this)">Tipos de Incidente</button>' +
        '<button class="tab-btn" onclick="App.switchCat(\'gestiones\',this)">Gestiones</button></div>' +
      '<div id="catContent">' + catTable('sedes', gc('sedes'), ['ID','CODIGO','NOMBRE','DIRECCION','ESTADO']) + '</div>';
  }

  function catTable(cat, items, cols) {
    var hdr = cols.map(function(c){return '<th>'+c+'</th>';}).join('') + '<th>Acciones</th>';
    var rows = items.map(function(i) {
      return '<tr>' + cols.map(function(c){return '<td>'+esc(String(i[c]||''))+'</td>';}).join('') +
        '<td><button class="btn btn-ghost btn-sm" onclick="App.delCat(\'' + cat + '\',\'' + (i.ID||i.CODIGO) + '\')">🗑️</button></td></tr>';
    }).join('');
    if (!items.length) rows = '<tr><td colspan="'+(cols.length+1)+'" style="text-align:center;padding:30px;color:var(--text-muted)">Sin registros</td></tr>';
    return '<div class="card"><div class="card-header"><h3>' + cat + ' (' + items.length + ')</h3>' +
      '<button class="btn btn-accent btn-sm" onclick="App.addCat(\'' + cat + '\')">➕ Agregar</button></div>' +
      '<div class="card-body" style="padding:0"><div class="table-wrapper"><table><thead><tr>' + hdr + '</tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
  }

  function switchCat(cat, btn) {
    document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');}); btn.classList.add('active');
    var d = cat==='sedes' ? gc('sedes') : cat==='tipos' ? gc('tiposIncidencia') : gc('gestiones');
    var c = cat==='sedes' ? ['ID','CODIGO','NOMBRE','DIRECCION','ESTADO'] : ['ID','CODIGO','NOMBRE','DESCRIPCION','ESTADO'];
    document.getElementById('catContent').innerHTML = catTable(cat, d, c);
  }

  async function addCat(cat) {
    var f = cat==='sedes' ? {ID:prompt('ID:'),CODIGO:prompt('Código:'),NOMBRE:prompt('Nombre:'),DIRECCION:prompt('Dirección:'),ESTADO:'ACTIVO'}
      : {ID:prompt('ID:'),CODIGO:prompt('Código:'),NOMBRE:prompt('Nombre:'),DESCRIPCION:prompt('Descripción:'),ESTADO:'ACTIVO'};
    if (!f.NOMBRE) return;
    Loading.show('...'); try { var r=await API.addCatalogoItem(cat,f); Loading.hide();
    if (r.success) { Toast.show('Agregado','success'); renderCatalogos(); } else Toast.show(r.error,'error');
    } catch(e) { Loading.hide(); }
  }

  async function delCat(cat, id) {
    if (!confirm('¿Eliminar?')) return;
    Loading.show('...'); try { var r=await API.deleteCatalogoItem(cat,id); Loading.hide();
    if (r.success) { Toast.show('Eliminado','success'); renderCatalogos(); } else Toast.show(r.error,'error');
    } catch(e) { Loading.hide(); }
  }

  // ==================== REPORTES ====================
  async function renderReportes() {
    if (!API.hasPermission('ver_reportes')) { Toast.show('Sin permisos para ver reportes', 'error'); Router.navigate('incidentes'); return; }
    await loadCatalogos();
    var sedes = gc('sedes'), tipos = gc('tiposIncidencia');
    var so = sedes.map(function(s){return '<option value="'+s.NOMBRE+'">'+s.NOMBRE+'</option>';}).join('');
    var to = tipos.map(function(t){return '<option value="'+t.NOMBRE+'">'+t.NOMBRE+'</option>';}).join('');

    renderAppLayout(
      '<div class="page-title-bar"><h1>📊 Reportes</h1></div>' +
      '<div class="card"><div class="card-header"><h3>Configurar Reporte</h3></div><div class="card-body"><div class="form-grid">' +
        '<div class="form-group"><label>Sede</label><select class="form-control" id="rSede"><option value="">Todas</option>' + so + '</select></div>' +
        '<div class="form-group"><label>Tipo</label><select class="form-control" id="rTipo"><option value="">Todos</option>' + to + '</select></div>' +
        '<div class="form-group"><label>Estado</label><select class="form-control" id="rEstado"><option value="">Todos</option><option value="ABIERTO">Abierto</option><option value="EN_PROCESO">En Proceso</option><option value="ESCALADO">Escalado</option><option value="CERRADO">Cerrado</option></select></div>' +
        '<div class="form-group"><label>Desde</label><input type="date" class="form-control" id="rDesde"></div>' +
        '<div class="form-group"><label>Hasta</label><input type="date" class="form-control" id="rHasta"></div>' +
      '</div></div><div class="card-footer" style="display:flex;gap:12px;justify-content:flex-end">' +
        (API.hasPermission('exportar_reportes') ? '<button class="btn btn-primary btn-lg" onclick="App.exportCSV()">📥 Exportar Excel</button><button class="btn btn-accent btn-lg" onclick="App.exportPDF()">📄 Exportar PDF</button>' : '<p style="color:var(--text-secondary)">No tienes permisos para exportar</p>') +
      '</div></div>',
      'reportes');
  }

  function rFilters() {
    return { sede:gval('rSede'), tipo:gval('rTipo'), estado:gval('rEstado'), fechaDesde:gval('rDesde'), fechaHasta:gval('rHasta') };
  }

  async function exportCSV() {
    Loading.show('Generando...'); try { var r=await API.exportReport(rFilters()); Loading.hide();
    if (!r.success) { Toast.show(r.error,'error'); return; }
    var d=r.data.incidentes; if (!d.length) { Toast.show('Sin datos','warning'); return; }
    var h=Object.keys(d[0]); var csv=[h.join(',')].concat(d.map(function(row){return h.map(function(k){return '"'+String(row[k]||'').replace(/"/g,'""')+'"';}).join(',');})).join('\n');
    var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='Reporte_'+new Date().toISOString().split('T')[0]+'.csv'; a.click();
    Toast.show('Exportado: '+d.length+' registros','success');
    } catch(e) { Loading.hide(); Toast.show('Error','error'); }
  }

  async function exportPDF() {
    Loading.show('Generando...'); try { var r=await API.exportReport(rFilters()); Loading.hide();
    if (!r.success) { Toast.show(r.error,'error'); return; }
    var d=r.data.incidentes, m=r.data;
    var rows=d.map(function(i){return '<tr><td><strong>'+(i.NO_TICKET||'')+'</strong></td><td>'+(i.DPI_AFECTADO||'')+'</td><td>'+(i.NOMBRE_AFECTADO||'')+' '+(i.APELLIDO_AFECTADO||'')+'</td><td>'+(i.SEDE||'')+'</td><td>'+(i.TIPO_INCIDENCIA||'')+'</td><td>'+((i.ESTADO||'').replace('_',' '))+'</td><td>'+(i.CANAL_RECEPCION||'')+'</td><td>'+Utils.formatDate(i.FECHA_INCIDENTE)+'</td></tr>';}).join('');
    var w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>Reporte Municipal</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;color:#1a1a2e;font-size:11px}.hdr{background:linear-gradient(135deg,#10069f,#0b0470);color:#fff;padding:30px}.hdr h1{font-size:22px}.ab{height:4px;background:#97D700}.meta{padding:12px 30px;background:#f0f2f8;display:flex;gap:20px;flex-wrap:wrap;font-size:11px}.meta strong{color:#10069f}table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#10069f;color:#fff;padding:8px 10px;text-align:left;font-size:10px}td{padding:7px 10px;border-bottom:1px solid #e2e4ef;font-size:10px}tr:nth-child(even){background:rgba(16,6,159,.03)}.ft{text-align:center;padding:16px;color:#9a9ab0;font-size:10px;border-top:2px solid #97D700;margin-top:20px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>' +
      '<div class="hdr"><h1>📋 Reporte de Incidentes Municipales</h1><p>Municipalidad de Guatemala</p></div><div class="ab"></div>' +
      '<div class="meta"><span><strong>Generado:</strong> '+m.generadoPor+'</span><span><strong>Fecha:</strong> '+Utils.formatDateTime(m.fechaGeneracion)+'</span><span><strong>Total:</strong> '+m.totalRegistros+'</span></div>' +
      '<div style="padding:0 20px"><table><thead><tr><th>Ticket</th><th>DPI</th><th>Ciudadano</th><th>Sede</th><th>Tipo</th><th>Estado</th><th>Canal</th><th>Fecha</th></tr></thead><tbody>'+rows+'</tbody></table></div>' +
      '<div class="ft">Municipalidad de Guatemala — Documento generado automáticamente — '+new Date().getFullYear()+'</div>' +
      '<script>window.onload=function(){window.print();}<\/script></body></html>');
    w.document.close();
    Toast.show('PDF generado','success');
    } catch(e) { Loading.hide(); Toast.show('Error','error'); }
  }

  // ==================== MODAL ====================
  function openModal(title, body, footer) {
    var ov = document.getElementById('modalOverlay');
    if (!ov) { ov=document.createElement('div'); ov.id='modalOverlay'; ov.className='modal-overlay';
    ov.addEventListener('click',function(e){if(e.target===ov)closeModal();}); document.body.appendChild(ov); }
    ov.innerHTML = '<div class="modal"><div class="modal-header"><h2>'+title+'</h2><button class="modal-close" onclick="App.closeModal()">×</button></div>' +
      '<div class="modal-body">'+body+'</div>' + (footer ? '<div class="modal-footer">'+footer+'</div>' : '') + '</div>';
    requestAnimationFrame(function(){ov.classList.add('active');});
  }
  function closeModal() { var ov=document.getElementById('modalOverlay'); if(ov){ov.classList.remove('active');setTimeout(function(){ov.remove();},300);} }

  // ==================== HELPERS ====================
  async function loadCatalogos(force) {
    if (catalogosCache && !force) return;
    try { var r=await API.getCatalogos(); if(r.success) catalogosCache=r.data; } catch(e) {}
  }
  async function loadRoles() {
    try { var r=await API.getRoles(); if(r.success) rolesCache=r.data; } catch(e) {}
  }
  function gc(key) { return (catalogosCache && catalogosCache[key]) || []; }
  function globalSearch(q) { if(!q||!q.trim()) return; incFilters={busqueda:q.trim()}; incPage=1; Router.navigate('incidentes'); }

  return {
    init:init, switchLoginTab:switchLoginTab, doLogin:doLogin, doGoogleLogin:doGoogleLogin,
    togglePassword:togglePassword,
    renderDashboard:renderDashboard, renderIncidentes:renderIncidentes, renderNuevoIncidente:renderNuevoIncidente,
    renderUsuarios:renderUsuarios, renderRoles:renderRoles, renderCatalogos:renderCatalogos, renderReportes:renderReportes,
    filterInc:filterInc, clearFilters:clearFilters,
    viewIncidente:viewIncidente, editIncidente:editIncidente, deleteIncidente:deleteIncidente, saveInc:saveInc,
    showUserModal:showUserModal, saveUser:saveUser, toggleUser:toggleUser,
    showRolModal:showRolModal, saveRol:saveRol, deleteRol:deleteRol,
    switchCat:switchCat, addCat:addCat, delCat:delCat,
    exportCSV:exportCSV, exportPDF:exportPDF,
    openModal:openModal, closeModal:closeModal, globalSearch:globalSearch
  };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.init);
else App.init();
