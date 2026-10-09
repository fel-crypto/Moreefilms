const { app, connectToMongo } = require('./server');

module.exports = async (req, res) => {
  if (req.url === '/' || req.url === '/api') {
    return app(req, res);
  }

  try {
    await connectToMongo();
    return app(req, res);
  } catch (error) {
    console.error('No se pudo conectar a MongoDB:', error.name);
    return res.status(503).json({ message: 'No se pudo conectar a la base de datos' });
  }
};
