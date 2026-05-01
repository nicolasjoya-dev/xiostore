# MAISON — Tienda de Ropa 🧥

Plataforma completa para tienda de ropa con panel de administrador.

## Stack
- **Backend:** Node.js + Express
- **Frontend:** HTML/CSS/JS vanilla (SPA sin framework)
- **Imágenes:** Multer (subida local)
- **Sesiones:** express-session
- **Deploy:** Render.com / Railway

---

## Instalación local

```bash
npm install
npm start
# → http://localhost:3000
```

Para desarrollo con recarga automática:
```bash
npm run dev
```

---

## Variables de entorno

Crea un archivo `.env` (opcional, hay valores por defecto):

```env
PORT=3000
ADMIN_USER=admin
ADMIN_PASS=tienda2024
SESSION_SECRET=mi-secreto-super-seguro
```

**¡Cambia ADMIN_PASS antes de hacer deploy!**

---

## Panel de Administrador

URL: `http://localhost:3000` → sección "Admin"

- **Usuario por defecto:** `admin`
- **Contraseña por defecto:** `tienda2024`

### Qué puedes hacer:
- ✅ Ver todos los productos
- ✅ Agregar nuevos productos con imagen
- ✅ Editar productos existentes
- ✅ Eliminar productos
- ✅ Marcar prendas como "Destacadas" (aparecen en el inicio)

---

## Deploy en Render.com

1. Crea cuenta en [render.com](https://render.com)
2. "New Web Service" → conecta tu repositorio GitHub
3. Configura:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. En "Environment Variables" agrega:
   - `ADMIN_PASS` → tu contraseña segura
   - `SESSION_SECRET` → una cadena aleatoria larga
5. Deploy ✓

> ⚠️ **Nota:** En Render con plan gratis, las imágenes subidas se pierden en cada deploy porque el sistema de archivos es efímero. Para persistencia de imágenes, considera usar [Cloudinary](https://cloudinary.com) o un bucket S3.

---

## Deploy en Railway

1. Crea cuenta en [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Agrega las variables de entorno en el panel
4. Railway detecta Node.js automáticamente y usa `npm start`

---

## Personalización

### Cambiar número de WhatsApp
En `public/js/app.js`, línea 10:
```js
const WA_NUMBER = '573001234567'; // ← Tu número con código de país
```

### Cambiar mapa de Google
En `public/index.html`, busca el `<iframe>` del mapa y reemplaza la URL del embed con la de tu ubicación real:
1. Ve a Google Maps → tu negocio
2. Compartir → Insertar mapa → Copiar HTML
3. Pega la URL dentro del `src` del iframe

### Cambiar colores del tema
En `public/css/style.css`, variables CSS al inicio:
```css
:root {
  --gold:    #B59A6A;  /* Color dorado/acento */
  --charcoal: #1C1C1C; /* Color oscuro principal */
  --ivory:   #F8F5F0;  /* Color de fondo */
}
```

---

## Estructura del proyecto

```
tienda-ropa/
├── server.js              # Servidor Express + API REST
├── package.json
├── data/
│   └── productos.json     # Base de datos de productos (JSON)
└── public/
    ├── index.html         # SPA principal
    ├── css/
    │   └── style.css      # Estilos
    ├── js/
    │   └── app.js         # Lógica SPA
    └── uploads/           # Imágenes subidas (se crea automáticamente)
```
