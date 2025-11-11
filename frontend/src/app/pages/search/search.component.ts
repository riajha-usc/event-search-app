import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.services';
import { FavoritesService } from '../../services/favorites.services';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import * as Geohash from 'latlon-geohash';

interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
  category: string;
  venue: string;
  image: string;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search.component.html',
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class SearchComponent implements OnInit {
  searchForm!: FormGroup;
  events: Event[] = [];
  suggestions: any[] = [];
  showSuggestions = false;
  isLoadingSuggestions = false;
  isSearching = false;
  noResults = false;
  searchSubject = new Subject<string>();

  categories = [
    { value: 'all', label: 'All', id: '' },
    { value: 'music', label: 'Music', id: 'KZFzniwnSyZfZ7v7nJ' },
    { value: 'sports', label: 'Sports', id: 'KZFzniwnSyZfZ7v7nE' },
    { value: 'arts', label: 'Arts & Theatre', id: 'KZFzniwnSyZfZ7v7na' },
    { value: 'film', label: 'Film', id: 'KZFzniwnSyZfZ7v7nn' },
    { value: 'misc', label: 'Miscellaneous', id: 'KZFzniwnSyZfZ7v7n1' }
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    public favoritesService: FavoritesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.setupAutocomplete();
    this.restoreSearchState();
  }

  initializeForm(): void {
    this.searchForm = this.fb.group({
      keyword: ['', Validators.required],
      category: ['all', Validators.required],
      distance: [10, [Validators.required, Validators.min(1)]],
      location: ['', Validators.required],
      autoDetect: [false]
    });

    this.searchForm.get('autoDetect')?.valueChanges.subscribe(checked => {
      if (checked) {
        this.searchForm.get('location')?.disable();
        this.searchForm.get('location')?.setValue('');
        this.detectLocation();
      } else {
        this.searchForm.get('location')?.enable();
      }
    });
  }

  setupAutocomplete(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(keyword => {
        if (keyword && keyword.length > 0) {
          this.isLoadingSuggestions = true;
          return this.apiService.getSuggestions(keyword);
        }
        return of({ _embedded: {} });
      })
    ).subscribe({
      next: (data) => {
        this.isLoadingSuggestions = false;
        this.suggestions = data._embedded?.attractions || [];
        this.showSuggestions = this.suggestions.length > 0;
      },
      error: () => {
        this.isLoadingSuggestions = false;
        this.suggestions = [];
        this.showSuggestions = false;
      }
    });
  }

  onKeywordInput(event: any): void {
    const value = event.target.value;
    this.searchSubject.next(value);
  }

  selectSuggestion(suggestion: any): void {
    this.searchForm.patchValue({ keyword: suggestion.name });
    this.showSuggestions = false;
  }

  clearKeyword(): void {
    this.searchForm.patchValue({ keyword: '' });
    this.suggestions = [];
    this.showSuggestions = false;
  }

  hideAutocomplete(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  detectLocation(): void {
    this.apiService.getUserLocation().subscribe({
      next: (data) => {
        const location = data.loc;
        this.searchForm.patchValue({ 
          location: location,
          autoDetect: true 
        });
      },
      error: (error) => {
        console.error('Error detecting location:', error);
        alert('Failed to detect location. Please enter manually.');
        this.searchForm.patchValue({ autoDetect: false });
        this.searchForm.get('location')?.enable();
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.searchForm.invalid) {
      Object.keys(this.searchForm.controls).forEach(key => {
        this.searchForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSearching = true;
    this.noResults = false;

    const formValue = this.searchForm.getRawValue();
    let geoPoint = '';

    if (formValue.autoDetect) {
      const [lat, lng] = formValue.location.split(',');
      geoPoint = Geohash.encode(parseFloat(lat), parseFloat(lng), 7);
    } else {
      try {
        const geocode = await this.apiService.geocodeAddress(formValue.location).toPromise();
        if (geocode.results && geocode.results.length > 0) {
          const location = geocode.results[0].geometry.location;
          geoPoint = Geohash.encode(location.lat, location.lng, 7);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        this.isSearching = false;
        return;
      }
    }

    const category = this.categories.find(cat => cat.value === formValue.category);
    const segmentId = category?.id || '';

    const searchParams = {
      keyword: formValue.keyword,
      segmentId: segmentId,
      radius: formValue.distance,
      unit: 'miles',
      geoPoint: geoPoint
    };

    this.apiService.searchEvents(searchParams).subscribe({
      next: (data) => {
        this.isSearching = false;
        if (data._embedded && data._embedded.events) {
          this.events = this.parseEvents(data._embedded.events);
          this.noResults = this.events.length === 0;
          this.saveSearchState();
        } else {
          this.events = [];
          this.noResults = true;
        }
      },
      error: (error) => {
        console.error('Search error:', error);
        this.isSearching = false;
        this.events = [];
        this.noResults = true;
      }
    });
  }

  parseEvents(events: any[]): Event[] {
    return events.map(event => ({
      id: event.id,
      name: event.name,
      date: event.dates?.start?.localDate || '',
      time: event.dates?.start?.localTime || '',
      category: event.classifications?.[0]?.segment?.name || 'N/A',
      venue: event._embedded?.venues?.[0]?.name || 'N/A',
      image: event.images?.[0]?.url || ''
    })).sort((a, b) => {
      const dateA = new Date(a.date + ' ' + a.time);
      const dateB = new Date(b.date + ' ' + b.time);
      return dateA.getTime() - dateB.getTime();
    });
  }

  clearForm(): void {
    this.searchForm.reset({
      keyword: '',
      category: 'all',
      distance: 10,
      location: '',
      autoDetect: false
    });
    this.events = [];
    this.noResults = false;
    this.clearSearchState();
  }

  viewEventDetail(eventId: string): void {
    this.router.navigate(['/event', eventId]);
  }

  toggleFavorite(event: Event, $event: MouseEvent): void {
    $event.stopPropagation();
    
    const favoriteEvent = {
      eventId: event.id,
      name: event.name,
      date: event.date,
      time: event.time,
      category: event.category,
      venue: event.venue,
      image: event.image
    };

    this.favoritesService.toggleFavorite(favoriteEvent).subscribe();
  }

  isFavorite(eventId: string): boolean {
    return this.favoritesService.isFavorite(eventId);
  }

  saveSearchState(): void {
    sessionStorage.setItem('searchForm', JSON.stringify(this.searchForm.getRawValue()));
    sessionStorage.setItem('searchResults', JSON.stringify(this.events));
  }

  restoreSearchState(): void {
    const savedForm = sessionStorage.getItem('searchForm');
    const savedResults = sessionStorage.getItem('searchResults');
    
    if (savedForm) {
      this.searchForm.patchValue(JSON.parse(savedForm));
    }
    if (savedResults) {
      this.events = JSON.parse(savedResults);
    }
  }

  clearSearchState(): void {
    sessionStorage.removeItem('searchForm');
    sessionStorage.removeItem('searchResults');
  }

  formatDate(date: string, time: string): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    let formatted = d.toLocaleDateString('en-US', options);
    if (time) {
      formatted += ` ${time}`;
    }
    return formatted;
  }
}