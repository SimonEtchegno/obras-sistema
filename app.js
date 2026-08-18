const express = require('express');
const path = require('path');

const proyectosRouter = require('./src/routes/proyectos');
const itemsRouter = require('./src/routes/items');
const certificacionesRouter = require('./src/routes/certificaciones');
const uocraRouter = require('./src/routes/uocra');

const app = express();

app.use(express.json());

app.use('/api/proyectos', proyectosRouter);
app.use('/api/items', itemsRouter);
app.use('/api/certificaciones', certificacionesRouter);
app.use('/api/actualizaciones-uocra', uocraRouter);

// El front es la SPA de React que compila Vite (web/ → dist/).
const distDir = path.join(__dirname, 'dist');
const indexHtml = path.join(distDir, 'index.html');

app.use(express.static(distDir));

// Cualquier ruta que no sea /api ni un archivo del build devuelve index.html:
// la pantalla la resuelve el router de React del lado del navegador.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(indexHtml, (err) => {
    if (!err) return;
    res
      .status(500)
      .type('text/plain')
      .send('Falta el build del front: corré "npm run build" (o "npm run dev" para desarrollar con recarga en vivo).');
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

module.exports = app;
