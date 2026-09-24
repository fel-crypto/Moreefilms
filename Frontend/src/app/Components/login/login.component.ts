import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService, CredencialesLogin } from '../../Services/api.service';

@Component({ selector: 'app-login', standalone: true, imports: [CommonModule, FormsModule, RouterModule], templateUrl: './login.component.html', styleUrl: './login.component.css' })
export class LoginComponent {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  credenciales: CredencialesLogin = { username: '', password: '' };
  mensaje = '';
  enviando = false;

  onSubmit(): void {
    if (!this.credenciales.username || !this.credenciales.password) { this.mensaje = 'Introduce tu usuario y contraseña.'; return; }
    this.enviando = true;
    this.mensaje = '';
    this.apiService.login(this.credenciales).subscribe({
      next: (respuesta) => { localStorage.setItem('morefilms_user', JSON.stringify(respuesta)); this.router.navigate(['/feed']); },
      error: (error) => { this.enviando = false; this.mensaje = error.status === 401 ? 'El usuario o la contraseña no son correctos.' : 'No se pudo iniciar sesión.'; },
    });
  }
}
