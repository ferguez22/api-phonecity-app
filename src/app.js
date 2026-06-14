const express = require('express');
const cors = require('cors');

const authRoutes = require('./modules/auth/auth.routes');
const lineaRoutes = require('./modules/linea/linea.routes');
const clienteRoutes = require('./modules/cliente/cliente.routes');
const protect = require('./middlewares/protect');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Health check (publico)
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null });
});

// Rutas publicas
app.use('/api/auth', authRoutes);

// Rutas protegidas (requieren JWT)
app.use('/api/lineas', protect, lineaRoutes);
app.use('/api/clientes', protect, clienteRoutes);

// 404 + manejador central de errores (SIEMPRE los ultimos)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
