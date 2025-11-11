import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="bg-blue-600 text-white shadow-lg">
      <div class="container mx-auto px-6">
        <div class="flex items-center justify-between h-20">
          <!-- Logo/Title -->
          <div class="flex-shrink-0">
            <h1 class="text-3xl font-bold tracking-tight">Events Around</h1>
          </div>
          
          <!-- Desktop Navigation -->
          <div class="hidden md:block">
            <div class="flex items-center space-x-2">
              <a 
                routerLink="/search" 
                routerLinkActive="bg-blue-700"
                [routerLinkActiveOptions]="{exact: false}"
                class="px-6 py-2 rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors"
              >
                Search
              </a>
              <a 
                routerLink="/favorites" 
                routerLinkActive="bg-blue-700"
                [routerLinkActiveOptions]="{exact: true}"
                class="px-6 py-2 rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors"
              >
                Favorites
              </a>
            </div>
          </div>
          
          <!-- Mobile menu button -->
          <div class="md:hidden">
            <button 
              (click)="toggleMobileMenu()"
              class="inline-flex items-center justify-center p-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path *ngIf="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path *ngIf="mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Mobile menu -->
      <div class="md:hidden border-t border-blue-700" *ngIf="mobileMenuOpen">
        <div class="px-4 pt-2 pb-3 space-y-1">
          <a 
            routerLink="/search" 
            routerLinkActive="bg-blue-700"
            (click)="toggleMobileMenu()"
            class="block px-4 py-3 rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors"
          >
            Search
          </a>
          <a 
            routerLink="/favorites" 
            routerLinkActive="bg-blue-700"
            (click)="toggleMobileMenu()"
            class="block px-4 py-3 rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors"
          >
            Favorites
          </a>
        </div>
      </div>
    </nav>
  `,
  styles: []
})
export class NavbarComponent {
  mobileMenuOpen = false;

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }
}