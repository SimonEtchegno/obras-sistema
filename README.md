# Sistema de Obras

Sistema para llevar el presupuesto, las certificaciones de avance y las actualizaciones por convenio UOCRA de varias obras.

## Cómo arrancarlo

Necesitás tener [Node.js](https://nodejs.org) instalado (versión 22.5 o más nueva; probado con la v24).

Para trabajar en la interfaz, con recarga en vivo:

```
npm install
npm run dev
```

Después abrí `http://localhost:5173`.

Para usarlo como en producción (un solo servidor, en `http://localhost:3000`):

```
npm run build
npm start
```

Para parar el servidor: `Ctrl+C` en la terminal donde está corriendo.

## Cómo está armado

- **Front** (`web/`): aplicación React con Tailwind CSS, compilada por Vite a `dist/`. Es una sola página con ruteo del lado del navegador (`react-router`): lista de proyectos, detalle de proyecto, certificaciones y actualizaciones UOCRA.
- **Backend** (`app.js`, `src/`): API Express con SQLite. Sirve además el build del front y, para cualquier ruta que no sea `/api`, devuelve el `index.html` de la SPA.
- **Datos**: hoy el front guarda todo en el navegador (`localStorage`, ver `web/src/lib/localStore.js`), con las mismas reglas de negocio que el backend. Todas las pantallas hablan con `web/src/lib/api.js`, así que cuando se conecte la API real solo se reemplaza esa pieza.

## Dónde están los datos

Del lado del backend, todo se guarda en un solo archivo: `data\obras.db`. Para hacer una copia de seguridad, alcanza con copiar ese archivo a otro lado (con el servidor apagado, para evitar copiarlo a mitad de una escritura). Para "resetear" el sistema y arrancar de cero, se puede borrar ese archivo — se vuelve a crear vacío la próxima vez que arranca.

Mientras el front siga usando `localStorage`, los datos que se ven en pantalla viven en el navegador de cada máquina: se borran desde las herramientas de desarrollo del navegador (borrar el sitio) y no se comparten entre computadoras.

## Cómo está pensado

- **Proyectos**: cada obra es un proyecto, con un presupuesto original (monto y fecha).
- **Ítems**: el presupuesto se reparte en ítems (%  del total), y cada ítem puede tener sub-ítems (% de ese ítem). Los ítems con sub-ítems son solo organizativos — su monto es la suma de sus hijos. Certificaciones y actualizaciones UOCRA solo se cargan sobre ítems finales (sin sub-ítems), para no contar la plata dos veces.
- **Certificaciones**: el avance de obra de cada período. No hace falta certificar el 100% de un ítem de una sola vez — se puede ir acumulando en varias certificaciones a lo largo del tiempo.
- **Actualizaciones UOCRA**: cuando sube el convenio, se registra un % de aumento que se aplica sobre el saldo pendiente (lo no certificado) de los ítems elegidos. Lo ya certificado no se retoca. Queda un historial de cada actualización y su efecto ítem por ítem.

## Supuestos a confirmar con el cliente

Estas dos reglas de negocio se armaron con el criterio más habitual en obra, pero no fueron confirmadas con el contratista real. Si él indica otro criterio, el cambio es acotado a estos dos archivos:

- **Base del ajuste UOCRA** (`src/services/uocraService.js`): el % se aplica sobre el saldo pendiente del ítem, no sobre el monto vigente total.
- **Base de la certificación** (`src/services/certificacionService.js`): el % certificado se calcula sobre el monto vigente actual del ítem (que puede ya incluir aumentos UOCRA), no sobre el monto base original del presupuesto.

## Limitaciones conocidas (quedaron afuera a propósito de esta primera versión)

- No se puede mover un ítem a otro padre desde la interfaz (la API lo permite, pero no hay botón todavía).
- Editar una certificación ya cargada solo permite cambiar número/fecha/descripción, no los montos — para corregir un monto hay que borrar la certificación y volver a cargarla.
- Sin usuarios ni login: pensado para que lo use una sola persona.
