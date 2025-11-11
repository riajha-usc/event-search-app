// src/app/pages/event-detail/event-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.services';
import { FavoritesService } from '../../services/favorites.services';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-detail.component.html',
  styles: []
})
export class EventDetailComponent implements OnInit {
  eventId: string = '';
  eventDetails: any = null;
  artists: any[] = [];
  venue: any = null;
  isLoading = true;
  activeTab: 'info' | 'artists' | 'venue' = 'info';
  isMusicEvent = false;
  spotifyArtists: any[] = [];
  isLoadingArtists = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    public favoritesService: FavoritesService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.eventId = params['id'];
      this.loadEventDetails();
    });
  }

  loadEventDetails(): void {
    this.isLoading = true;
    this.apiService.getEventDetails(this.eventId).subscribe({
      next: (data) => {
        this.eventDetails = data;
        this.venue = data._embedded?.venues?.[0];
        
        // Check if it's a music event
        const segment = data.classifications?.[0]?.segment?.name;
        this.isMusicEvent = segment?.toLowerCase() === 'music';
        
        // Extract artists/teams
        if (data._embedded?.attractions) {
          this.artists = data._embedded.attractions;
          if (this.isMusicEvent) {
            this.loadSpotifyData();
          }
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading event details:', error);
        this.isLoading = false;
      }
    });
  }

  loadSpotifyData(): void {
    if (!this.artists || this.artists.length === 0) return;
    
    this.isLoadingArtists = true;
    const artistPromises = this.artists.map(artist => 
      this.apiService.searchSpotifyArtist(artist.name).toPromise()
    );

    Promise.all(artistPromises).then(results => {
      this.spotifyArtists = results
        .map(result => result?.artists?.items?.[0])
        .filter(artist => artist !== undefined);
      
      // Load albums for each artist
      const albumPromises = this.spotifyArtists.map(artist =>
        this.apiService.getArtistAlbums(artist.id).toPromise()
      );
      
      return Promise.all(albumPromises);
    }).then(albumResults => {
      this.spotifyArtists = this.spotifyArtists.map((artist, index) => ({
        ...artist,
        albums: albumResults[index]?.items || []
      }));
      this.isLoadingArtists = false;
    }).catch(error => {
      console.error('Error loading Spotify data:', error);
      this.isLoadingArtists = false;
    });
  }

  goBack(): void {
    this.router.navigate(['/search']);
  }

  setActiveTab(tab: 'info' | 'artists' | 'venue'): void {
    this.activeTab = tab;
  }

  toggleFavorite(): void {
    if (!this.eventDetails) return;

    const favoriteEvent = {
      eventId: this.eventDetails.id,
      name: this.eventDetails.name,
      date: this.eventDetails.dates?.start?.localDate || '',
      time: this.eventDetails.dates?.start?.localTime || '',
      category: this.eventDetails.classifications?.[0]?.segment?.name || 'N/A',
      venue: this.venue?.name || 'N/A',
      image: this.eventDetails.images?.[0]?.url || ''
    };

    this.favoritesService.toggleFavorite(favoriteEvent).subscribe();
  }

  isFavorite(): boolean {
    return this.favoritesService.isFavorite(this.eventId);
  }

  shareOnFacebook(): void {
    const url = this.eventDetails?.url || '';
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  }

  shareOnTwitter(): void {
    const eventName = this.eventDetails?.name || '';
    const url = this.eventDetails?.url || '';
    const text = `Check ${eventName} on Ticketmaster`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  }

  getTicketStatus(): { text: string; class: string } {
    const status = this.eventDetails?.dates?.status?.code;
    switch (status) {
      case 'onsale':
        return { text: 'On Sale', class: 'bg-green-500 text-white' };
      case 'offsale':
        return { text: 'Off Sale', class: 'bg-red-500 text-white' };
      case 'canceled':
      case 'cancelled':
        return { text: 'Canceled', class: 'bg-black text-white' };
      case 'postponed':
        return { text: 'Postponed', class: 'bg-orange-500 text-white' };
      case 'rescheduled':
        return { text: 'Rescheduled', class: 'bg-orange-500 text-white' };
      default:
        return { text: 'N/A', class: 'bg-gray-500 text-white' };
    }
  }

  getGenres(): string {
    const classifications = this.eventDetails?.classifications?.[0];
    if (!classifications) return 'N/A';
    
    const parts = [
      classifications.segment?.name,
      classifications.genre?.name,
      classifications.subGenre?.name,
      classifications.type?.name,
      classifications.subType?.name
    ].filter(part => part);
    
    return parts.join(' | ') || 'N/A';
  }

  getPriceRange(): string {
    const priceRanges = this.eventDetails?.priceRanges;
    if (!priceRanges || priceRanges.length === 0) return 'N/A';
    
    const min = priceRanges[0].min;
    const max = priceRanges[0].max;
    const currency = priceRanges[0].currency || 'USD';
    
    return `${min} - ${max} ${currency}`;
  }

  // Artists Names ADDED
  getArtistNames(): string {
    if (!this.artists || this.artists.length === 0) return 'N/A';
    return this.artists.map(a => a.name).join(', ');
  }

  getVenueAddress(): string {
    if (!this.venue) return 'N/A';
    
    const parts = [
      this.venue.address?.line1,
      this.venue.city?.name,
      this.venue.state?.stateCode
    ].filter(part => part);
    
    return parts.join(', ') || 'N/A';
  }

  openGoogleMaps(): void {
    if (!this.venue?.location) return;
    
    const lat = this.venue.location.latitude;
    const lng = this.venue.location.longitude;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  }

  openVenueEvents(): void {
    const url = this.venue?.url;
    if (url) {
      window.open(url, '_blank');
    }
  }

  formatFollowers(count: number): string {
    return count?.toLocaleString() || '0';
  }
}