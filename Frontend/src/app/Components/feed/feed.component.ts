import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Publicacion } from '../../Services/api.service';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.css',
})
export class FeedComponent implements OnInit {
  private readonly apiService = inject(ApiService);

  usuarioActual = this.obtenerUsuarioActual();
  publicaciones: Publicacion[] = [];
  nuevosComentarios: Record<string, string> = {};
  nuevoPost: Publicacion = { autor: this.usuarioActual, contenido: '', pelicula: '' };
  cargando = false;
  mensaje = '';

  private obtenerUsuarioActual(): string {
    const username = localStorage.getItem('username');
    if (username) return username;
    const sesion = localStorage.getItem('morefilms_user');
    if (!sesion) return '';
    try { return JSON.parse(sesion).user?.username || ''; } catch { return ''; }
  }

  ngOnInit(): void { this.cargarFeed(); }

  cargarFeed(): void {
    this.cargando = true;
    this.apiService.obtenerPosts().subscribe({
      next: (posts) => { this.publicaciones = posts; this.cargando = false; },
      error: () => { this.mensaje = 'No se pudo cargar el feed.'; this.cargando = false; },
    });
  }

  publicar(): void {
    if (!this.nuevoPost.contenido.trim()) { this.mensaje = 'Escribe un contenido antes de publicar.'; return; }
    this.apiService.crearPost(this.nuevoPost).subscribe({
      next: () => { this.nuevoPost = { autor: this.usuarioActual, contenido: '', pelicula: '' }; this.mensaje = ''; this.cargarFeed(); },
      error: () => { this.mensaje = 'No se pudo crear la publicación.'; },
    });
  }

  borrar(id: string | undefined): void {
    if (!id || !this.usuarioActual || !window.confirm('¿Quieres eliminar esta publicación?')) return;
    this.apiService.eliminarPost(id, this.usuarioActual).subscribe({
      next: () => { this.publicaciones = this.publicaciones.filter((post) => post._id !== id); },
      error: (error) => { this.mensaje = error.status === 403 ? 'No tienes permiso para eliminar esta publicación.' : 'No se pudo eliminar la publicación.'; },
    });
  }

  editar(post: Publicacion): void {
    if (!post._id || post.autor !== this.usuarioActual) return;
    const contenido = window.prompt('Edita el comentario:', post.contenido);
    if (contenido === null || !contenido.trim()) return;
    const pelicula = window.prompt('Edita la película:', post.pelicula || '');
    if (pelicula === null) return;
    this.apiService.actualizarPost(post._id, { autor: this.usuarioActual, contenido: contenido.trim(), pelicula: pelicula.trim() }).subscribe({
      next: () => this.cargarFeed(),
      error: (error) => { this.mensaje = error.status === 403 ? 'No tienes permiso para editar esta publicación.' : 'No se pudo actualizar la publicación.'; },
    });
  }

  comentar(postId: string | undefined): void {
    const texto = postId ? this.nuevosComentarios[postId]?.trim() : '';
    if (!postId || !texto) return;
    this.apiService.agregarComentario(postId, { autor: this.usuarioActual, texto }).subscribe({
      next: () => { this.nuevosComentarios[postId] = ''; this.cargarFeed(); },
      error: () => { this.mensaje = 'No se pudo agregar el comentario.'; },
    });
  }
}
