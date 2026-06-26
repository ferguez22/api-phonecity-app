const express = require('express');
const cors = require('cors');
const authRoutes = require('./modules/auth/auth.routes');
const lineaRoutes = require('./modules/linea/linea.routes');
const clienteRoutes = require('./modules/cliente/cliente.routes');
const protect = require('./middlewares/protect');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const { generalLimiter, loginLimiter } = require('./middlewares/rateLimit');
const exportRoutes = require('./modules/export/export.routes');
const importRoutes = require('./modules/import/import.routes');
const proveedorRoutes = require('./modules/proveedor/proveedor.routes'); 
const pedidosRoutes = require('./modules/pedidos/pedidos.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(generalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/proveedores', protect, proveedorRoutes);
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null });
});
app.use('/api/pedidos', protect, pedidosRoutes);

app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/lineas', protect, lineaRoutes);
app.use('/api/clientes', protect, clienteRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;