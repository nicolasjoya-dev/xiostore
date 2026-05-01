/* ═══════════════════════════════════════════════════════════════════════════
   MAISON — app.js  |  SPA Router + UI Logic
═══════════════════════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────────────────────────
let allProducts   = [];
let currentModal  = null;
let selectedSize  = null;
let selectedColor = null;
let isAdmin       = false;
let editingId     = null;

const WA_NUMBER = '573001234567'; // ← Cambia este número

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Router ───────────────────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const target = $(`page-${page}`);
  if (target) target.classList.add('active');

  const link = document.querySelector(`[data-page="${page}"]`);
  if (link) link.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'catalogo')  loadCatalog();
  if (page === 'inicio')    loadFeatured();
  if (page === 'admin')     checkAdminAuth();
}

// Intercept anchor data-page clicks
document.addEventListener('click', e => {
  const link = e.target.closest('[data-page]');
  if (link) { e.preventDefault(); navigate(link.dataset.page); }
});

// ─── Nav scroll ───────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navHeader');
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

// ─── Mobile nav toggle ────────────────────────────────────────────────────────
$('navToggle').addEventListener('click', () => {
  $('navLinks').classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-header')) $('navLinks').classList.remove('open');
});

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return res.json();
}

// ─── Format currency ──────────────────────────────────────────────────────────
function formatCOP(n) {
  return '$ ' + Number(n).toLocaleString('es-CO') + ' COP';
}

// ─── Product card HTML ────────────────────────────────────────────────────────
function cardHTML(p) {
  const imgContent = p.imagen && !p.imagen.includes('placeholder')
    ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="card-placeholder" style="display:none">◈</div>`
    : `<div class="card-placeholder">◈</div>`;

  return `
    <div class="product-card" data-id="${p.id}" onclick="openModal('${p.id}')">
      <div class="card-img">
        ${p.destacado ? '<span class="card-badge">Destacado</span>' : ''}
        ${imgContent}
      </div>
      <div class="card-body">
        <div class="card-cat">${p.categoria}</div>
        <div class="card-name">${p.nombre}</div>
        <div class="card-price">${formatCOP(p.precio)}</div>
        <div class="card-actions">
          <button class="card-btn-buy" onclick="event.stopPropagation(); quickBuy('${p.id}')">Comprar</button>
          <button class="card-btn-info" onclick="event.stopPropagation(); openModal('${p.id}')">Info</button>
        </div>
      </div>
    </div>`;
}

// ─── Load featured ────────────────────────────────────────────────────────────
async function loadFeatured() {
  const grid = $('featuredGrid');
  try {
    const data = await apiFetch('/api/productos?destacado=true');
    allProducts = allProducts.length ? allProducts : await apiFetch('/api/productos');
    grid.innerHTML = data.length
      ? data.map(cardHTML).join('')
      : '<p style="color:var(--muted);grid-column:1/-1">No hay prendas destacadas aún.</p>';
  } catch {
    grid.innerHTML = '<p style="color:var(--muted)">Error al cargar productos.</p>';
  }
}

// ─── Load catalog ─────────────────────────────────────────────────────────────
async function loadCatalog(categoria = 'todos') {
  const grid = $('catalogGrid');
  grid.innerHTML = '<div class="skeleton-card"></div>'.repeat(6);
  try {
    const url = categoria === 'todos' ? '/api/productos' : `/api/productos?categoria=${categoria}`;
    const data = await apiFetch(url);
    allProducts = data;
    grid.innerHTML = data.length
      ? data.map(cardHTML).join('')
      : '<p style="color:var(--muted);grid-column:1/-1">No hay prendas en esta categoría.</p>';
  } catch {
    grid.innerHTML = '<p style="color:var(--muted)">Error al cargar el catálogo.</p>';
  }
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadCatalog(btn.dataset.cat);
  });
});

// ─── MODAL ────────────────────────────────────────────────────────────────────
async function openModal(id) {
  let product = allProducts.find(p => p.id === id);
  if (!product) {
    try { product = await apiFetch(`/api/productos/${id}`); } catch { return; }
  }
  currentModal = product;
  selectedSize  = null;
  selectedColor = null;

  $('modalCat').textContent   = product.categoria;
  $('modalName').textContent  = product.nombre;
  $('modalPrice').textContent = formatCOP(product.precio);
  $('modalDesc').textContent  = product.descripcion;
  $('infoMaterial').textContent = product.material  || '—';
  $('infoCuidados').textContent = product.cuidados || '—';

  const imgEl = $('modalImg');
  imgEl.src = product.imagen || '';
  imgEl.alt = product.nombre;
  imgEl.style.display = (product.imagen && !product.imagen.includes('placeholder')) ? 'block' : 'none';

  // Sizes
  $('sizeOptions').innerHTML = (product.tallas || []).map(t =>
    `<button class="size-btn" onclick="selectSize(this,'${t}')">${t}</button>`).join('');

  // Colors
  $('colorOptions').innerHTML = (product.colores || []).map(c =>
    `<button class="color-btn" onclick="selectColor(this,'${c}')">${c}</button>`).join('');

  $('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('productModal').classList.remove('open');
  document.body.style.overflow = '';
  currentModal = null;
}

$('modalClose').addEventListener('click', closeModal);
$('productModal').addEventListener('click', e => {
  if (e.target === $('productModal')) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function selectSize(btn, size) {
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSize = size;
}
function selectColor(btn, color) {
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedColor = color;
}

$('btnBuy').addEventListener('click', () => {
  if (!currentModal) return;
  if ((currentModal.tallas || []).length && !selectedSize) {
    showToast('Por favor selecciona una talla ✦'); return;
  }
  if ((currentModal.colores || []).length && !selectedColor) {
    showToast('Por favor selecciona un color ✦'); return;
  }
  sendToWhatsApp(currentModal, selectedSize, selectedColor);
});

function quickBuy(id) {
  openModal(id);
}

function sendToWhatsApp(product, size, color) {
  let msg = `¡Hola! Me interesa el *${product.nombre}*`;
  if (size)  msg += ` en talla *${size}*`;
  if (color) msg += ` en color *${color}*`;
  msg += `. Precio: *${formatCOP(product.precio)}*. ¿Tienen disponibilidad?`;
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ─── ADMIN AUTH ───────────────────────────────────────────────────────────────
async function checkAdminAuth() {
  const res = await apiFetch('/api/admin/check');
  if (res.autenticado) {
    showAdminPanel();
  } else {
    $('adminLogin').classList.remove('hidden');
    $('adminPanel').classList.add('hidden');
  }
}

$('btnLogin').addEventListener('click', async () => {
  const u = $('loginUser').value.trim();
  const p = $('loginPass').value.trim();
  if (!u || !p) return;

  const res = await apiFetch('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ usuario: u, password: p })
  });

  if (res.success) {
    $('loginError').classList.add('hidden');
    showAdminPanel();
  } else {
    $('loginError').textContent = 'Usuario o contraseña incorrectos';
    $('loginError').classList.remove('hidden');
  }
});

// Login on Enter
[$('loginUser'), $('loginPass')].forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') $('btnLogin').click(); });
});

$('btnLogout').addEventListener('click', async () => {
  await apiFetch('/api/admin/logout', { method: 'POST' });
  isAdmin = false;
  $('adminPanel').classList.add('hidden');
  $('adminLogin').classList.remove('hidden');
});

function showAdminPanel() {
  isAdmin = true;
  $('adminLogin').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  loadAdminProducts();
}

// ─── ADMIN TABS ───────────────────────────────────────────────────────────────
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'lista') loadAdminProducts();
  });
});

// ─── ADMIN PRODUCT LIST ───────────────────────────────────────────────────────
async function loadAdminProducts(query = '') {
  const list = $('adminProductList');
  list.innerHTML = '<p style="color:var(--muted)">Cargando...</p>';
  try {
    const data = await apiFetch('/api/productos');
    const filtered = query
      ? data.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()))
      : data;

    if (!filtered.length) {
      list.innerHTML = '<p style="color:var(--muted)">No se encontraron productos.</p>';
      return;
    }

    list.innerHTML = filtered.map(p => `
      <div class="admin-product-item">
        <div class="admin-product-thumb">
          ${p.imagen && !p.imagen.includes('placeholder')
            ? `<img src="${p.imagen}" alt="${p.nombre}" onerror="this.outerHTML='◈'" />`
            : '◈'}
        </div>
        <div class="admin-product-info">
          <h3>${p.nombre}</h3>
          <p>${p.categoria} · ${formatCOP(p.precio)}</p>
        </div>
        <span class="admin-product-badge ${p.destacado ? 'destacado' : ''}">${p.destacado ? '★ Destacado' : 'Normal'}</span>
        <div class="admin-product-actions">
          <button class="btn-edit" onclick="editProduct('${p.id}')">Editar</button>
          <button class="btn-delete" onclick="deleteProduct('${p.id}','${p.nombre}')">Eliminar</button>
        </div>
      </div>`).join('');
  } catch {
    list.innerHTML = '<p style="color:var(--error)">Error al cargar productos.</p>';
  }
}

$('adminSearch').addEventListener('input', e => loadAdminProducts(e.target.value));

// ─── EDIT PRODUCT ─────────────────────────────────────────────────────────────
async function editProduct(id) {
  let product;
  try { product = await apiFetch(`/api/productos/${id}`); } catch { return; }

  editingId = id;
  $('editId').value = id;
  $('formTitle').textContent = 'Editar Producto';
  $('fNombre').value     = product.nombre;
  $('fPrecio').value     = product.precio;
  $('fCategoria').value  = product.categoria;
  $('fDescripcion').value = product.descripcion;
  $('fMaterial').value   = product.material || '';
  $('fCuidados').value   = product.cuidados || '';
  $('fTallas').value     = (product.tallas || []).join(', ');
  $('fColores').value    = (product.colores || []).join(', ');
  $('fDestacado').value  = String(product.destacado);

  if (product.imagen && !product.imagen.includes('placeholder')) {
    $('imgPreview').src = product.imagen;
    $('imgPreview').classList.remove('hidden');
  }

  // Switch to form tab
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="nuevo"]').classList.add('active');
  $('tab-nuevo').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── DELETE PRODUCT ───────────────────────────────────────────────────────────
async function deleteProduct(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    const res = await apiFetch(`/api/admin/productos/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast(`"${nombre}" eliminado ✓`);
      loadAdminProducts();
    } else {
      showToast('Error al eliminar el producto');
    }
  } catch {
    showToast('Error de conexión');
  }
}

// ─── IMAGE PREVIEW ─────────────────────────────────────────────────────────────
$('fImagen').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    $('imgPreview').src = ev.target.result;
    $('imgPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

// ─── PRODUCT FORM SUBMIT ──────────────────────────────────────────────────────
$('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('btnSubmit');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  const formData = new FormData();
  formData.append('nombre',      $('fNombre').value);
  formData.append('precio',      $('fPrecio').value);
  formData.append('categoria',   $('fCategoria').value);
  formData.append('descripcion', $('fDescripcion').value);
  formData.append('material',    $('fMaterial').value);
  formData.append('cuidados',    $('fCuidados').value);
  formData.append('tallas',      $('fTallas').value);
  formData.append('colores',     $('fColores').value);
  formData.append('destacado',   $('fDestacado').value);
  const imgFile = $('fImagen').files[0];
  if (imgFile) formData.append('imagen', imgFile);

  try {
    const url    = editingId ? `/api/admin/productos/${editingId}` : '/api/admin/productos';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: formData });
    const data = await res.json();

    if (data.success) {
      showFormMsg('success', editingId ? '¡Producto actualizado exitosamente!' : '¡Producto creado exitosamente!');
      resetForm();
      setTimeout(() => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="lista"]').classList.add('active');
        $('tab-lista').classList.add('active');
        loadAdminProducts();
      }, 1500);
    } else {
      showFormMsg('error', data.error || 'Error al guardar el producto');
    }
  } catch (err) {
    showFormMsg('error', 'Error de conexión con el servidor');
  } finally {
    btn.textContent = 'Guardar Producto';
    btn.disabled = false;
  }
});

function resetForm() {
  editingId = null;
  $('editId').value = '';
  $('formTitle').textContent = 'Nuevo Producto';
  $('productForm').reset();
  $('imgPreview').classList.add('hidden');
  $('imgPreview').src = '';
}

$('btnCancelEdit').addEventListener('click', () => {
  resetForm();
  hideFormMsg();
});

function showFormMsg(type, text) {
  const el = $('formMsg');
  el.className = `form-msg ${type}`;
  el.textContent = text;
  el.classList.remove('hidden');
  setTimeout(hideFormMsg, 4000);
}
function hideFormMsg() {
  $('formMsg').classList.add('hidden');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
navigate('inicio');