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

// Serve Angular static files from correct path
// During development: frontend is separate, so this won't work
// For production: you'll copy the build here
const angularDistPath = path.join(__dirname, 'dist', 'frontend', 'browser');
app.use(express.static(angularDistPath));

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
      tlsAllowInvalidCertificates: true,
      retryWrites: true,
      w: 'majority'
    });
    db = client.db(DB_NAME);
    favoritesCollection = db.collection(COLLECTION_NAME);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    // Continue without MongoDB for development
  }
}

// API Keys
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

  try {
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
  } catch (error) {
    console.error('Spotify token error:', error);
    return null;
  }
}

// ===== API ROUTES =====

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

// 2. CORRECTED Search Events API endpoint
app.get('/api/events/search', async (req, res) => {
  try {
    const { keyword, segmentId, radius, unit, geoPoint } = req.query;
    
    console.log('🔍 Search request:', { keyword, segmentId, radius, unit, geoPoint });
    
    let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}`;
    
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (segmentId && segmentId !== 'all' && segmentId !== '') url += `&segmentId=${segmentId}`;
    if (radius) url += `&radius=${radius}`;
    if (unit) url += `&unit=${unit}`;
    if (geoPoint) url += `&geoPoint=${geoPoint}`;
    
    url += '&size=20';
    
    console.log('📡 Ticketmaster URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('✅ Ticketmaster response:', data._embedded?.events?.length || 0, 'events');
    
    res.json(data);
  } catch (error) {
    console.error('❌ Search events error:', error);
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
    
    if (!token) {
      return res.status(500).json({ error: 'Failed to get Spotify token' });
    }
    
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
    
    if (!token) {
      return res.status(500).json({ error: 'Failed to get Spotify token' });
    }
    
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

// ===== FAVORITES CRUD OPERATIONS =====

// Get all favorites
app.get('/api/favorites', async (req, res) => {
  try {
    if (!favoritesCollection) {
      return res.json([]);
    }
    const favorites = await favoritesCollection.find({}).toArray();
    res.json(favorites);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.json([]);
  }
});

// Check if event is favorite
app.get('/api/favorites/:eventId', async (req, res) => {
  try {
    if (!favoritesCollection) {
      return res.json({ isFavorite: false });
    }
    const { eventId } = req.params;
    const favorite = await favoritesCollection.findOne({ eventId });
    res.json({ isFavorite: !!favorite });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.json({ isFavorite: false });
  }
});

// Add to favorites
app.post('/api/favorites', async (req, res) => {
  try {
    if (!favoritesCollection) {
      return res.json({ message: 'Database not connected', data: req.body });
    }
    
    const eventData = req.body;
    
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
    res.json({ message: 'Event added (DB unavailable)', data: req.body });
  }
});

// Remove from favorites
app.delete('/api/favorites/:eventId', async (req, res) => {
  try {
    if (!favoritesCollection) {
      return res.json({ message: 'Database not connected' });
    }
    
    const { eventId } = req.params;
    const result = await favoritesCollection.deleteOne({ eventId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ message: 'Event removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.json({ message: 'Removed (DB unavailable)' });
  }
});

// Health check endpoint (for testing)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongodb: !!favoritesCollection,
    timestamp: new Date().toISOString()
  });
});

// Serve Angular app for all other routes (only in production)
app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(angularDistPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Start server
connectToDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${angularDistPath}`);
    console.log(`🗄️  MongoDB: ${favoritesCollection ? 'Connected' : 'Not connected (favorites disabled)'}`);
  });
});