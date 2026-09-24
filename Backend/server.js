const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { promisify } = require('util');

const app = express();
const port = process.env.PORT || 3003;
const mongoUri = 'mongodb://localhost:27017/morefilms';
const scryptAsync = promisify(crypto.scrypt);

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

// Ruta de comprobación para saber si la API está activa.
app.get('/', (req, res) => {
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
    if (!password || (!email && !username)) {
      return res.status(400).json({ message: 'Debes enviar usuario o email y password' });
    }

    const user = await User.findOne(email ? { email } : { username });

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

// Conecta primero con MongoDB y después empieza a aceptar peticiones.
async function startServer() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Conectado a MongoDB');

    app.listen(port, () => {
      console.log(`MoreFilms API disponible en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('No se pudo conectar a MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();
