# Sistema de Obras

Sistema para llevar el presupuesto, las certificaciones de avance y las actualizaciones por convenio UOCRA de varias obras.

## Cómo arrancarlo

Necesitás tener [Node.js](https://nodejs.org) instalado (versión 22.5 o más nueva; probado con la v24).

```
npm install
npm start
```

Después abrí `http://localhost:3000` en el navegador.

Para parar el servidor: `Ctrl+C` en la terminal donde está corriendo.

## Dónde están los datos

Todo se guarda en un solo archivo: `data\obras.db`. Para hacer una copia de seguridad, alcanza con copiar ese archivo a otro lado (con el servidor apagado, para evitar copiarlo a mitad de una escritura). Para "resetear" el sistema y arrancar de cero, se puede borrar ese archivo — se vuelve a crear vacío la próxima vez que arranca.

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
