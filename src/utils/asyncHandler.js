// Express 4 no engancha automáticamente los rechazos de handlers async: sin
// esto, un error async que no cae en un try/catch propio deja el request
// colgado en vez de llegar al middleware de errores de app.js.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
