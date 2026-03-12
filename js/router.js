/**
 * ============================================================
 *  ROUTER - Navegación SPA basada en hash
 * ============================================================
 */

const Router = (() => {
  let routes = {};
  let currentView = null;
  let isNavigating = false;

  function register(path, handler) {
    routes[path] = handler;
  }

  function navigate(path) {
    window.location.hash = '#' + path;
  }

  function getCurrentPath() {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') return '';
    return hash.replace(/^#\/?/, '');
  }

  function init() {
    window.addEventListener('hashchange', () => handleRoute());
    handleRoute();
  }

  async function handleRoute() {
    if (isNavigating) return;
    isNavigating = true;

    try {
      let path = getCurrentPath();
      const loggedIn = API.isLoggedIn();

      // Sin hash -> decidir destino
      if (!path) {
        isNavigating = false;
        if (loggedIn) {
          window.location.hash = API.hasPermission('ver_dashboard') ? '#dashboard' : '#incidentes';
        } else {
          await executeView('login');
        }
        return;
      }

      // No logueado y ruta protegida -> login
      if (!loggedIn && path !== 'login') {
        isNavigating = false;
        window.location.hash = '#login';
        return;
      }

      // Logueado intentando ir a login -> dashboard
      if (loggedIn && path === 'login') {
        isNavigating = false;
        window.location.hash = API.hasPermission('ver_dashboard') ? '#dashboard' : '#incidentes';
        return;
      }

      // Rutas que requieren permisos específicos
      var routePerms = {
        'usuarios': 'gestionar_usuarios',
        'catalogos': 'gestionar_catalogos',
        'roles': 'gestionar_roles',
        'reportes': 'ver_reportes'
      };
      if (routePerms[path] && !API.hasPermission(routePerms[path])) {
        Toast.show('No tienes permisos para esta sección', 'error');
        isNavigating = false;
        window.location.hash = '#incidentes';
        return;
      }

      // Ejecutar vista
      if (routes[path]) {
        await executeView(path);
      } else {
        isNavigating = false;
        window.location.hash = loggedIn ? '#incidentes' : '#login';
        return;
      }

    } catch (err) {
      console.error('Router error:', err);
      showErrorPage(err.message);
    }

    isNavigating = false;
  }

  async function executeView(path) {
    const handler = routes[path];
    if (!handler) return;

    currentView = path;
    try {
      const result = handler();
      if (result && typeof result.then === 'function') {
        await result;
      }
    } catch (err) {
      console.error('Error en vista "' + path + '":', err);
      showErrorPage('Error al cargar: ' + path);
    }
    updateActiveNav(path);
  }

  function showErrorPage(message) {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML =
        '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f2f8;padding:20px;">' +
          '<div style="background:white;border-radius:16px;padding:40px;max-width:500px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
            '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
            '<h2 style="color:#10069f;margin-bottom:12px;">Error del Sistema</h2>' +
            '<p style="color:#5a5a7a;font-size:14px;margin-bottom:20px;">' + message + '</p>' +
            '<button onclick="localStorage.clear();location.hash=\'#login\';location.reload();" ' +
              'style="background:#10069f;color:white;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">' +
              'Volver al Inicio</button>' +
          '</div>' +
        '</div>';
    }
  }

  function updateActiveNav(path) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === path);
    });
  }

  return { register, navigate, init, getCurrentPath };
})();
