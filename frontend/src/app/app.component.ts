import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { NgxSonnerToaster } from 'ngx-sonner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, NgxSonnerToaster],
  template: `
    <div class="min-h-screen bg-gray-50">
      <app-navbar></app-navbar>
      <main class="py-8">
        <router-outlet></router-outlet>
      </main>
      <ngx-sonner-toaster position="top-center" [richColors]="true" />
    </div>
  `,
  styles: []
})
export class AppComponent {
  title = 'event-search-app';
}