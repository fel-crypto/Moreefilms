import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UsuarioRegistro {
  email: string;
  username: string;
  password: string;
}

export interface CredencialesLogin {
  email?: string;
  username?: string;
  password: string;
}

export interface Publicacion {
  _id?: string;
  autor: string;
  contenido: string;
  pelicula?: string;
  fecha?: string;
  comentarios?: Comentario[];
}

export interface Comentario {
  _id?: string;
  autor: string;
  texto: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3003/api'
    : 'https://moreefilms.vercel.app/api';

  registrar(usuario: UsuarioRegistro): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/auth/register`, usuario);
  }

  login(credenciales: CredencialesLogin): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/auth/login`, credenciales);
  }

  obtenerPosts(): Observable<Publicacion[]> {
    return this.http.get<Publicacion[]>(`${this.apiUrl}/posts`);
  }

  crearPost(post: Publicacion): Observable<Publicacion> {
    return this.http.post<Publicacion>(`${this.apiUrl}/posts`, post);
  }

  eliminarPost(id: string, autor: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/posts/${id}`, { body: { autor } });
  }

  actualizarPost(id: string, datos: Partial<Publicacion>): Observable<Publicacion> {
    return this.http.put<Publicacion>(`${this.apiUrl}/posts/${id}`, datos);
  }

  agregarComentario(postId: string, comentarioData: Comentario): Observable<Publicacion> {
    return this.http.post<Publicacion>(`${this.apiUrl}/posts/${postId}/comentarios`, comentarioData);
  }
}
