// src/app/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  // Autocomplete suggestions
  getSuggestions(keyword: string): Observable<any> {
    const params = new HttpParams().set('keyword', keyword);
    return this.http.get(`${this.apiUrl}/suggest`, { params });
  }

  // Corrected search endpoint (no /events prefix)
  searchEvents(searchParams: any): Observable<any> {
    let params = new HttpParams();
    Object.keys(searchParams).forEach(key => {
      if (searchParams[key]) {
        params = params.set(key, searchParams[key]);
      }
    });
    return this.http.get(`${this.apiUrl}/search`, { params });
  }

  // Get event details
  getEventDetails(eventId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/events/${eventId}`);
  }

  // Spotify Artist search
  searchSpotifyArtist(artistName: string): Observable<any> {
    const params = new HttpParams().set('name', artistName);
    return this.http.get(`${this.apiUrl}/spotify/artist`, { params });
  }

  // Spotify Artist albums
  getArtistAlbums(artistId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/spotify/artist/${artistId}/albums`);
  }

  // IPinfo with valid token from environment
  getUserLocation(): Observable<any> {
    const token = environment.ipinfoToken;
    return this.http.get(`https://ipinfo.io/json?token=${token}`);
  }

  // Geocode with Google Maps key from environment
  geocodeAddress(address: string): Observable<any> {
    const params = new HttpParams()
      .set('address', address)
      .set('key', environment.googleMapsApiKey);
    return this.http.get('https://maps.googleapis.com/maps/api/geocode/json', { params });
  }
}
