# PhoneCity — Backend (api-phonecity-app)

API de la app de gestión de reparaciones PhoneCity (tienda 319, Ponferrada). Frontend en el repo hermano `../phonecity-app`.

El dueño del código es Fernando. Él decide la estructura. Tú propones, explicas y ejecutas lo que apruebe.

---

## Forma de trabajar (obligatorio)

1. **Español.** Tono directo y técnico. Sin introducciones ni conclusiones. Viñetas, tablas o código; nada de párrafos largos.
2. **Planificar antes de tocar código.** Ante cualquier tarea:
   - Lee los archivos implicados.
   - Responde con diagnóstico en tres ejes: **Mal** (estado actual) · **Bien** (estado objetivo) · **Acción** (qué archivos vas a tocar y qué cambia en cada uno).
   - Haz las preguntas que haga falta y **espera**.
   - No edites ningún archivo hasta que Fernando apruebe ("ejecuta", "implementa", "genera", "construye", "adelante", "ok"). Si hay duda, sigue planificando.
3. **Cambios quirúrgicos.** Edita solo lo necesario. No reescribas archivos enteros ni reformatees código que no toca la tarea.
4. **Sin comentarios en el código** salvo que se pidan.
5. **Explica cada cambio** al terminar: qué archivo, qué hace, por qué va ahí.
6. **Una tarea cada vez.** Lo que veas de paso, anótalo al final como sugerencia.

## Prohibido

| Nunca | Motivo |
|---|---|
| `git commit`, `git push`, `git reset`, `git rebase`, crear ramas | Los commits los hace Fernando, siempre en `main` |
| `rsync`, `scp`, `ssh`, cualquier conexión a `192.168.1.41` | Producción se despliega a mano |
| Leer, mostrar o editar `.env` o cualquier archivo con secretos | Seguridad. Si necesitas saber una variable, pregunta su **nombre**, nunca su valor |
| Conectar a la base de datos de producción (`phonecity_db`) | Solo existe para Fernando |
| Ejecutar DDL (`ALTER`, `CREATE`, `DROP`) aunque sea en local | Las migraciones las aplica Fernando |
| Instalar dependencias nuevas sin preguntar | Mantener el proyecto ligero |
| Añadir líneas de atribución (`Co-Authored-By`, etc.) en ningún sitio | Decisión del dueño |

`git status`, `git diff`, `git log` sí están permitidos.

## Migraciones

Si una tarea necesita cambiar el esquema:
1. Escribe el SQL completo (DDL + backfill si aplica) y para.
2. Indica el orden invariante: **backup → DDL prod → backfill → backend → frontend**.
3. Fernando lo aplica primero en local (`phonecity`) y después en producción.

## Verificación antes de decir "terminado"

```bash
node --check <cada archivo .js modificado>
```

Después indica qué endpoint probar y cómo (desde el front en `ng serve` o con `requests.http`).

---

## Stack

| Capa | Detalle |
|---|---|
| Runtime | Node.js + Express 5 |
| Base de datos | MariaDB. Local: base `phonecity` (Homebrew, Mac). Producción: `phonecity_db` (MariaDB 11.8.6 en Docker, TrueNAS) |
| Puerto local | 3000 (`http://localhost:3000/api`) |
| Producción | Contenedor `phonecity-api` en el NAS, puerto 3001. Desplegado a mano con `scp` de archivos concretos |

## Estructura

```
src/
├── app.js  server.js
├── config/         → db.js, env.js
├── middlewares/    → errorHandler, notFound, protect (JWT), rateLimit
├── utils/          → AppError, asyncHandler
├── modules/
│   ├── <modulo>/<modulo>.routes.js      → rutas
│   ├── <modulo>/<modulo>.controller.js  → req/res, sin lógica
│   ├── <modulo>/<modulo>.service.js     → lógica de negocio
│   └── <modulo>/<modulo>.repository.js  → SQL
│   (auth, cliente, export, historial, import, linea, nota, pedidos, pieza, proveedor, taller)
└── scripts/        → backfill_linea_flujos.js, seedUser.js
```

Respeta el patrón routes → controller → service → repository. El SQL solo vive en los repository.

## Dominio

| Tabla | Detalle |
|---|---|
| `linea` | Reparación / pedido / venta. `id` = etiqueta física **L-XXXX**. Máquina de estados: `flujo` + `fase` + flags `avisado`, `movil_en_tienda` |
| `linea_pieza` | N piezas por línea. `linea.importe` = suma de piezas, calculado en `linea.service` |
| `linea_historial` | Cada cambio de estado (datos desde 26/06/2026) |
| `cliente`, `proveedor`, `taller`, `nota` | Catálogos y notas |

Columnas de fecha útiles: `fecha_pedido` (se rellena al marcar como pedido), `fecha_envio_taller`, `fecha_recogida_prevista`.

## Decisiones cerradas (no reabrir)

- Proveedor por línea, no por pieza. Nunca dos proveedores en una línea.
- Total de la línea = suma de piezas, bloqueado. Descuentos en cada pieza.
- Datos estructurados nunca en texto libre (ni en `notas`).

## Fecha clave

**29/11/2026:** presentación a todas las tiendas. Nada de migraciones antes de esa fecha salvo que Fernando lo pida.
