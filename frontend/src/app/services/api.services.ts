// src/app/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // ← ADD THIS IMPORT

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  // Autocomplete suggestions
  getSuggestions(keyword: string): Observable<any> {
    const params = new HttpParams().set('keyword', keyword);
    return this.http.get(`${this.apiUrl}/suggest`, { params });
  }

  // Search events
  searchEvents(searchParams: any): Observable<any> {
    let params = new HttpParams();
    Object.keys(searchParams).forEach((key) => {
      if (searchParams[key]) {
        params = params.set(key, searchParams[key]);
      }
    });
    return this.http.get(`${this.apiUrl}/events/search`, { params });
  }

  // Get event details
  getEventDetails(eventId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/events/${eventId}`);
  }

  // Search Spotify artist
  searchSpotifyArtist(artistName: string): Observable<any> {
    const params = new HttpParams().set('name', artistName);
    return this.http.get(`${this.apiUrl}/spotify/artist`, { params });
  }

  // Get Spotify artist albums
  getArtistAlbums(artistId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/spotify/artist/${artistId}/albums`);
  }

  // Get user location using ipinfo.io - NOW USES ENVIRONMENT VARIABLE
  getUserLocation(): Observable<any> {
    return this.http.get(`https://ipinfo.io/json?token=${environment.ipinfoToken}`);
  }

  // Geocode address using Google Maps API - NOW USES ENVIRONMENT VARIABLE
  geocodeAddress(address: string): Observable<any> {
    const params = new HttpParams()
      .set('address', address)
      .set('key', environment.googleMapsApiKey);
    return this.http.get('https://maps.googleapis.com/maps/api/geocode/json', { params });
  }
}
