import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService, UsuarioRegistro } from '../../Services/api.service';

@Component({ selector: 'app-register', standalone: true, imports: [CommonModule, FormsModule, RouterModule], templateUrl: './register.component.html', styleUrl: './register.component.css' })
export class RegisterComponent {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  usuario: UsuarioRegistro = { username: '', email: '', password: '' };
  mensaje = '';
  enviando = false;

  onSubmit(): void {
    if (!this.usuario.username || !this.usuario.email || !this.usuario.password) { this.mensaje = 'Completa todos los campos.'; return; }
    this.enviando = true;
    this.mensaje = '';
    this.apiService.registrar(this.usuario).subscribe({
      next: () => { this.router.navigate(['/login']); },
      error: (error) => { this.enviando = false; this.mensaje = error.status === 409 ? 'El usuario o email ya está registrado.' : 'No se pudo crear la cuenta.'; },
    });
  }
}
