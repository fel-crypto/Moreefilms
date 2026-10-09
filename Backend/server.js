const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const { promisify } = require('util');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3003;
const urlMongo = process.env.MONGO_URI;
const scryptAsync = promisify(crypto.scrypt);
let mongoConnectionPromise;

// Middlewares disponibles para las peticiones del frontend.
app.use(cors());
app.use(express.json());

// Modelo de usuarios: Mongoose crea la colección "users".
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

// Modelo de publicaciones: Mongoose crea la colección "posts".
const postSchema = new mongoose.Schema({
  autor: { type: String, required: true, trim: true },
  contenido: { type: String, required: true, trim: true },
  pelicula: { type: String, trim: true },
  comentarios: [{
    autor: { type: String, required: true, trim: true },
    texto: { type: String, required: true, trim: true },
  }],
  fecha: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Protege las contraseñas antes de guardarlas en MongoDB.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

// Compara una contraseña recibida con el hash almacenado.
async function verifyPassword(password, storedPassword) {
  const [salt, storedKey] = storedPassword.split(':');
  const derivedKey = await scryptAsync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(storedKey, 'hex'), derivedKey);
}

// Muestra las publicaciones guardadas para verificar los datos desde el navegador.
app.get('/', async (req, res) => {
  try {
    const [posts, users] = await Promise.all([
      Post.find().sort({ fecha: -1 }),
      User.find().select('username email -_id').lean(),
    ]);
    return res.json({
      message: 'MoreFilms API conectada a MongoDB',
      totalPublicaciones: posts.length,
      publicaciones: posts,
      totalUsuarios: users.length,
      usuarios: users,
    });
  } catch (error) {
    console.error('No se pudieron cargar los datos de MongoDB:', error.name);
    return res.status(500).json({ message: 'No se pudieron cargar los datos de MongoDB' });
  }
});

app.get('/health', (req, res) => {
  res.json({ message: 'MoreFilms API activa' });
});

app.get('/api', (req, res) => {
  res.json({ message: 'MoreFilms API activa' });
});

// Registra un usuario nuevo.
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: 'email, username y password son obligatorios' });
    }

    const hashedPassword = await hashPassword(password);
    const user = await User.create({ email, username, password: hashedPassword });
    return res.status(201).json({
      message: 'Usuario registrado correctamente',
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ message: `${duplicateField} ya está registrado` });
    }

    return res.status(500).json({ message: 'Error al registrar el usuario' });
  }
});

// Valida las credenciales de un usuario.
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').trim();
    if (!password || !identifier) {
      return res.status(400).json({ message: 'Debes enviar usuario o email y password' });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    });

    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    return res.json({
      message: 'Inicio de sesión correcto',
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// Devuelve el feed ordenado desde la publicación más reciente.
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ fecha: -1 });
    return res.json(posts);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener las publicaciones' });
  }
});

// Crea una publicación nueva.
app.post('/api/posts', async (req, res) => {
  try {
    const { autor, contenido, pelicula } = req.body;
    const post = await Post.create({ autor, contenido, pelicula });
    return res.status(201).json(post);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'autor y contenido son obligatorios' });
    }

    return res.status(500).json({ message: 'Error al crear la publicación' });
  }
});

// Elimina una publicación por su identificador de MongoDB.
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const usuarioSolicitante = req.body?.autor || req.body?.username || req.query.autor || req.query.username;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }

    if (!usuarioSolicitante || post.autor !== usuarioSolicitante) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar esta publicación' });
    }

    await Post.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Publicación eliminada correctamente' });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'ID de publicación inválido' });
    }

    return res.status(500).json({ message: 'Error al eliminar la publicación' });
  }
});

// Actualiza los campos enviados de una publicación existente.
app.put('/api/posts/:id', async (req, res) => {
  try {
    const { autor, contenido, pelicula } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }

    if (!autor || post.autor !== autor) {
      return res.status(403).json({ message: 'No tienes permiso para editar esta publicación' });
    }

    if (contenido !== undefined) {
      post.contenido = contenido;
    }
    if (pelicula !== undefined) {
      post.pelicula = pelicula;
    }

    await post.save();

    return res.json(post);
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'ID de publicación inválido' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'autor y contenido son obligatorios' });
    }

    return res.status(500).json({ message: 'Error al actualizar la publicación' });
  }
});

// Agrega un comentario a una publicación existente.
app.post('/api/posts/:id/comentarios', async (req, res) => {
  try {
    const { autor, texto } = req.body;

    if (!autor || !texto || !texto.trim()) {
      return res.status(400).json({ message: 'autor y texto son obligatorios' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }

    post.comentarios.push({ autor, texto });
    await post.save();
    return res.status(201).json(post);
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'ID de publicación inválido' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'autor y texto son obligatorios' });
    }

    return res.status(500).json({ message: 'Error al agregar el comentario' });
  }
});

function isLocalMongoUri(uri) {
  const authorityMatch = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/?]+)/i);
  const mongoHosts = authorityMatch ? authorityMatch[1].split(',') : [];
  return mongoHosts.some((host) =>
    /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(host)
  );
}

async function connectToMongo() {
  if (!urlMongo) {
    throw new Error('Falta configurar MONGO_URI');
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(urlMongo).catch((error) => {
      mongoConnectionPromise = undefined;
      throw error;
    });
  }

  await mongoConnectionPromise;
}

async function vercelHandler(req, res) {
  if (req.url === '/api' || req.url === '/health') {
    return app(req, res);
  }

  try {
    await connectToMongo();
    return app(req, res);
  } catch (error) {
    console.error('No se pudo conectar a MongoDB:', error.name);
    return res.status(503).json({ message: 'No se pudo conectar a la base de datos' });
  }
}

async function startServer() {
  try {
    if (!urlMongo) {
      throw new Error('Falta configurar MONGO_URI en Backend/.env');
    }

    if (isLocalMongoUri(urlMongo)) {
      console.log('Conexión local a MongoDB suspendida temporalmente');
    } else {
      await connectToMongo();
      console.log('Conectado a MongoDB');
    }

    app.listen(port, () => {
      console.log(`MoreFilms API disponible en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('No se pudo conectar a MongoDB:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = vercelHandler;
module.exports.app = app;
module.exports.connectToMongo = connectToMongo;
