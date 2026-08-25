# Sistema de Obras

Sistema para llevar el presupuesto, las certificaciones de avance y las actualizaciones (por convenio UOCRA o por índice de la construcción) de varias obras.

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

- **Front** (`web/`): aplicación React con Tailwind CSS, compilada por Vite a `dist/`. Es una sola página con ruteo del lado del navegador (`react-router`): lista de proyectos, detalle de proyecto, certificaciones y actualizaciones.
- **Backend** (`app.js`, `src/`): API Express con SQLite. Sirve además el build del front y, para cualquier ruta que no sea `/api`, devuelve el `index.html` de la SPA.
- **Datos**: hoy el front guarda todo en el navegador (`localStorage`, ver `web/src/lib/localStore.js`), con las mismas reglas de negocio que el backend. Todas las pantallas hablan con `web/src/lib/api.js`, así que cuando se conecte la API real solo se reemplaza esa pieza.

## Dónde están los datos

Del lado del backend, todo se guarda en un solo archivo: `data\obras.db`. Para hacer una copia de seguridad, alcanza con copiar ese archivo a otro lado (con el servidor apagado, para evitar copiarlo a mitad de una escritura). Para "resetear" el sistema y arrancar de cero, se puede borrar ese archivo — se vuelve a crear vacío la próxima vez que arranca.

Mientras el front siga usando `localStorage`, los datos que se ven en pantalla viven en el navegador de cada máquina: se borran desde las herramientas de desarrollo del navegador (borrar el sitio) y no se comparten entre computadoras.

## Cómo está pensado

- **Proyectos**: cada obra es un proyecto, con un presupuesto original (monto y fecha).
- **Ítems**: el presupuesto se reparte en ítems (%  del total), y cada ítem puede tener sub-ítems (% de ese ítem). Los ítems con sub-ítems son solo organizativos — su monto es la suma de sus hijos. Certificaciones y actualizaciones solo se cargan sobre ítems finales (sin sub-ítems), para no contar la plata dos veces.
- **Certificaciones**: el avance de obra de cada período. No hace falta certificar el 100% de un ítem de una sola vez — se puede ir acumulando en varias certificaciones a lo largo del tiempo.
- **Actualizaciones**: cuando sube el convenio UOCRA o el índice de la construcción, se registra el aumento y de qué tipo es. Se puede cargar de dos formas equivalentes: como **porcentaje**, o como **monto total** — que se reparte entre los ítems a prorrata de su saldo pendiente (es lo mismo que aplicar el % que ese monto representa sobre el saldo total). El ajuste afecta siempre a todo el proyecto (no se puede elegir un subconjunto de ítems), sobre el saldo pendiente (lo no certificado) de cada ítem final. Lo ya certificado no se retoca. Queda un historial de cada actualización y su efecto ítem por ítem.
- **Extras**: detalles que se anotan al costado del presupuesto (un título o descripción y un monto), con su propio total. No forman parte del árbol de ítems a propósito: no modifican el monto total ni el de ningún ítem, no se certifican y no los tocan las actualizaciones. Se cargan, editan y borran desde la sección "Extras" del resumen del proyecto.

## Supuestos a confirmar con el cliente

Estas dos reglas de negocio se armaron con el criterio más habitual en obra, pero no fueron confirmadas con el contratista real. Si él indica otro criterio, el cambio es acotado a estos dos archivos:

- **Base del ajuste de las actualizaciones** (`src/services/uocraService.js`): el % (por UOCRA o por índice de la construcción) se aplica sobre el saldo pendiente del ítem, no sobre el monto vigente total.
- **Base de la certificación** (`src/services/certificacionService.js`): el % certificado se calcula sobre el monto vigente actual del ítem (que puede ya incluir aumentos UOCRA), no sobre el monto base original del presupuesto.

## Limitaciones conocidas (quedaron afuera a propósito de esta primera versión)

- No se puede mover un ítem a otro padre desde la interfaz (la API lo permite, pero no hay botón todavía).
- Editar una certificación ya cargada solo permite cambiar número/fecha/descripción, no los montos — para corregir un monto hay que borrar la certificación y volver a cargarla.
- Sin usuarios ni login: pensado para que lo use una sola persona.
