import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { toast } from 'ngx-sonner';

export interface FavoriteEvent {
  eventId: string;
  name: string;
  date: string;
  time: string;
  category: string;
  venue: string;
  image: string;
  addedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private apiUrl = '/api/favorites';
  private favoritesSubject = new BehaviorSubject<Map<string, FavoriteEvent>>(new Map());
  public favorites$ = this.favoritesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadFavorites();
  }

  // Load all favorites from backend
  loadFavorites(): void {
    this.http.get<any[]>(this.apiUrl).pipe(
      catchError(error => {
        console.error('Error loading favorites:', error);
        return of([]);
      })
    ).subscribe({
      next: (favorites) => {
        const favMap = new Map<string, FavoriteEvent>();
        favorites.forEach(fav => {
          const favoriteEvent: FavoriteEvent = {
            eventId: fav.eventId,
            name: fav.name,
            date: fav.date,
            time: fav.time,
            category: fav.category,
            venue: fav.venue,
            image: fav.image,
            addedAt: fav.addedAt
          };
          favMap.set(fav.eventId, favoriteEvent);
        });
        this.favoritesSubject.next(favMap);
        console.log('Loaded favorites:', Array.from(favMap.keys()));
      }
    });
  }

  // Get all favorites
  getFavorites(): Observable<FavoriteEvent[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      tap(favorites => {
        const favMap = new Map<string, FavoriteEvent>();
        favorites.forEach(fav => {
          favMap.set(fav.eventId, fav);
        });
        this.favoritesSubject.next(favMap);
      }),
      catchError(error => {
        console.error('Error getting favorites:', error);
        return of([]);
      })
    );
  }

  // Check if event is favorite
  isFavorite(eventId: string): boolean {
    return this.favoritesSubject.value.has(eventId);
  }

  // Add to favorites with toast notification
  addFavorite(event: FavoriteEvent): Observable<any> {
    return this.http.post(this.apiUrl, event).pipe(
      tap((response) => {
        console.log('Added to favorites:', event.eventId);
        const currentFavorites = this.favoritesSubject.value;
        currentFavorites.set(event.eventId, event);
        this.favoritesSubject.next(new Map(currentFavorites));
        
        // Show success toast
        toast.success(`${event.name} added to favorites!`);
      }),
      catchError(error => {
        console.error('Error adding favorite:', error);
        toast.error('Failed to add to favorites');
        throw error;
      })
    );
  }

  // Remove from favorites with toast notification and undo option
  removeFavorite(eventId: string, eventName?: string): Observable<any> {
    // Store the event data before removing for undo functionality
    const eventToRemove = this.favoritesSubject.value.get(eventId);
    
    return this.http.delete(`${this.apiUrl}/${eventId}`).pipe(
      tap(() => {
        console.log('Removed from favorites:', eventId);
        const currentFavorites = this.favoritesSubject.value;
        currentFavorites.delete(eventId);
        this.favoritesSubject.next(new Map(currentFavorites));
        
        // Show toast with undo button
        const displayName = eventName || eventToRemove?.name || 'Event';
        toast.success(`${displayName} removed from favorites!`, {
          action: eventToRemove ? {
            label: 'Undo',
            onClick: () => this.undoRemove(eventToRemove)
          } : undefined
        });
      }),
      catchError(error => {
        console.error('Error removing favorite:', error);
        toast.error('Failed to remove from favorites');
        throw error;
      })
    );
  }

  // Undo remove - re-add the event
  private undoRemove(event: FavoriteEvent): void {
    this.http.post(this.apiUrl, event).subscribe({
      next: () => {
        const currentFavorites = this.favoritesSubject.value;
        currentFavorites.set(event.eventId, event);
        this.favoritesSubject.next(new Map(currentFavorites));
        
        // Show re-added toast
        toast.success(`${event.name} re-added to favorites!`);
      },
      error: (error) => {
        console.error('Error re-adding favorite:', error);
        toast.error('Failed to re-add to favorites');
      }
    });
  }

  // Toggle favorite status
  toggleFavorite(event: FavoriteEvent): Observable<any> {
    if (this.isFavorite(event.eventId)) {
      return this.removeFavorite(event.eventId, event.name);
    } else {
      return this.addFavorite(event);
    }
  }
}