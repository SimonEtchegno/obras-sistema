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

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

module.exports = app;
