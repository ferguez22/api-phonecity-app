// Envuelve un controller async y manda cualquier error a next()
// Evita repetir try/catch en cada controller.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
