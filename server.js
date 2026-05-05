const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Cloudinary ───────────────────────────────────────────────────────────────
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'xiostore',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ─── Firebase ─────────────────────────────────────────────────────────────────
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  })
});

const db = admin.firestore();

// ─── Productos helpers ────────────────────────────────────────────────────────
async function getProductos() {
  const snapshot = await db.collection('productos').get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

async function saveProductos(productos) {
  const batch = db.batch();
  const snapshot = await db.collection('productos').get();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  productos.forEach(p => {
    const ref = db.collection('productos').doc(String(p.id));
    batch.set(ref, p);
  });
  await batch.commit();
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'tienda-ropa-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || 'Xiomi0806';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Xiomi0806';

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ─── API: Visitas ─────────────────────────────────────────────────────────────
// El frontend llama esto 1 vez por sesión
app.post('/api/visita', async (req, res) => {
  try {
    const contadorRef = db.collection('analytics').doc('visitas');
    await db.runTransaction(async t => {
      const doc = await t.get(contadorRef);
      if (!doc.exists) {
        t.set(contadorRef, { total: 1 });
      } else {
        t.update(contadorRef, { total: admin.firestore.FieldValue.increment(1) });
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// El panel admin lee el contador
app.get('/api/admin/analytics', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('analytics').doc('visitas').get();
    const total = doc.exists ? doc.data().total : 0;
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Productos ───────────────────────────────────────────────────────────
app.get('/api/productos', async (req, res) => {
  try {
    const productos = await getProductos();
    const { categoria, destacado } = req.query;
    let filtrado = productos;
    if (categoria) filtrado = filtrado.filter(p => p.categoria === categoria);
    if (destacado === 'true') filtrado = filtrado.filter(p => p.destacado);
    res.json(filtrado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/productos/:id', async (req, res) => {
  try {
    const productos = await getProductos();
    const producto = productos.find(p => p.id === req.params.id);
    if (!producto) return res.status(404).json({ error: 'No encontrado' });
    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  '/api/admin/productos',
  requireAuth,
  upload.array('imagenes', 10),
  async (req, res) => {
    try {
      const productos = await getProductos();
      const nuevoId = String(Date.now());
      const { nombre, precio, categoria, descripcion, material, cuidados, destacado } = req.body;
      const tallas = req.body.tallas ? req.body.tallas.split(',').map(t => t.trim()) : [];
      const colores = req.body.colores ? req.body.colores.split(',').map(c => c.trim()) : [];
      const imagenes    = req.files ? req.files.map(f => f.path)    : [];
      const imagenesIds = req.files ? req.files.map(f => f.filename) : [];
      const nuevo = {
        id: nuevoId, nombre, precio: Number(precio), categoria, descripcion,
        material: material || '', cuidados: cuidados || '',
        tallas, colores, imagenes, imagenesIds,
        destacado: destacado === 'true' || destacado === 'on'
      };
      productos.push(nuevo);
      await saveProductos(productos);
      res.json({ success: true, producto: nuevo });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.put(
  '/api/admin/productos/:id',
  requireAuth,
  upload.array('imagenes', 10),
  async (req, res) => {
    try {
      const productos = await getProductos();
      const idx = productos.findIndex(p => p.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
      const prod = productos[idx];
      const { nombre, precio, categoria, descripcion, material, cuidados, destacado } = req.body;
      const tallas = req.body.tallas ? req.body.tallas.split(',').map(t => t.trim()) : prod.tallas;
      const colores = req.body.colores ? req.body.colores.split(',').map(c => c.trim()) : prod.colores;
      let imagenesExistentes = [];
      try { imagenesExistentes = JSON.parse(req.body.imagenesExistentes || '[]'); } catch { imagenesExistentes = []; }
      const imagenesIdsActuales = prod.imagenesIds || [];
      const imagenesUrlsActuales = prod.imagenes || [];
      const idsAEliminar = imagenesIdsActuales.filter((id, i) => {
        const url = imagenesUrlsActuales[i];
        return url && !imagenesExistentes.includes(url);
      });
      for (const publicId of idsAEliminar) {
        try { await cloudinary.uploader.destroy(publicId); } catch (e) { console.log('Error borrando imagen:', e.message); }
      }
      const idsConservados = imagenesIdsActuales.filter((id, i) => {
        const url = imagenesUrlsActuales[i];
        return url && imagenesExistentes.includes(url);
      });
      const nuevasUrls = req.files ? req.files.map(f => f.path)    : [];
      const nuevasIds  = req.files ? req.files.map(f => f.filename) : [];
      productos[idx] = {
        ...prod,
        nombre:      nombre      || prod.nombre,
        precio:      precio      ? Number(precio) : prod.precio,
        categoria:   categoria   || prod.categoria,
        descripcion: descripcion || prod.descripcion,
        material:    material    !== undefined ? material : prod.material,
        cuidados:    cuidados    !== undefined ? cuidados : prod.cuidados,
        tallas, colores,
        imagenes:    [...imagenesExistentes, ...nuevasUrls],
        imagenesIds: [...idsConservados, ...nuevasIds],
        destacado:   destacado !== undefined ? (destacado === 'true' || destacado === 'on') : prod.destacado
      };
      await saveProductos(productos);
      res.json({ success: true, producto: productos[idx] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.delete('/api/admin/productos/:id', requireAuth, async (req, res) => {
  try {
    const productos = await getProductos();
    const idx = productos.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
    const prod = productos[idx];
    for (const publicId of (prod.imagenesIds || [])) {
      try { await cloudinary.uploader.destroy(publicId); } catch (e) { console.log('Error borrando imagen:', e.message); }
    }
    if (prod.imagenPublicId && !(prod.imagenesIds || []).includes(prod.imagenPublicId)) {
      try { await cloudinary.uploader.destroy(prod.imagenPublicId); } catch {}
    }
    productos.splice(idx, 1);
    await saveProductos(productos);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { usuario, password } = req.body;
  if (usuario === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Credenciales incorrectas' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ autenticado: !!(req.session && req.session.admin) });
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`  Admin: usuario="${ADMIN_USER}" | contraseña="${ADMIN_PASS}"`);
});