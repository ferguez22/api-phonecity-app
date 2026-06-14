# api-phonecity-app

API REST de gestion para PhoneCity (tienda de reparacion de moviles).
Stack: Node.js + Express 5 + MariaDB (mysql2).

## Arquitectura

Modular por feature, con 4 capas por modulo:

| Capa | Responsabilidad |
|---|---|
| `routes` | Mapea URL -> controller |
| `controller` | Traduce HTTP <-> service (sin logica ni SQL) |
| `service` | Reglas de negocio + validacion |
| `repository` | Solo acceso a datos (SQL) |

```
src/
├── config/      env (validado) + pool de BBDD
├── modules/     una carpeta por feature (linea, ...)
├── middlewares/ errorHandler, notFound
├── utils/       AppError, asyncHandler
├── app.js       construye la app express
└── server.js    arranca el servidor
```

## Puesta en marcha

```bash
npm install
cp .env.example .env   # rellena DB_PASSWORD
npm run dev            # nodemon (recarga en caliente)
```

## Scripts

| Comando | Accion |
|---|---|
| `npm start` | Produccion (node) |
| `npm run dev` | Desarrollo (nodemon) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Endpoints (v0.3)

| Metodo | Ruta | Accion |
|---|---|---|
| GET | `/api/health` | Estado de la API |
| GET | `/api/lineas` | Listar lineas |
| GET | `/api/lineas/:id` | Una linea |
| POST | `/api/lineas` | Crear |
| PUT | `/api/lineas/:id` | Editar |
| DELETE | `/api/lineas/:id` | Borrar |

## Formato de respuesta

Consistente en toda la API:

```json
{ "success": true, "data": {}, "error": null }
```
