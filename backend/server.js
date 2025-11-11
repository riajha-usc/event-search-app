// server.js - Express Backend Server
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';     

dotenv.config();                

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist/frontend')));

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'your-mongodb-atlas-connection-string';
const DB_NAME = 'eventSearchDB';
const COLLECTION_NAME = 'favorites';

let db;
let favoritesCollection;

// Initialize MongoDB Connection
async function connectToDatabase() {
  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,  // Add this for development
      retryWrites: true,
      w: 'majority'
    });
    db = client.db(DB_NAME);
    favoritesCollection = db.collection(COLLECTION_NAME);
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// API Keys (Store in environment variables in production)
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY || 'your-ticketmaster-api-key';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'your-spotify-client-id';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'your-spotify-client-secret';

let spotifyToken = null;
let spotifyTokenExpiry = null;

// Get Spotify Access Token
async function getSpotifyToken() {
  if (spotifyToken && spotifyTokenExpiry && Date.now() < spotifyTokenExpiry) {
    return spotifyToken;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  spotifyToken = data.access_token;
  spotifyTokenExpiry = Date.now() + (data.expires_in * 1000);
  return spotifyToken;
}

// API Routes

// 1. Autocomplete/Suggest API
app.get('/api/suggest', async (req, res) => {
  try {
    const { keyword } = req.query;
    const url = `https://app.ticketmaster.com/discovery/v2/suggest?apikey=${TICKETMASTER_API_KEY}&keyword=${encodeURIComponent(keyword)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Suggest API error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// 2. Search Events API
app.get('/api/events/search', async (req, res) => {
  try {
    const { keyword, segmentId, radius, unit, geoPoint } = req.query;
    
    let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}`;
    
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (segmentId && segmentId !== 'all') url += `&segmentId=${segmentId}`;
    if (radius) url += `&radius=${radius}`;
    if (unit) url += `&unit=${unit}`;
    if (geoPoint) url += `&geoPoint=${geoPoint}`;
    
    url += '&size=20';
    
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Search events error:', error);
    res.status(500).json({ error: 'Failed to search events' });
  }
});

// 3. Event Details API
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const url = `https://app.ticketmaster.com/discovery/v2/events/${id}?apikey=${TICKETMASTER_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Event details error:', error);
    res.status(500).json({ error: 'Failed to fetch event details' });
  }
});

// 4. Spotify Artist Search API
app.get('/api/spotify/artist', async (req, res) => {
  try {
    const { name } = req.query;
    const token = await getSpotifyToken();
    
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Spotify artist search error:', error);
    res.status(500).json({ error: 'Failed to fetch artist data' });
  }
});

// 5. Spotify Artist Albums API
app.get('/api/spotify/artist/:id/albums', async (req, res) => {
  try {
    const { id } = req.params;
    const token = await getSpotifyToken();
    
    const url = `https://api.spotify.com/v1/artists/${id}/albums?include_groups=album&limit=3`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Spotify albums error:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// Favorites CRUD Operations

// Get all favorites
app.get('/api/favorites', async (req, res) => {
  try {
    const favorites = await favoritesCollection.find({}).toArray();
    res.json(favorites);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Check if event is favorite
app.get('/api/favorites/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const favorite = await favoritesCollection.findOne({ eventId });
    res.json({ isFavorite: !!favorite });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: 'Failed to check favorite status' });
  }
});

// Add to favorites
app.post('/api/favorites', async (req, res) => {
  try {
    const eventData = req.body;
    
    // Check if already exists
    const existing = await favoritesCollection.findOne({ eventId: eventData.eventId });
    if (existing) {
      return res.json({ message: 'Event already in favorites', data: existing });
    }
    
    const result = await favoritesCollection.insertOne({
      ...eventData,
      addedAt: new Date()
    });
    
    res.json({ message: 'Event added to favorites', data: { _id: result.insertedId, ...eventData } });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove from favorites
app.delete('/api/favorites/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await favoritesCollection.deleteOne({ eventId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ message: 'Event removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Serve Angular app for all other routes
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/event-search-app/browser/index.html'));
});

// Start server
connectToDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});