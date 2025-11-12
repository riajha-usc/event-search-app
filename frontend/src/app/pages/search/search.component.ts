// src/app/pages/search/search.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.services';
import { FavoritesService } from '../../services/favorites.services';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import Geohash from 'latlon-geohash';

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
  styleUrls: [],
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
  public isDetectingLocation = false;
  // Store detected coordinates and friendly name (not shown directly in the input value)
  detectedCoordinates: string = '';
  detectedLocationName: string = '';

  categories = [
    { value: 'all', label: 'All', id: '' },
    { value: 'music', label: 'Music', id: 'KZFzniwnSyZfZ7v7nJ' },
    { value: 'sports', label: 'Sports', id: 'KZFzniwnSyZfZ7v7nE' },
    { value: 'arts', label: 'Arts & Theatre', id: 'KZFzniwnSyZfZ7v7na' },
    { value: 'film', label: 'Film', id: 'KZFzniwnSyZfZ7v7nn' },
    { value: 'misc', label: 'Miscellaneous', id: 'KZFzniwnSyZfZ7v7n1' },
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
      autoDetect: [false],
    });

    // Listen to autoDetect changes
    this.searchForm.get('autoDetect')?.valueChanges.subscribe((checked) => {
      if (checked) {
        // Disable the location control without emitting another value change
        this.searchForm.get('location')?.disable({ emitEvent: false });
        // Clear any previous value (don't emit to avoid loops)
        this.searchForm.get('location')?.setValue('', { emitEvent: false });
        // Kick off IP detection only if not already running
        if (!this.isDetectingLocation) {
          this.detectLocation();
        }
      } else {
        // Re-enable location control without emitting value change
        this.searchForm.get('location')?.enable({ emitEvent: false });
      }
    });
  }

  setupAutocomplete(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((keyword) => {
          if (keyword && keyword.length > 0) {
            this.isLoadingSuggestions = true;
            return this.apiService.getSuggestions(keyword);
          }
          return of({ _embedded: {} });
        })
      )
      .subscribe({
        next: (data) => {
          this.isLoadingSuggestions = false;
          this.suggestions = data._embedded?.attractions || [];
          this.showSuggestions = this.suggestions.length > 0;
        },
        error: () => {
          this.isLoadingSuggestions = false;
          this.suggestions = [];
          this.showSuggestions = false;
        },
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

  detectLocation(): void {
    if (this.isDetectingLocation) return;
    this.isDetectingLocation = true;

    this.apiService.getUserLocation().subscribe({
      next: (data) => {
        const loc = data.loc; // "lat,lng"
        // Save coordinates internally but do NOT write the raw coords into the visible input
        if (loc) {
          this.detectedCoordinates = loc;
        }

        // Build a friendly display name (city, region, country) if available
        const city = data.city || '';
        const region = data.region || '';
        const country = data.country || '';
        this.detectedLocationName = [city, region, country].filter(Boolean).join(', ');

        // Patch the visible location form control with the friendly name (keep control disabled)
        if (this.detectedLocationName) {
          this.searchForm.patchValue({ location: this.detectedLocationName }, { emitEvent: false });
        }

        this.isDetectingLocation = false;
      },
      error: (error) => {
        console.error('Error detecting location:', error);
        alert('Failed to detect location. Please enter manually.');
        // Turn off autoDetect without emitting (prevents loop)
        this.searchForm.patchValue({ autoDetect: false }, { emitEvent: false });
        this.searchForm.get('location')?.enable({ emitEvent: false });
        this.isDetectingLocation = false;
      },
    });
  }

  async onSubmit(): Promise<void> {
    if (this.searchForm.invalid) {
      Object.keys(this.searchForm.controls).forEach((key) => {
        this.searchForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSearching = true;
    this.noResults = false;

    const formValue = this.searchForm.getRawValue();
    let geoPoint = '';

    // Get coordinates
    if (formValue.autoDetect) {
      // Use internally stored detected coordinates (we don't write raw coords into the form input)
      if (!this.detectedCoordinates) {
        alert('Please wait for location detection to complete.');
        this.isSearching = false;
        return;
      }
      const [lat, lng] = this.detectedCoordinates.split(',');
      geoPoint = Geohash.encode(parseFloat(lat), parseFloat(lng), 7);
    } else {
      try {
        const geocode = await this.apiService.geocodeAddress(formValue.location).toPromise();
        if (geocode.results && geocode.results.length > 0) {
          const result = geocode.results[0];
          const location = result.geometry.location;

          // If user entered a large administrative area (e.g., a US state like "California")
          // Google Geocoding returns a single lat/lng usually near the geographic center which
          // may be far from populated areas. To compensate, increase the search radius when
          // the result type indicates a broad area.
          const resultTypes: string[] = result.types || [];
          // Default radius is the value from the form
          let effectiveRadius = Number(formValue.distance);

          if (resultTypes.includes('administrative_area_level_1')) {
            // State level -> use a large radius (200 miles) to cover the state
            effectiveRadius = Math.max(effectiveRadius, 200);
          } else if (resultTypes.includes('country')) {
            // Country -> very large radius
            effectiveRadius = Math.max(effectiveRadius, 800);
          } else if (resultTypes.includes('administrative_area_level_2')) {
            // County level -> medium radius
            effectiveRadius = Math.max(effectiveRadius, 100);
          }

          // store adjusted radius back to formValue so later searchParams uses it
          formValue.distance = effectiveRadius;

          geoPoint = Geohash.encode(Number(location.lat), Number(location.lng), 7);
          console.log(
            'Geocoded location types:',
            resultTypes,
            'using radius:',
            effectiveRadius,
            'geoPoint:',
            geoPoint
          );
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        this.isSearching = false;
        return;
      }
    }

    // Get segment ID
    const category = this.categories.find((cat) => cat.value === formValue.category);
    const segmentId = category?.id || '';

    // Search events
    const searchParams = {
      keyword: formValue.keyword,
      segmentId: segmentId,
      radius: formValue.distance,
      unit: 'miles',
      geoPoint: geoPoint,
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
      },
    });
  }

  parseEvents(events: any[]): Event[] {
    return events
      .map((event) => ({
        id: event.id,
        name: event.name,
        date: event.dates?.start?.localDate || '',
        time: event.dates?.start?.localTime || '',
        category: event.classifications?.[0]?.segment?.name || 'N/A',
        venue: event._embedded?.venues?.[0]?.name || 'N/A',
        image: event.images?.[0]?.url || '',
      }))
      .sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateA.getTime() - dateB.getTime();
      });
  }

  // Continued in template...

  clearForm(): void {
    this.searchForm.reset({
      keyword: '',
      category: 'all',
      distance: 10,
      location: '',
      autoDetect: false,
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
      image: event.image,
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

  // Hide autocomplete dropdown with small delay to allow click handlers to run
  hideAutocomplete(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  // Format date/time for display
  formatDate(date: string, time: string): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    let formatted = d.toLocaleDateString('en-US', options);
    if (time) {
      formatted += ` ${time}`;
    }
    return formatted;
  }
}
