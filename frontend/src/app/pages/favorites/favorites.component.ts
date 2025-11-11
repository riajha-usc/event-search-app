// src/app/pages/favorites/favorites.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FavoritesService, FavoriteEvent } from '../../services/favorites.services';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold mb-6">Favorites</h2>

      <!-- Empty State -->
      <div *ngIf="favorites.length === 0" class="text-center py-20">
        <svg class="mx-auto h-24 w-24 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <p class="text-2xl text-gray-500">No favorite events yet</p>
        <button
          (click)="goToSearch()"
          class="mt-6 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Search Events
        </button>
      </div>

      <!-- Favorites Grid -->
      <div *ngIf="favorites.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          *ngFor="let event of favorites"
          (click)="viewEventDetail(event.eventId)"
          class="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
        >
          <!-- Event Image -->
          <div class="relative h-48 bg-gray-200">
            <img
              [src]="event.image"
              [alt]="event.name"
              class="w-full h-full object-cover"
              (error)="$any($event.target).src='assets/placeholder.png'"
            />
            
            <!-- Favorite Button -->
            <button
              (click)="removeFavorite(event, $event)"
              class="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100"
            >
              <svg
                class="w-6 h-6 fill-red-500 text-red-500"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>

          <!-- Event Details -->
          <div class="p-4">
            <h3 class="font-bold text-lg mb-2 line-clamp-2">{{ event.name }}</h3>
            
            <div class="space-y-1 text-sm text-gray-600">
              <p><strong>Date:</strong> {{ event.date }} {{ event.time }}</p>
              <p><strong>Category:</strong> {{ event.category }}</p>
              <p><strong>Venue:</strong> {{ event.venue }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class FavoritesComponent implements OnInit {
  favorites: FavoriteEvent[] = [];
  isLoading = true;

  constructor(
    private favoritesService: FavoritesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
    
    // Subscribe to favorites changes
    this.favoritesService.favorites$.subscribe(favMap => {
      this.favorites = Array.from(favMap.values());
    });
  }

  loadFavorites(): void {
    this.favoritesService.getFavorites().subscribe({
      next: (favorites) => {
        this.favorites = favorites;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading favorites:', error);
        this.isLoading = false;
      }
    });
  }

  viewEventDetail(eventId: string): void {
    this.router.navigate(['/event', eventId]);
  }

  removeFavorite(event: FavoriteEvent, $event: MouseEvent): void {
    $event.stopPropagation();
    
    this.favoritesService.removeFavorite(event.eventId).subscribe({
      next: () => {
        // Show notification (implement toast/sonner here)
        console.log('Removed from favorites');
      },
      error: (error) => {
        console.error('Error removing favorite:', error);
      }
    });
  }

  goToSearch(): void {
    this.router.navigate(['/search']);
  }
}