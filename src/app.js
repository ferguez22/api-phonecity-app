const express = require('express');
const cors = require('cors');

const lineaRoutes = require('./modules/linea/linea.routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Health check (comprobar que la API responde)
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null });
});

// Rutas de modulos
app.use('/api/lineas', lineaRoutes);

// 404 + manejador central de errores (SIEMPRE los ultimos)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
