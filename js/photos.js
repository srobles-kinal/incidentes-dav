// ============================================================
//  PHOTOS MODULE - Compresión y manejo de fotos (max 3)
//  Comprime a max 800px y ~80% quality JPEG = ~60-100KB
// ============================================================
var Photos = (function() {
  var MAX_PHOTOS = 3;
  var MAX_WIDTH = 800;
  var MAX_HEIGHT = 800;
  var QUALITY = 0.7;
  var photos = []; // Array of base64 strings

  function getPhotos() { return photos; }
  function setPhotos(arr) { photos = arr || []; }
  function clear() { photos = []; }

  function compressImage(file) {
    return new Promise(function(resolve, reject) {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Archivo no es una imagen'));
        return;
      }

      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var w = img.width, h = img.height;

          // Redimensionar manteniendo proporción
          if (w > MAX_WIDTH) { h = h * (MAX_WIDTH / w); w = MAX_WIDTH; }
          if (h > MAX_HEIGHT) { w = w * (MAX_HEIGHT / h); h = MAX_HEIGHT; }

          canvas.width = Math.round(w);
          canvas.height = Math.round(h);

          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          var compressed = canvas.toDataURL('image/jpeg', QUALITY);

          // Verificar tamaño (~base64 es 33% más grande que binario)
          var sizeKB = Math.round((compressed.length * 3) / 4 / 1024);
          console.log('[Photos] Comprimido: ' + img.width + 'x' + img.height + ' → ' + canvas.width + 'x' + canvas.height + ' (' + sizeKB + 'KB)');

          resolve(compressed);
        };
        img.onerror = function() { reject(new Error('Error al cargar imagen')); };
        img.src = e.target.result;
      };
      reader.onerror = function() { reject(new Error('Error al leer archivo')); };
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(input, slotIndex) {
    var file = input.files && input.files[0];
    if (!file) return;

    try {
      Toast.show('Comprimiendo imagen...', 'info', 2000);
      var compressed = await compressImage(file);
      photos[slotIndex] = compressed;
      renderSlots();
    } catch(err) {
      Toast.show('Error al procesar imagen: ' + err.message, 'error');
    }
  }

  function removePhoto(index) {
    photos[index] = null;
    // Compactar: mover fotos para que no queden huecos
    photos = photos.filter(function(p) { return !!p; });
    renderSlots();
  }

  function renderSlots() {
    var container = document.getElementById('photoUploadArea');
    if (!container) return;

    var html = '';
    for (var i = 0; i < MAX_PHOTOS; i++) {
      if (photos[i]) {
        // Slot con foto
        html += '<div class="photo-slot has-photo">' +
          '<img src="' + photos[i] + '" alt="Foto ' + (i+1) + '">' +
          '<button type="button" class="photo-remove" onclick="Photos.removePhoto(' + i + ')" title="Quitar">×</button>' +
        '</div>';
      } else if (i <= photos.filter(function(p){return !!p;}).length) {
        // Slot vacío disponible
        html += '<div class="photo-slot" onclick="this.querySelector(\'input\').click()">' +
          '<span class="photo-icon">📷</span>' +
          '<span class="photo-label">Foto ' + (i+1) + '</span>' +
          '<input type="file" accept="image/*" capture="environment" onchange="Photos.handleFileSelect(this,' + i + ')">' +
        '</div>';
      }
    }

    container.innerHTML = html;
  }

  // Renderizar HTML del componente de fotos
  function getUploadHTML() {
    return '<div class="form-group full-width">' +
      '<label>Fotografías (máx. 3, se comprimen automáticamente)</label>' +
      '<div class="photo-upload-area" id="photoUploadArea"></div>' +
    '</div>';
  }

  // Para ver fotos en el detalle del incidente
  function getGalleryHTML(photosStr) {
    if (!photosStr) return '';
    var arr = [];
    try { arr = JSON.parse(photosStr); } catch(e) { return ''; }
    if (!arr.length) return '';

    return '<div style="margin-top:12px"><strong>Fotografías:</strong>' +
      '<div class="photo-gallery">' +
      arr.map(function(src, i) {
        return '<img src="' + src + '" alt="Foto ' + (i+1) + '" onclick="Photos.openLightbox(\'' + src.substring(0, 50) + '\',' + i + ')" data-idx="' + i + '">';
      }).join('') +
      '</div></div>';
  }

  function openLightbox(prefix, idx) {
    // Buscar la imagen completa del incidente visible
    var imgs = document.querySelectorAll('.photo-gallery img');
    var src = imgs[idx] ? imgs[idx].src : '';
    if (!src) return;

    var lb = document.createElement('div');
    lb.className = 'photo-lightbox';
    lb.innerHTML = '<img src="' + src + '">';
    lb.onclick = function() { lb.remove(); };
    document.body.appendChild(lb);
  }

  return {
    getPhotos: getPhotos, setPhotos: setPhotos, clear: clear,
    compressImage: compressImage, handleFileSelect: handleFileSelect,
    removePhoto: removePhoto, renderSlots: renderSlots,
    getUploadHTML: getUploadHTML, getGalleryHTML: getGalleryHTML,
    openLightbox: openLightbox
  };
})();
