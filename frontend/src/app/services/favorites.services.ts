import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

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
    this.http.get<FavoriteEvent[]>(this.apiUrl).subscribe({
      next: (favorites) => {
        const favMap = new Map<string, FavoriteEvent>();
        favorites.forEach(fav => favMap.set(fav.eventId, fav));
        this.favoritesSubject.next(favMap);
      },
      error: (error) => console.error('Error loading favorites:', error)
    });
  }

  // Get all favorites
  getFavorites(): Observable<FavoriteEvent[]> {
    return this.http.get<FavoriteEvent[]>(this.apiUrl);
  }

  // Check if event is favorite
  isFavorite(eventId: string): boolean {
    return this.favoritesSubject.value.has(eventId);
  }

  // Add to favorites
  addFavorite(event: FavoriteEvent): Observable<any> {
    return this.http.post(this.apiUrl, event).pipe(
      tap(() => {
        const currentFavorites = this.favoritesSubject.value;
        currentFavorites.set(event.eventId, event);
        this.favoritesSubject.next(new Map(currentFavorites));
      })
    );
  }

  // Remove from favorites
  removeFavorite(eventId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${eventId}`).pipe(
      tap(() => {
        const currentFavorites = this.favoritesSubject.value;
        currentFavorites.delete(eventId);
        this.favoritesSubject.next(new Map(currentFavorites));
      })
    );
  }

  // Toggle favorite status
  toggleFavorite(event: FavoriteEvent): Observable<any> {
    if (this.isFavorite(event.eventId)) {
      return this.removeFavorite(event.eventId);
    } else {
      return this.addFavorite(event);
    }
  }
}