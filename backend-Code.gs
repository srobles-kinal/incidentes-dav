/**
 * ============================================================
 *  SISTEMA DE GESTIÓN DE INCIDENTES MUNICIPALES v2
 *  Backend API - Google Apps Script
 *  Zona horaria: America/Guatemala (UTC-6)
 *  Enfoque: Servicio al Ciudadano / Atención Municipal
 * ============================================================
 */

// ==================== CONFIGURACIÓN ====================
const CONFIG = {
  SPREADSHEET_ID: '10Pklj1PYrLgSbEgXAf3-l4bWcbxgF8MZPuBPWFLbU3U',
  SHEETS: {
    INCIDENTES: 'Incidentes',
    USUARIOS: 'Usuarios',
    ROLES: 'Roles',
    CATALOGO_SEDES: 'Cat_Sedes',
    CATALOGO_TIPOS: 'Cat_TiposIncidencia',
    CATALOGO_GESTIONES: 'Cat_Gestiones',
    LOG_ACTIVIDAD: 'Log_Actividad'
  },
  TOKEN_EXPIRY_HOURS: 10,
  SALT: 'MUNI_INC_2024_SALT',
  TIMEZONE: 'America/Guatemala'
};

// Permisos disponibles en el sistema
const PERMISOS = [
  'ver_incidentes',
  'crear_incidentes',
  'editar_incidentes',
  'eliminar_incidentes',
  'ver_todos_sedes',
  'ver_reportes',
  'exportar_reportes',
  'ver_dashboard',
  'gestionar_usuarios',
  'gestionar_roles',
  'gestionar_catalogos',
  'ver_log_actividad'
];

// ==================== ZONA HORARIA ====================
function nowGT() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}
function formatDateGT(date) {
  if (!date) return '';
  try {
    var d = (date instanceof Date) ? date : new Date(date);
    return Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  } catch(e) { return String(date); }
}

// ==================== ENTRY POINTS ====================
function doGet(e) { return handleRequest(e, 'GET'); }
function doPost(e) { return handleRequest(e, 'POST'); }

function handleRequest(e, method) {
  try {
    var params = method === 'GET' ? e.parameter : JSON.parse(e.postData.contents);
    var action = params.action || (e.parameter && e.parameter.action);
    var result;

    switch (action) {
      // AUTH
      case 'login': result = login(params); break;
      case 'loginGoogle': result = loginGoogle(params); break;
      case 'validateToken': result = validateToken(params.token); break;
      // INCIDENTES
      case 'getIncidentes': result = withAuth(params, getIncidentes); break;
      case 'createIncidente': result = withAuth(params, createIncidente, ['crear_incidentes']); break;
      case 'updateIncidente': result = withAuth(params, updateIncidente, ['editar_incidentes']); break;
      case 'deleteIncidente': result = withAuth(params, deleteIncidente, ['eliminar_incidentes']); break;
      case 'getIncidenteById': result = withAuth(params, getIncidenteById); break;
      // USUARIOS
      case 'getUsuarios': result = withAuth(params, getUsuarios, ['gestionar_usuarios']); break;
      case 'createUsuario': result = withAuth(params, createUsuario, ['gestionar_usuarios']); break;
      case 'updateUsuario': result = withAuth(params, updateUsuario, ['gestionar_usuarios']); break;
      case 'toggleUsuario': result = withAuth(params, toggleUsuario, ['gestionar_usuarios']); break;
      // ROLES
      case 'getRoles': result = withAuth(params, getRoles); break;
      case 'createRol': result = withAuth(params, createRol, ['gestionar_roles']); break;
      case 'updateRol': result = withAuth(params, updateRol, ['gestionar_roles']); break;
      case 'deleteRol': result = withAuth(params, deleteRol, ['gestionar_roles']); break;
      case 'getPermisos': result = withAuth(params, getPermisosDisponibles); break;
      // CATÁLOGOS
      case 'getCatalogos': result = withAuth(params, getCatalogos); break;
      case 'addCatalogoItem': result = withAuth(params, addCatalogoItem, ['gestionar_catalogos']); break;
      case 'deleteCatalogoItem': result = withAuth(params, deleteCatalogoItem, ['gestionar_catalogos']); break;
      // DASHBOARD
      case 'getDashboardData': result = withAuth(params, getDashboardData, ['ver_dashboard']); break;
      // REPORTES
      case 'exportReport': result = withAuth(params, exportReport, ['exportar_reportes']); break;
      default:
        result = { success: false, error: 'Acción no reconocida: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== BD HELPERS ====================
function getSheet(name) {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
}

function getSheetData(sheetName) {
  var sheet = getSheet(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row, idx) {
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function appendRow(sheetName, dataObj) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { return dataObj[h] || ''; });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function updateRow(sheetName, rowNum, dataObj) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach(function(h, i) {
    if (dataObj.hasOwnProperty(h)) {
      sheet.getRange(rowNum, i + 1).setValue(dataObj[h]);
    }
  });
}

function deleteRow(sheetName, rowNum) {
  getSheet(sheetName).deleteRow(rowNum);
}

// ==================== AUTENTICACIÓN ====================
function hashPassword(password) {
  var raw = CONFIG.SALT + password;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function generateToken(userId, rolId) {
  var payload = {
    userId: userId, rolId: rolId,
    exp: new Date().getTime() + (CONFIG.TOKEN_EXPIRY_HOURS * 3600000),
    rnd: Math.random().toString(36).substring(2)
  };
  return Utilities.base64Encode(JSON.stringify(payload));
}

function decodeToken(token) {
  try {
    var json = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    var payload = JSON.parse(json);
    if (payload.exp < new Date().getTime()) return null;
    return payload;
  } catch (e) { return null; }
}

function getUserPermissions(rolId) {
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  var rol = roles.find(function(r) { return r.ID_ROL === rolId; });
  if (!rol) return [];
  try {
    return JSON.parse(rol.PERMISOS || '[]');
  } catch(e) { return []; }
}

function validateToken(token) {
  var payload = decodeToken(token);
  if (!payload) return { success: false, error: 'Token inválido o expirado' };

  var usuarios = getSheetData(CONFIG.SHEETS.USUARIOS);
  var user = usuarios.find(function(u) { return String(u.ID_USUARIO) === String(payload.userId); });
  if (!user || user.ESTADO !== 'ACTIVO') return { success: false, error: 'Usuario inactivo' };

  var permisos = getUserPermissions(user.ROL_ID);
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  var rolData = roles.find(function(r) { return r.ID_ROL === user.ROL_ID; });

  return {
    success: true,
    data: {
      userId: user.ID_USUARIO,
      nombre: user.NOMBRE,
      apellido: user.APELLIDO,
      email: user.EMAIL,
      rolId: user.ROL_ID,
      rolNombre: rolData ? rolData.NOMBRE : 'Sin Rol',
      sede: user.SEDE,
      permisos: permisos
    }
  };
}

function withAuth(params, fn, requiredPermisos) {
  var token = params.token;
  if (!token) return { success: false, error: 'Token requerido' };

  var validation = validateToken(token);
  if (!validation.success) return validation;

  if (requiredPermisos && requiredPermisos.length > 0) {
    var userPermisos = validation.data.permisos;
    var hasAll = requiredPermisos.every(function(p) { return userPermisos.indexOf(p) !== -1; });
    if (!hasAll) {
      return { success: false, error: 'No tienes permisos para esta acción. Se requiere: ' + requiredPermisos.join(', ') };
    }
  }

  params._user = validation.data;
  return fn(params);
}

// ==================== LOGIN ====================
function login(params) {
  var username = params.username;
  var password = params.password;
  if (!username || !password) return { success: false, error: 'Usuario y contraseña requeridos' };

  var usuarios = getSheetData(CONFIG.SHEETS.USUARIOS);
  var hashed = hashPassword(password);
  var user = usuarios.find(function(u) {
    return u.USERNAME === username && u.PASSWORD_HASH === hashed && u.ESTADO === 'ACTIVO';
  });

  if (!user) {
    logActivity('LOGIN_FALLIDO', username, 'Intento fallido');
    return { success: false, error: 'Credenciales inválidas o usuario inactivo' };
  }

  var permisos = getUserPermissions(user.ROL_ID);
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  var rolData = roles.find(function(r) { return r.ID_ROL === user.ROL_ID; });

  var token = generateToken(user.ID_USUARIO, user.ROL_ID);
  logActivity('LOGIN', user.ID_USUARIO, 'Login exitoso');
  updateRow(CONFIG.SHEETS.USUARIOS, user._row, { ULTIMO_ACCESO: nowGT() });

  return {
    success: true,
    data: {
      token: token,
      user: {
        id: user.ID_USUARIO,
        nombre: user.NOMBRE,
        apellido: user.APELLIDO,
        email: user.EMAIL,
        rolId: user.ROL_ID,
        rolNombre: rolData ? rolData.NOMBRE : 'Sin Rol',
        sede: user.SEDE,
        permisos: permisos
      }
    }
  };
}

function loginGoogle(params) {
  var email = params.email;
  if (!email) return { success: false, error: 'Email requerido' };

  var usuarios = getSheetData(CONFIG.SHEETS.USUARIOS);
  var user = usuarios.find(function(u) { return u.EMAIL === email && u.ESTADO === 'ACTIVO'; });

  if (!user) {
    var inactivo = usuarios.find(function(u) { return u.EMAIL === email; });
    if (inactivo) return { success: false, error: 'Tu cuenta está desactivada.' };
    return { success: false, error: 'Email no registrado. Contacta al administrador.' };
  }

  var permisos = getUserPermissions(user.ROL_ID);
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  var rolData = roles.find(function(r) { return r.ID_ROL === user.ROL_ID; });

  var token = generateToken(user.ID_USUARIO, user.ROL_ID);
  logActivity('LOGIN_GOOGLE', user.ID_USUARIO, 'Login con Google');
  updateRow(CONFIG.SHEETS.USUARIOS, user._row, { ULTIMO_ACCESO: nowGT() });

  return {
    success: true,
    data: {
      token: token,
      user: {
        id: user.ID_USUARIO, nombre: user.NOMBRE, apellido: user.APELLIDO,
        email: user.EMAIL, rolId: user.ROL_ID,
        rolNombre: rolData ? rolData.NOMBRE : 'Sin Rol',
        sede: user.SEDE, permisos: permisos
      }
    }
  };
}

// ==================== INCIDENTES ====================
function getNextTicketNumber() {
  var sheet = getSheet(CONFIG.SHEETS.INCIDENTES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'INC-0001';
  var lastTicket = sheet.getRange(lastRow, 1).getValue();
  var num = parseInt(String(lastTicket).replace('INC-', '')) || 0;
  return 'INC-' + String(num + 1).padStart(4, '0');
}

function getIncidentes(params) {
  var user = params._user;
  var incidentes = getSheetData(CONFIG.SHEETS.INCIDENTES);

  // Si no tiene permiso de ver todas las sedes, filtrar por su sede
  var canSeeAll = user.permisos.indexOf('ver_todos_sedes') !== -1;
  if (!canSeeAll && user.sede && user.sede !== 'TODAS') {
    incidentes = incidentes.filter(function(i) { return i.SEDE === user.sede; });
  }

  // Filtros
  if (params.sede) incidentes = incidentes.filter(function(i) { return i.SEDE === params.sede; });
  if (params.tipo) incidentes = incidentes.filter(function(i) { return i.TIPO_INCIDENCIA === params.tipo; });
  if (params.estado) incidentes = incidentes.filter(function(i) { return i.ESTADO === params.estado; });
  if (params.prioridad) incidentes = incidentes.filter(function(i) { return i.PRIORIDAD === params.prioridad; });
  if (params.fechaDesde) {
    var desde = new Date(params.fechaDesde);
    incidentes = incidentes.filter(function(i) { return new Date(i.FECHA_INCIDENTE) >= desde; });
  }
  if (params.fechaHasta) {
    var hasta = new Date(params.fechaHasta);
    incidentes = incidentes.filter(function(i) { return new Date(i.FECHA_INCIDENTE) <= hasta; });
  }
  if (params.busqueda) {
    var q = params.busqueda.toLowerCase();
    incidentes = incidentes.filter(function(i) {
      return String(i.NO_TICKET).toLowerCase().indexOf(q) !== -1 ||
        String(i.NOMBRE_AFECTADO).toLowerCase().indexOf(q) !== -1 ||
        String(i.APELLIDO_AFECTADO).toLowerCase().indexOf(q) !== -1 ||
        String(i.DPI_AFECTADO).toLowerCase().indexOf(q) !== -1 ||
        String(i.DESCRIPCION_DEL_INCIDENTE).toLowerCase().indexOf(q) !== -1;
    });
  }

  // Paginación
  var page = parseInt(params.page) || 1;
  var limit = parseInt(params.limit) || 25;
  var total = incidentes.length;
  var start = (page - 1) * limit;
  var paginados = incidentes.reverse().slice(start, start + limit);

  var clean = paginados.map(function(i) {
    var copy = {};
    Object.keys(i).forEach(function(k) { if (k !== '_row') copy[k] = i[k]; });
    return copy;
  });

  return {
    success: true,
    data: {
      incidentes: clean,
      pagination: { page: page, limit: limit, total: total, totalPages: Math.ceil(total / limit) }
    }
  };
}

function createIncidente(params) {
  var user = params._user;
  var ticket = getNextTicketNumber();
  var now = nowGT();

  var incidente = {
    NO_TICKET: ticket,
    DPI_AFECTADO: params.dpiAfectado || '',
    NOMBRE_AFECTADO: params.nombreAfectado || '',
    APELLIDO_AFECTADO: params.apellidoAfectado || '',
    TELEFONO_AFECTADO: params.telefonoAfectado || '',
    FECHA_INCIDENTE: params.fechaIncidente || now,
    GESTION_REALIZADA: params.gestionRealizada || '',
    TIPO_INCIDENCIA: params.tipoIncidencia || '',
    DESCRIPCION_DEL_INCIDENTE: params.descripcionIncidente || '',
    DESCRIPCION_DEL_APOYO: params.descripcionApoyo || '',
    USUARIO: user.userId,
    FECHA_REGISTRO: now,
    ID_INCIDENCIA: Utilities.getUuid(),
    SEDE: params.sede || user.sede || '',
    ESTADO: params.estado || 'ABIERTO',
    PRIORIDAD: params.prioridad || 'MEDIA',
    ASIGNADO_A: params.asignadoA || user.userId,
    ULTIMA_ACTUALIZACION: now,
    ACTUALIZADO_POR: user.userId,
    DIRECCION_INCIDENTE: params.direccionIncidente || '',
    ZONA: params.zona || '',
    CANAL_RECEPCION: params.canalRecepcion || '',
    FOTOS: params.fotos || '[]'
  };

  appendRow(CONFIG.SHEETS.INCIDENTES, incidente);
  logActivity('CREAR_INCIDENTE', user.userId, 'Incidente: ' + ticket + ' | Sede: ' + incidente.SEDE);

  return {
    success: true,
    data: { ticket: ticket, id: incidente.ID_INCIDENCIA },
    message: 'Incidente ' + ticket + ' registrado exitosamente'
  };
}

function updateIncidente(params) {
  var user = params._user;
  var incidentes = getSheetData(CONFIG.SHEETS.INCIDENTES);
  var inc = incidentes.find(function(i) {
    return i.ID_INCIDENCIA === params.idIncidencia || i.NO_TICKET === params.noTicket;
  });
  if (!inc) return { success: false, error: 'Incidente no encontrado' };

  var canSeeAll = user.permisos.indexOf('ver_todos_sedes') !== -1;
  if (!canSeeAll && inc.SEDE !== user.sede) {
    return { success: false, error: 'No tienes permisos para editar este incidente' };
  }

  var fieldMap = {
    dpiAfectado: 'DPI_AFECTADO', nombreAfectado: 'NOMBRE_AFECTADO',
    apellidoAfectado: 'APELLIDO_AFECTADO', telefonoAfectado: 'TELEFONO_AFECTADO',
    fechaIncidente: 'FECHA_INCIDENTE', gestionRealizada: 'GESTION_REALIZADA',
    tipoIncidencia: 'TIPO_INCIDENCIA', descripcionIncidente: 'DESCRIPCION_DEL_INCIDENTE',
    descripcionApoyo: 'DESCRIPCION_DEL_APOYO', sede: 'SEDE',
    estado: 'ESTADO', prioridad: 'PRIORIDAD', asignadoA: 'ASIGNADO_A',
    direccionIncidente: 'DIRECCION_INCIDENTE', zona: 'ZONA', canalRecepcion: 'CANAL_RECEPCION',
    fotos: 'FOTOS'
  };

  var updates = {};
  Object.keys(fieldMap).forEach(function(key) {
    if (params[key] !== undefined) updates[fieldMap[key]] = params[key];
  });
  updates.ULTIMA_ACTUALIZACION = nowGT();
  updates.ACTUALIZADO_POR = user.userId;

  updateRow(CONFIG.SHEETS.INCIDENTES, inc._row, updates);
  logActivity('EDITAR_INCIDENTE', user.userId, 'Editado: ' + inc.NO_TICKET);

  return { success: true, message: 'Incidente actualizado' };
}

function deleteIncidente(params) {
  var user = params._user;
  var incidentes = getSheetData(CONFIG.SHEETS.INCIDENTES);
  var inc = incidentes.find(function(i) {
    return i.ID_INCIDENCIA === params.idIncidencia || i.NO_TICKET === params.noTicket;
  });
  if (!inc) return { success: false, error: 'Incidente no encontrado' };

  deleteRow(CONFIG.SHEETS.INCIDENTES, inc._row);
  logActivity('ELIMINAR_INCIDENTE', user.userId, 'Eliminado: ' + inc.NO_TICKET);
  return { success: true, message: 'Incidente eliminado' };
}

function getIncidenteById(params) {
  var incidentes = getSheetData(CONFIG.SHEETS.INCIDENTES);
  var inc = incidentes.find(function(i) {
    return i.ID_INCIDENCIA === params.idIncidencia || i.NO_TICKET === params.noTicket;
  });
  if (!inc) return { success: false, error: 'Incidente no encontrado' };
  var copy = {};
  Object.keys(inc).forEach(function(k) { if (k !== '_row') copy[k] = inc[k]; });
  return { success: true, data: copy };
}

// ==================== ROLES ====================
function getRoles(params) {
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  var clean = roles.map(function(r) {
    return {
      ID_ROL: r.ID_ROL,
      NOMBRE: r.NOMBRE,
      DESCRIPCION: r.DESCRIPCION,
      PERMISOS: r.PERMISOS,
      ESTADO: r.ESTADO,
      ES_SISTEMA: r.ES_SISTEMA
    };
  });
  return { success: true, data: clean };
}

function createRol(params) {
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  if (roles.find(function(r) { return r.NOMBRE === params.nombre; })) {
    return { success: false, error: 'Ya existe un rol con ese nombre' };
  }

  var newRol = {
    ID_ROL: 'ROL-' + String(roles.length + 1).padStart(3, '0'),
    NOMBRE: params.nombre,
    DESCRIPCION: params.descripcion || '',
    PERMISOS: JSON.stringify(params.permisos || []),
    ESTADO: 'ACTIVO',
    ES_SISTEMA: 'NO',
    FECHA_CREACION: nowGT()
  };

  appendRow(CONFIG.SHEETS.ROLES, newRol);
  logActivity('CREAR_ROL', params._user.userId, 'Rol creado: ' + newRol.NOMBRE);
  return { success: true, data: { id: newRol.ID_ROL }, message: 'Rol creado exitosamente' };
}

function updateRol(params) {
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  var rol = roles.find(function(r) { return r.ID_ROL === params.idRol; });
  if (!rol) return { success: false, error: 'Rol no encontrado' };

  var updates = {};
  if (params.nombre) updates.NOMBRE = params.nombre;
  if (params.descripcion !== undefined) updates.DESCRIPCION = params.descripcion;
  if (params.permisos) updates.PERMISOS = JSON.stringify(params.permisos);

  updateRow(CONFIG.SHEETS.ROLES, rol._row, updates);
  logActivity('EDITAR_ROL', params._user.userId, 'Rol editado: ' + rol.NOMBRE);
  return { success: true, message: 'Rol actualizado' };
}

function deleteRol(params) {
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  var rol = roles.find(function(r) { return r.ID_ROL === params.idRol; });
  if (!rol) return { success: false, error: 'Rol no encontrado' };
  if (rol.ES_SISTEMA === 'SI') return { success: false, error: 'No se pueden eliminar roles del sistema' };

  // Verificar que no hay usuarios asignados
  var usuarios = getSheetData(CONFIG.SHEETS.USUARIOS);
  var enUso = usuarios.filter(function(u) { return u.ROL_ID === params.idRol; });
  if (enUso.length > 0) {
    return { success: false, error: 'Este rol tiene ' + enUso.length + ' usuario(s) asignados. Reasígnalos primero.' };
  }

  deleteRow(CONFIG.SHEETS.ROLES, rol._row);
  logActivity('ELIMINAR_ROL', params._user.userId, 'Rol eliminado: ' + rol.NOMBRE);
  return { success: true, message: 'Rol eliminado' };
}

function getPermisosDisponibles(params) {
  return {
    success: true,
    data: PERMISOS.map(function(p) {
      var labels = {
        'ver_incidentes': 'Ver incidentes de su sede',
        'crear_incidentes': 'Crear nuevos incidentes',
        'editar_incidentes': 'Editar incidentes existentes',
        'eliminar_incidentes': 'Eliminar incidentes',
        'ver_todos_sedes': 'Ver incidentes de TODAS las sedes',
        'ver_reportes': 'Acceder a la sección de reportes',
        'exportar_reportes': 'Exportar reportes (Excel/PDF)',
        'ver_dashboard': 'Ver el dashboard con métricas',
        'gestionar_usuarios': 'Crear, editar y desactivar usuarios',
        'gestionar_roles': 'Crear y administrar roles',
        'gestionar_catalogos': 'Administrar catálogos del sistema',
        'ver_log_actividad': 'Ver el log de actividad'
      };
      return { id: p, label: labels[p] || p };
    })
  };
}

// ==================== USUARIOS ====================
function getUsuarios(params) {
  var usuarios = getSheetData(CONFIG.SHEETS.USUARIOS);
  var roles = getSheetData(CONFIG.SHEETS.ROLES);
  var clean = usuarios.map(function(u) {
    var rol = roles.find(function(r) { return r.ID_ROL === u.ROL_ID; });
    return {
      ID_USUARIO: u.ID_USUARIO, USERNAME: u.USERNAME,
      NOMBRE: u.NOMBRE, APELLIDO: u.APELLIDO,
      EMAIL: u.EMAIL, ROL_ID: u.ROL_ID,
      ROL_NOMBRE: rol ? rol.NOMBRE : 'Sin Rol',
      SEDE: u.SEDE, ESTADO: u.ESTADO,
      FECHA_CREACION: u.FECHA_CREACION,
      ULTIMO_ACCESO: u.ULTIMO_ACCESO
    };
  });
  return { success: true, data: clean };
}

function createUsuario(params) {
  var usuarios = getSheetData(CONFIG.SHEETS.USUARIOS);
  if (usuarios.find(function(u) { return u.USERNAME === params.username; })) {
    return { success: false, error: 'El username ya existe' };
  }
  if (params.email && usuarios.find(function(u) { return u.EMAIL === params.email; })) {
    return { success: false, error: 'El email ya está registrado' };
  }

  var newUser = {
    ID_USUARIO: 'USR-' + String(usuarios.length + 1).padStart(4, '0'),
    USERNAME: params.username,
    PASSWORD_HASH: hashPassword(params.password),
    NOMBRE: params.nombre,
    APELLIDO: params.apellido,
    EMAIL: params.email || '',
    ROL_ID: params.rolId || 'ROL-003',
    SEDE: params.sede || '',
    ESTADO: 'ACTIVO',
    GOOGLE_ID: '',
    FECHA_CREACION: nowGT(),
    ULTIMO_ACCESO: ''
  };

  appendRow(CONFIG.SHEETS.USUARIOS, newUser);
  logActivity('CREAR_USUARIO', params._user.userId, 'Usuario: ' + newUser.USERNAME);
  return { success: true, data: { id: newUser.ID_USUARIO }, message: 'Usuario creado' };
}

function updateUsuario(params) {
  var usuarios = getSheetData(CONFIG.SHEETS.USUARIOS);
  var user = usuarios.find(function(u) { return u.ID_USUARIO === params.idUsuario; });
  if (!user) return { success: false, error: 'Usuario no encontrado' };

  var updates = {};
  if (params.nombre) updates.NOMBRE = params.nombre;
  if (params.apellido) updates.APELLIDO = params.apellido;
  if (params.email) updates.EMAIL = params.email;
  if (params.rolId) updates.ROL_ID = params.rolId;
  if (params.sede) updates.SEDE = params.sede;
  if (params.password) updates.PASSWORD_HASH = hashPassword(params.password);

  updateRow(CONFIG.SHEETS.USUARIOS, user._row, updates);
  logActivity('EDITAR_USUARIO', params._user.userId, 'Editado: ' + user.USERNAME);
  return { success: true, message: 'Usuario actualizado' };
}

function toggleUsuario(params) {
  var usuarios = getSheetData(CONFIG.SHEETS.USUARIOS);
  var user = usuarios.find(function(u) { return u.ID_USUARIO === params.idUsuario; });
  if (!user) return { success: false, error: 'Usuario no encontrado' };
  var newState = user.ESTADO === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
  updateRow(CONFIG.SHEETS.USUARIOS, user._row, { ESTADO: newState });
  logActivity('TOGGLE_USUARIO', params._user.userId, user.USERNAME + ' → ' + newState);
  return { success: true, message: 'Estado: ' + newState };
}

// ==================== CATÁLOGOS ====================
function getCatalogos(params) {
  var sedes = getSheetData(CONFIG.SHEETS.CATALOGO_SEDES).map(function(s) {
    var c = {}; Object.keys(s).forEach(function(k) { if (k !== '_row') c[k] = s[k]; }); return c;
  });
  var tipos = getSheetData(CONFIG.SHEETS.CATALOGO_TIPOS).map(function(t) {
    var c = {}; Object.keys(t).forEach(function(k) { if (k !== '_row') c[k] = t[k]; }); return c;
  });
  var gestiones = getSheetData(CONFIG.SHEETS.CATALOGO_GESTIONES).map(function(g) {
    var c = {}; Object.keys(g).forEach(function(k) { if (k !== '_row') c[k] = g[k]; }); return c;
  });
  return { success: true, data: { sedes: sedes, tiposIncidencia: tipos, gestiones: gestiones } };
}

function addCatalogoItem(params) {
  var sheetMap = { sedes: CONFIG.SHEETS.CATALOGO_SEDES, tipos: CONFIG.SHEETS.CATALOGO_TIPOS, gestiones: CONFIG.SHEETS.CATALOGO_GESTIONES };
  var sheetName = sheetMap[params.catalogo];
  if (!sheetName) return { success: false, error: 'Catálogo no válido' };
  appendRow(sheetName, params.item);
  logActivity('ADD_CATALOGO', params._user.userId, 'Agregado a ' + params.catalogo);
  return { success: true, message: 'Item agregado' };
}

function deleteCatalogoItem(params) {
  var sheetMap = { sedes: CONFIG.SHEETS.CATALOGO_SEDES, tipos: CONFIG.SHEETS.CATALOGO_TIPOS, gestiones: CONFIG.SHEETS.CATALOGO_GESTIONES };
  var sheetName = sheetMap[params.catalogo];
  if (!sheetName) return { success: false, error: 'Catálogo no válido' };
  var data = getSheetData(sheetName);
  var item = data.find(function(d) { return d.ID === params.itemId || d.CODIGO === params.itemId; });
  if (!item) return { success: false, error: 'Item no encontrado' };
  deleteRow(sheetName, item._row);
  logActivity('DEL_CATALOGO', params._user.userId, 'Eliminado de ' + params.catalogo);
  return { success: true, message: 'Item eliminado' };
}

// ==================== DASHBOARD ====================
function getDashboardData(params) {
  var user = params._user;
  var incidentes = getSheetData(CONFIG.SHEETS.INCIDENTES);

  var canSeeAll = user.permisos.indexOf('ver_todos_sedes') !== -1;
  if (!canSeeAll && user.sede && user.sede !== 'TODAS') {
    incidentes = incidentes.filter(function(i) { return i.SEDE === user.sede; });
  }

  var total = incidentes.length;
  var porEstado = {}, porSede = {}, porTipo = {}, porPrioridad = {}, porCanal = {};

  incidentes.forEach(function(i) {
    var e = i.ESTADO || 'SIN_ESTADO'; porEstado[e] = (porEstado[e] || 0) + 1;
    var s = i.SEDE || 'SIN_SEDE'; porSede[s] = (porSede[s] || 0) + 1;
    var t = i.TIPO_INCIDENCIA || 'SIN_TIPO'; porTipo[t] = (porTipo[t] || 0) + 1;
    var p = i.PRIORIDAD || 'MEDIA'; porPrioridad[p] = (porPrioridad[p] || 0) + 1;
    var c = i.CANAL_RECEPCION || 'SIN_CANAL'; porCanal[c] = (porCanal[c] || 0) + 1;
  });

  // Tendencia 30 días
  var hoy = new Date();
  var hace30 = new Date(hoy.getTime() - 30 * 86400000);
  var tendencia = {};
  for (var d = new Date(hace30); d <= hoy; d.setDate(d.getDate() + 1)) {
    tendencia[Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd')] = 0;
  }
  incidentes.forEach(function(i) {
    try {
      var fecha = new Date(i.FECHA_REGISTRO || i.FECHA_INCIDENTE);
      if (fecha >= hace30) {
        var key = Utilities.formatDate(fecha, CONFIG.TIMEZONE, 'yyyy-MM-dd');
        if (tendencia.hasOwnProperty(key)) tendencia[key]++;
      }
    } catch(e) {}
  });

  var ultimos = incidentes.slice(-10).reverse().map(function(i) {
    var c = {}; Object.keys(i).forEach(function(k) { if (k !== '_row') c[k] = i[k]; }); return c;
  });

  return {
    success: true,
    data: {
      total: total,
      porEstado: porEstado, porSede: porSede,
      porTipo: porTipo, porPrioridad: porPrioridad, porCanal: porCanal,
      tendencia: tendencia, ultimos: ultimos,
      abiertos: porEstado['ABIERTO'] || 0,
      enProceso: porEstado['EN_PROCESO'] || 0,
      cerrados: porEstado['CERRADO'] || 0,
      escalados: porEstado['ESCALADO'] || 0
    }
  };
}

// ==================== REPORTES ====================
function exportReport(params) {
  var user = params._user;
  var incidentes = getSheetData(CONFIG.SHEETS.INCIDENTES);

  var canSeeAll = user.permisos.indexOf('ver_todos_sedes') !== -1;
  if (!canSeeAll && user.sede && user.sede !== 'TODAS') {
    incidentes = incidentes.filter(function(i) { return i.SEDE === user.sede; });
  }
  if (params.sede) incidentes = incidentes.filter(function(i) { return i.SEDE === params.sede; });
  if (params.tipo) incidentes = incidentes.filter(function(i) { return i.TIPO_INCIDENCIA === params.tipo; });
  if (params.estado) incidentes = incidentes.filter(function(i) { return i.ESTADO === params.estado; });
  if (params.fechaDesde) incidentes = incidentes.filter(function(i) { return new Date(i.FECHA_INCIDENTE) >= new Date(params.fechaDesde); });
  if (params.fechaHasta) incidentes = incidentes.filter(function(i) { return new Date(i.FECHA_INCIDENTE) <= new Date(params.fechaHasta); });

  var clean = incidentes.map(function(i) {
    var c = {}; Object.keys(i).forEach(function(k) { if (k !== '_row') c[k] = i[k]; }); return c;
  });

  logActivity('EXPORTAR_REPORTE', user.userId, 'Registros: ' + clean.length);

  return {
    success: true,
    data: {
      incidentes: clean,
      generadoPor: user.nombre + ' ' + (user.apellido || ''),
      fechaGeneracion: nowGT(),
      totalRegistros: clean.length,
      filtros: {
        sede: params.sede || 'Todas', tipo: params.tipo || 'Todos',
        estado: params.estado || 'Todos',
        fechaDesde: params.fechaDesde || 'N/A', fechaHasta: params.fechaHasta || 'N/A'
      }
    }
  };
}

// ==================== LOG ====================
function logActivity(action, userId, detail) {
  try {
    appendRow(CONFIG.SHEETS.LOG_ACTIVIDAD, {
      FECHA: nowGT(), ACCION: action, USUARIO: userId, DETALLE: detail, IP: ''
    });
  } catch (e) {}
}

// ==================== INICIALIZACIÓN ====================
function initializeSystem() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  var sheetsConfig = {};

  sheetsConfig[CONFIG.SHEETS.INCIDENTES] = [
    'NO_TICKET', 'DPI_AFECTADO', 'NOMBRE_AFECTADO', 'APELLIDO_AFECTADO',
    'TELEFONO_AFECTADO', 'FECHA_INCIDENTE', 'GESTION_REALIZADA', 'TIPO_INCIDENCIA',
    'DESCRIPCION_DEL_INCIDENTE', 'DESCRIPCION_DEL_APOYO', 'USUARIO', 'FECHA_REGISTRO',
    'ID_INCIDENCIA', 'SEDE', 'ESTADO', 'PRIORIDAD', 'ASIGNADO_A',
    'ULTIMA_ACTUALIZACION', 'ACTUALIZADO_POR',
    'DIRECCION_INCIDENTE', 'ZONA', 'CANAL_RECEPCION', 'FOTOS'
  ];

  sheetsConfig[CONFIG.SHEETS.USUARIOS] = [
    'ID_USUARIO', 'USERNAME', 'PASSWORD_HASH', 'NOMBRE', 'APELLIDO',
    'EMAIL', 'ROL_ID', 'SEDE', 'ESTADO', 'GOOGLE_ID',
    'FECHA_CREACION', 'ULTIMO_ACCESO'
  ];

  sheetsConfig[CONFIG.SHEETS.ROLES] = [
    'ID_ROL', 'NOMBRE', 'DESCRIPCION', 'PERMISOS', 'ESTADO', 'ES_SISTEMA', 'FECHA_CREACION'
  ];

  sheetsConfig[CONFIG.SHEETS.CATALOGO_SEDES] = ['ID', 'CODIGO', 'NOMBRE', 'DIRECCION', 'ESTADO'];
  sheetsConfig[CONFIG.SHEETS.CATALOGO_TIPOS] = ['ID', 'CODIGO', 'NOMBRE', 'DESCRIPCION', 'ICONO', 'ESTADO'];
  sheetsConfig[CONFIG.SHEETS.CATALOGO_GESTIONES] = ['ID', 'CODIGO', 'NOMBRE', 'DESCRIPCION', 'ESTADO'];
  sheetsConfig[CONFIG.SHEETS.LOG_ACTIVIDAD] = ['FECHA', 'ACCION', 'USUARIO', 'DETALLE', 'IP'];

  // Crear hojas
  Object.keys(sheetsConfig).forEach(function(name) {
    var headers = sheetsConfig[name];
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    // Limpiar y escribir headers
    if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
      sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).clearContent();
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#10069f').setFontColor('white');
  });

  // ====== ROLES POR DEFECTO ======
  var rolesSheet = ss.getSheetByName(CONFIG.SHEETS.ROLES);
  if (rolesSheet.getLastRow() < 2) {
    var rolesData = [
      ['ROL-001', 'Administrador General',
        'Control total del sistema',
        JSON.stringify(PERMISOS), // TODOS los permisos
        'ACTIVO', 'SI', nowGT()],
      ['ROL-002', 'Supervisor de Sede',
        'Supervisión de sede con reportes',
        JSON.stringify(['ver_incidentes','crear_incidentes','editar_incidentes','ver_reportes','exportar_reportes','ver_dashboard']),
        'ACTIVO', 'SI', nowGT()],
      ['ROL-003', 'Operador de Atención',
        'Registro y seguimiento de incidentes ciudadanos',
        JSON.stringify(['ver_incidentes','crear_incidentes','editar_incidentes']),
        'ACTIVO', 'SI', nowGT()],
      ['ROL-004', 'Consultor',
        'Solo lectura de incidentes',
        JSON.stringify(['ver_incidentes','ver_dashboard']),
        'ACTIVO', 'SI', nowGT()]
    ];
    rolesData.forEach(function(r) { rolesSheet.appendRow(r); });
  }

  // ====== USUARIO ADMIN ======
  var usersSheet = ss.getSheetByName(CONFIG.SHEETS.USUARIOS);
  if (usersSheet.getLastRow() < 2) {
    usersSheet.appendRow([
      'USR-0001', 'admin', hashPassword('admin123'), 'Administrador',
      'General', 'admin@muni.gob.gt', 'ROL-001', 'TODAS',
      'ACTIVO', '', nowGT(), ''
    ]);
  }

  // ====== 7 SEDES ======
  var sedesSheet = ss.getSheetByName(CONFIG.SHEETS.CATALOGO_SEDES);
  if (sedesSheet.getLastRow() < 2) {
    [
      ['S01', 'CENTRAL', 'Sede Central', 'Centro Cívico, Zona 1', 'ACTIVO'],
      ['S02', 'NORTE', 'Sede Norte', 'Zona 17-18', 'ACTIVO'],
      ['S03', 'SUR', 'Sede Sur', 'Zona 11-12', 'ACTIVO'],
      ['S04', 'ORIENTE', 'Sede Oriente', 'Zona 9-10', 'ACTIVO'],
      ['S05', 'OCCIDENTE', 'Sede Occidente', 'Mixco', 'ACTIVO'],
      ['S06', 'METRO', 'Sede Metropolitana', 'Zona 4-5', 'ACTIVO'],
      ['S07', 'REGIONAL', 'Sede Regional', 'Villa Nueva', 'ACTIVO']
    ].forEach(function(s) { sedesSheet.appendRow(s); });
  }

  // ====== TIPOS DE INCIDENCIA MUNICIPAL ======
  var tiposSheet = ss.getSheetByName(CONFIG.SHEETS.CATALOGO_TIPOS);
  if (tiposSheet.getLastRow() < 2) {
    [
      ['T01', 'BACH', 'Bache / Vía dañada', 'Daño en calles, avenidas o puentes', '🕳️', 'ACTIVO'],
      ['T02', 'ALUM', 'Alumbrado público', 'Falta de luz, poste dañado, cables caídos', '💡', 'ACTIVO'],
      ['T03', 'AGUA', 'Agua y drenajes', 'Fuga de agua, drenaje tapado, inundación', '🚰', 'ACTIVO'],
      ['T04', 'DESE', 'Desechos / Basura', 'Acumulación de basura, basurero clandestino', '🗑️', 'ACTIVO'],
      ['T05', 'ARBO', 'Árboles / Áreas verdes', 'Árbol caído, poda, jardines dañados', '🌳', 'ACTIVO'],
      ['T06', 'SEGU', 'Seguridad ciudadana', 'Robos, vandalismo, zonas inseguras', '🛡️', 'ACTIVO'],
      ['T07', 'RUID', 'Ruido / Contaminación', 'Ruido excesivo, contaminación ambiental', '📢', 'ACTIVO'],
      ['T08', 'TRAN', 'Tránsito / Señalización', 'Semáforos dañados, señales faltantes', '🚦', 'ACTIVO'],
      ['T09', 'OBST', 'Obstrucción vía pública', 'Construcción sin permiso, invasión de espacio', '🚧', 'ACTIVO'],
      ['T10', 'ANIM', 'Animales en vía pública', 'Animales sueltos, plagas, animales heridos', '🐕', 'ACTIVO'],
      ['T11', 'TRAM', 'Trámites y servicios', 'Consultas sobre trámites municipales', '📄', 'ACTIVO'],
      ['T12', 'QUEJ', 'Queja / Denuncia', 'Queja por servicio municipal deficiente', '📣', 'ACTIVO'],
      ['T13', 'EMER', 'Emergencia', 'Situación de emergencia que requiere atención inmediata', '🚨', 'ACTIVO'],
      ['T14', 'OTRO', 'Otros', 'Otros incidentes no categorizados', '📌', 'ACTIVO']
    ].forEach(function(t) { tiposSheet.appendRow(t); });
  }

  // ====== GESTIONES ======
  var gestSheet = ss.getSheetByName(CONFIG.SHEETS.CATALOGO_GESTIONES);
  if (gestSheet.getLastRow() < 2) {
    [
      ['G01', 'ORIENT', 'Orientación al ciudadano', 'Se brindó información al solicitante', 'ACTIVO'],
      ['G02', 'DERIV', 'Derivado a dependencia', 'Se trasladó el caso al área competente', 'ACTIVO'],
      ['G03', 'INSPEC', 'Inspección en campo', 'Se envió personal para verificación', 'ACTIVO'],
      ['G04', 'REPAR', 'Reparación / Mantenimiento', 'Se realizó reparación o mantenimiento', 'ACTIVO'],
      ['G05', 'ESCAL', 'Escalado a jefatura', 'Caso escalado a nivel superior', 'ACTIVO'],
      ['G06', 'RESOL', 'Resuelto en línea', 'Incidente resuelto durante la llamada/visita', 'ACTIVO'],
      ['G07', 'SEGUI', 'En seguimiento', 'Caso requiere seguimiento posterior', 'ACTIVO'],
      ['G08', 'COORD', 'Coordinación interinstitucional', 'Se coordinó con otra institución (PNC, CONRED, etc.)', 'ACTIVO']
    ].forEach(function(g) { gestSheet.appendRow(g); });
  }

  Logger.log('Sistema Municipal v2 inicializado correctamente. Admin: admin / admin123');
  return 'OK';
}
