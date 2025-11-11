import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.services';
import { FavoritesService } from '../../services/favorites.services';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject, of, firstValueFrom } from 'rxjs';
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
  styles: [
    `
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ],
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
  private isDetectingLocation = false; // FIX 1: Prevent multiple location calls
  detectedLocationName = ''; // Store friendly location name
  detectedCoordinates = ''; // Store lat,lng coordinates separately

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

    // Restore scroll position after view init
    setTimeout(() => {
      const savedScrollPosition = sessionStorage.getItem('scrollPosition');
      if (savedScrollPosition) {
        window.scrollTo(0, parseInt(savedScrollPosition));
        sessionStorage.removeItem('scrollPosition');
      }
    }, 100);
  }

  initializeForm(): void {
    this.searchForm = this.fb.group({
      keyword: ['', Validators.required],
      category: ['all', Validators.required],
      distance: [10, [Validators.required, Validators.min(1)]],
      location: ['', Validators.required],
      autoDetect: [false],
    });

    // FIX 1: Prevent repeated API calls
    this.searchForm.get('autoDetect')?.valueChanges.subscribe((checked) => {
      if (checked) {
        this.searchForm.get('location')?.disable();
        this.searchForm.get('location')?.clearValidators();
        this.searchForm.get('location')?.updateValueAndValidity();

        // Only detect location if not already detecting and coordinates are not already stored
        if (!this.isDetectingLocation && !this.detectedCoordinates) {
          this.detectLocation();
        } else if (this.detectedCoordinates) {
          // If we already have coordinates (e.g., from restore), just update the display
          this.searchForm.patchValue(
            {
              location: this.detectedLocationName,
            },
            { emitEvent: false }
          );
        }
      } else {
        this.searchForm.get('location')?.enable();
        this.searchForm.get('location')?.setValidators([Validators.required]);
        this.searchForm.get('location')?.updateValueAndValidity();
        // Don't clear coordinates immediately - user might toggle back
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

  hideAutocomplete(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  detectLocation(): void {
    // FIX 1: Prevent concurrent location detection
    if (this.isDetectingLocation) {
      return;
    }

    this.isDetectingLocation = true;

    this.apiService.getUserLocation().subscribe({
      next: (data) => {
        // Store lat,lng internally but don't show it to user
        this.detectedCoordinates = data.loc; // This is "lat,lng" format
        const city = data.city || '';
        const region = data.region || '';
        const country = data.country || '';

        // Display friendly location name to user
        this.detectedLocationName = [city, region, country].filter((x) => x).join(', ');

        // Store the friendly name in the form field for display
        this.searchForm.patchValue(
          {
            location: this.detectedLocationName,
          },
          { emitEvent: false }
        );

        console.log(`Location detected: ${this.detectedLocationName}`);
        this.isDetectingLocation = false;
      },
      error: (error) => {
        console.error('Error detecting location:', error);
        alert('Failed to detect location. Please enter manually.');
        this.searchForm.patchValue({ autoDetect: false }, { emitEvent: false });
        this.searchForm.get('location')?.enable();
        this.searchForm.get('location')?.setValidators([Validators.required]);
        this.searchForm.get('location')?.updateValueAndValidity();
        this.isDetectingLocation = false;
        this.detectedCoordinates = '';
        this.detectedLocationName = '';
      },
    });
  }

  async onSubmit(): Promise<void> {
    // FIX 2: Better form validation
    if (!this.searchForm.get('autoDetect')?.value) {
      if (
        this.searchForm.get('keyword')?.invalid ||
        this.searchForm.get('location')?.invalid ||
        this.searchForm.get('distance')?.invalid
      ) {
        Object.keys(this.searchForm.controls).forEach((key) => {
          this.searchForm.get(key)?.markAsTouched();
        });
        return;
      }
    } else {
      if (
        this.searchForm.get('keyword')?.invalid ||
        this.searchForm.get('distance')?.invalid ||
        !this.detectedCoordinates
      ) {
        Object.keys(this.searchForm.controls).forEach((key) => {
          this.searchForm.get(key)?.markAsTouched();
        });
        if (!this.detectedCoordinates) {
          alert('Please wait for location detection to complete.');
        }
        return;
      }
    }

    this.isSearching = true;
    this.noResults = false;

    const formValue = this.searchForm.getRawValue();
    let geoPoint = '';

    try {
      if (formValue.autoDetect && this.detectedCoordinates) {
        // ✅ Use stored coordinates from auto-detect
        const [lat, lng] = this.detectedCoordinates.split(',');
        geoPoint = Geohash.encode(parseFloat(lat), parseFloat(lng), 7);
        console.log('Using auto-detected coordinates:', this.detectedCoordinates);
      } else {
        // ✅ Manual location: Geocode
        const geocode = await firstValueFrom(this.apiService.geocodeAddress(formValue.location));

        console.log('Geocode response:', geocode);

        if (geocode && geocode.status === 'OK' && geocode.results?.length > 0) {
          const location = geocode.results[0].geometry.location;
          geoPoint = Geohash.encode(location.lat, location.lng, 7);
          console.log('Using geocoded coordinates:', location.lat, location.lng);
        } else {
          const errorMsg =
            geocode?.status === 'ZERO_RESULTS'
              ? 'Location not found. Please try a different address or city name.'
              : `Geocoding error: ${
                  geocode?.status || 'Unknown error'
                }. Please check your Google Maps API key.`;
          alert(errorMsg);
          this.isSearching = false;
          return;
        }
      }

      const category = this.categories.find((cat) => cat.value === formValue.category);
      const segmentId = category?.id || '';

      const searchParams = {
        keyword: formValue.keyword,
        segmentId,
        radius: formValue.distance,
        unit: 'miles',
        geoPoint,
      };

      console.log('Search params:', searchParams);

      this.apiService.searchEvents(searchParams).subscribe({
        next: (data) => {
          this.isSearching = false;
          console.log('Search API Response:', data);

          if (data._embedded?.events?.length > 0) {
            this.events = this.parseEvents(data._embedded.events);
            this.noResults = false;
            this.saveSearchState();
            console.log('Parsed events:', this.events);
          } else {
            this.events = [];
            this.noResults = true;
            console.log('No events found in response');
          }
        },
        error: (error) => {
          console.error('Search error:', error);
          this.isSearching = false;
          this.events = [];
          this.noResults = true;
        },
      });
    } catch (error: any) {
      console.error('Geocoding or search error:', error);
      this.isSearching = false;
      this.events = [];
      this.noResults = true;
    }
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
        // Sort by ascending order of Local Date/Time as per assignment requirement
        const dateTimeA = a.date
          ? new Date(a.date + ' ' + (a.time || '00:00:00'))
          : new Date('9999-12-31');
        const dateTimeB = b.date
          ? new Date(b.date + ' ' + (b.time || '00:00:00'))
          : new Date('9999-12-31');
        return dateTimeA.getTime() - dateTimeB.getTime();
      });
  }

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
    this.suggestions = [];
    this.showSuggestions = false;
    this.detectedCoordinates = ''; // Clear stored coordinates
    this.detectedLocationName = ''; // Clear stored location name
    this.clearSearchState();
    window.scrollTo(0, 0); // Reset scroll position on clear
  }

  viewEventDetail(eventId: string): void {
    // Save scroll position before navigating
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
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

    // FIX 3: Better feedback for favorites
    this.favoritesService.toggleFavorite(favoriteEvent).subscribe({
      next: () => {
        console.log('Favorite toggled successfully');
      },
      error: (error) => {
        console.error('Error toggling favorite:', error);
        alert('Failed to update favorites. Please try again.');
      },
    });
  }

  isFavorite(eventId: string): boolean {
    return this.favoritesService.isFavorite(eventId);
  }

  saveSearchState(): void {
    const stateToSave = {
      ...this.searchForm.getRawValue(),
      detectedCoordinates: this.detectedCoordinates,
      detectedLocationName: this.detectedLocationName,
    };
    sessionStorage.setItem('searchForm', JSON.stringify(stateToSave));
    sessionStorage.setItem('searchResults', JSON.stringify(this.events));
  }

  restoreSearchState(): void {
    const savedForm = sessionStorage.getItem('searchForm');
    const savedResults = sessionStorage.getItem('searchResults');

    if (savedForm) {
      const formData = JSON.parse(savedForm);
      // Restore the detected coordinates and location name
      this.detectedCoordinates = formData.detectedCoordinates || '';
      this.detectedLocationName = formData.detectedLocationName || '';

      // Remove them from formData before patching to avoid undefined properties
      delete formData.detectedCoordinates;
      delete formData.detectedLocationName;

      this.searchForm.patchValue(formData, { emitEvent: false });
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
      day: 'numeric',
    };
    let formatted = d.toLocaleDateString('en-US', options);
    if (time) {
      formatted += ` ${time}`;
    }
    return formatted;
  }
}
