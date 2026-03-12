// ============================================================
//  API SERVICE v2 - Municipalidad
// ============================================================
var API = (function() {
  // ⚠️ REEMPLAZAR con tu URL de Web App
  var BASE_URL = 'https://script.google.com/macros/s/AKfycbxGVfadK3ziGqsTAKht4UqCpxv65uP7ja_p3kwKMJzz0NLxce1kHD9YkkdOzGX_9HpH/exec';

  var TOKEN_KEY = 'muni_inc_token';
  var USER_KEY = 'muni_inc_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch(e) { return null; } }
  function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function isLoggedIn() { return !!getToken(); }

  function hasPermission(p) {
    var u = getUser();
    return u && u.permisos && u.permisos.indexOf(p) !== -1;
  }
  function hasAnyPermission(arr) {
    return arr.some(function(p) { return hasPermission(p); });
  }

  async function request(action, params) {
    params = params || {};
    var token = getToken();
    var body = Object.assign({ action: action }, params);
    if (token) body.token = token;
    try {
      var resp = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow'
      });
      var data = await resp.json();
      if (!data.success && data.error && data.error.indexOf('Token') !== -1) {
        clearToken(); window.location.hash = '#login';
        Toast.show('Sesión expirada', 'warning');
      }
      return data;
    } catch(e) {
      console.error('API Error:', e);
      return { success: false, error: 'Error de conexión. Verifica la URL del API.' };
    }
  }

  async function login(u, p) { var r = await request('login', {username:u,password:p}); if(r.success){setToken(r.data.token);setUser(r.data.user);} return r; }
  async function loginWithGoogle(d) { var r = await request('loginGoogle', d); if(r.success){setToken(r.data.token);setUser(r.data.user);} return r; }
  function logout() { clearToken(); window.location.hash='#login'; }

  return {
    getToken:getToken, setToken:setToken, clearToken:clearToken, getUser:getUser, setUser:setUser,
    isLoggedIn:isLoggedIn, hasPermission:hasPermission, hasAnyPermission:hasAnyPermission, login:login,
    loginWithGoogle:loginWithGoogle, logout:logout,
    getIncidentes: function(f){return request('getIncidentes',f);},
    getIncidenteById: function(id){return request('getIncidenteById',{idIncidencia:id});},
    createIncidente: function(d){return request('createIncidente',d);},
    updateIncidente: function(d){return request('updateIncidente',d);},
    deleteIncidente: function(id){return request('deleteIncidente',{idIncidencia:id});},
    getUsuarios: function(){return request('getUsuarios');},
    createUsuario: function(d){return request('createUsuario',d);},
    updateUsuario: function(d){return request('updateUsuario',d);},
    toggleUsuario: function(id){return request('toggleUsuario',{idUsuario:id});},
    getRoles: function(){return request('getRoles');},
    createRol: function(d){return request('createRol',d);},
    updateRol: function(d){return request('updateRol',d);},
    deleteRol: function(id){return request('deleteRol',{idRol:id});},
    getPermisos: function(){return request('getPermisos');},
    getCatalogos: function(){return request('getCatalogos');},
    addCatalogoItem: function(c,i){return request('addCatalogoItem',{catalogo:c,item:i});},
    deleteCatalogoItem: function(c,id){return request('deleteCatalogoItem',{catalogo:c,itemId:id});},
    getDashboardData: function(){return request('getDashboardData');},
    exportReport: function(f){return request('exportReport',f);}
  };
})();
