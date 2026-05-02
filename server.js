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

async function getProductos() {
  const snapshot = await db.collection('productos').get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

async function saveProductos(productos) {
  const batch = db.batch();

  // Borra todos los documentos actuales
  const snapshot = await db.collection('productos').get();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));

  // Escribe todos los productos con su id como doc id
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
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || 'Xiomi0806';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Xiomi0806';

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ─── API: Productos ───────────────────────────────────────────────────────────
app.get('/api/productos', async (req, res) => {
  try {
    const productos = await getProductos();
    const { categoria, destacado } = req.query;

    let filtrado = productos;

    if (categoria) {
      filtrado = filtrado.filter(p => p.categoria === categoria);
    }

    if (destacado === 'true') {
      filtrado = filtrado.filter(p => p.destacado);
    }

    res.json(filtrado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/productos/:id', async (req, res) => {
  try {
    const productos = await getProductos();
    const producto = productos.find(p => p.id === req.params.id);

    if (!producto) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Crear producto ───────────────────────────────────────────────────────────
app.post(
  '/api/admin/productos',
  requireAuth,
  upload.single('imagen'),
  async (req, res) => {
    try {
      const productos = await getProductos();

      const nuevoId = String(Date.now());

      const {
        nombre,
        precio,
        categoria,
        descripcion,
        material,
        cuidados,
        destacado
      } = req.body;

      const tallas = req.body.tallas
        ? req.body.tallas.split(',').map(t => t.trim())
        : [];

      const colores = req.body.colores
        ? req.body.colores.split(',').map(c => c.trim())
        : [];

      const nuevo = {
        id: nuevoId,
        nombre,
        precio: Number(precio),
        categoria,
        descripcion,
        material: material || '',
        cuidados: cuidados || '',
        tallas,
        colores,
        imagen: req.file ? req.file.path : '/img/placeholder.jpg',
        imagenPublicId: req.file ? req.file.filename : null,
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

// ─── Editar producto ──────────────────────────────────────────────────────────
app.put(
  '/api/admin/productos/:id',
  requireAuth,
  upload.single('imagen'),
  async (req, res) => {
    try {
      const productos = await getProductos();

      const idx = productos.findIndex(p => p.id === req.params.id);

      if (idx === -1) {
        return res.status(404).json({ error: 'No encontrado' });
      }

      const {
        nombre,
        precio,
        categoria,
        descripcion,
        material,
        cuidados,
        destacado
      } = req.body;

      const tallas = req.body.tallas
        ? req.body.tallas.split(',').map(t => t.trim())
        : productos[idx].tallas;

      const colores = req.body.colores
        ? req.body.colores.split(',').map(c => c.trim())
        : productos[idx].colores;

      productos[idx] = {
        ...productos[idx],
        nombre: nombre || productos[idx].nombre,
        precio: precio ? Number(precio) : productos[idx].precio,
        categoria: categoria || productos[idx].categoria,
        descripcion: descripcion || productos[idx].descripcion,
        material: material !== undefined ? material : productos[idx].material,
        cuidados: cuidados !== undefined ? cuidados : productos[idx].cuidados,
        tallas,
        colores,
        imagen: req.file ? req.file.path : productos[idx].imagen,
        imagenPublicId: req.file ? req.file.filename : productos[idx].imagenPublicId,
        destacado: destacado !== undefined
          ? (destacado === 'true' || destacado === 'on')
          : productos[idx].destacado
      };

      await saveProductos(productos);

      res.json({ success: true, producto: productos[idx] });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── Eliminar producto ────────────────────────────────────────────────────────
app.delete(
  '/api/admin/productos/:id',
  requireAuth,
  async (req, res) => {
    try {
      const productos = await getProductos();

      const idx = productos.findIndex(p => p.id === req.params.id);

      if (idx === -1) {
        return res.status(404).json({ error: 'No encontrado' });
      }

      const prod = productos[idx];

      // Eliminar imagen de Cloudinary si existe
      if (prod.imagenPublicId) {
        try {
          await cloudinary.uploader.destroy(prod.imagenPublicId);
          console.log('Imagen eliminada de Cloudinary');
        } catch (cloudErr) {
          console.log('Error eliminando imagen Cloudinary:', cloudErr.message);
        }
      }

      productos.splice(idx, 1);
      await saveProductos(productos);

      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

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