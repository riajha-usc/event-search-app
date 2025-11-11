declare module 'latlon-geohash' {
  export function encode(lat: number, lon: number, precision?: number): string;
  export function decode(geohash: string): { lat: number; lon: number };
  export function bounds(geohash: string): { sw: { lat: number; lon: number }; ne: { lat: number; lon: number } };
  export function adjacent(geohash: string, direction: string): string;
  export function neighbours(geohash: string): any;
}