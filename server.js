const express = require('express');
const cors = require('cors');
const ee = require('@google/earthengine');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static('public'));




// Mock database
let alerts = [
    { id: 1, lat: -3.4653, lng: -62.2159, date: new Date(), type: 'deforestation', confidence: 85 },
    { id: 2, lat: 2.8910, lng: -60.5326, date: new Date(), type: 'fire', intensity: 4.8 }
];

// API endpoints
app.get('/api/alerts', (req, res) => {
    res.header('Content-Type', 'application/json');
    res.json(alerts);
});

let latestInfo = null;

app.use(express.json()); // To parse JSON bodies

app.post('/info', (req, res) => {
    latestInfo = req.body;
    res.status(200).send('Info received');
});

app.get('/info', (req, res) => {
    if (latestInfo) {
        res.json(latestInfo);
    } else {
        res.status(404).send('No info available');
    }
});


// WebSocket for real-time updates
io.on('connection', (socket) => {
    setInterval(() => {
        const newAlert = {
            id: alerts.length + 1,
            lat: -5 + Math.random() * 10,
            lng: -60 + Math.random() * 10,
            date: new Date(),
            type: Math.random() > 0.5 ? 'deforestation' : 'fire',
            confidence: Math.floor(Math.random() * 100),
            intensity: Math.random() * 10
        };
        alerts.push(newAlert);
        socket.emit('new-alert', newAlert);
    }, 15000);
});



// Add this endpoint to your server.js
app.get('/api/reforestation', async (req, res) => {
    const { lat, lng } = req.query;
    
    try {
        // In a real app, you'd fetch from a proper API
        const data = {
            vegetation: (Math.sin(lat) * Math.cos(lng) * 0.5 + 0.5),
            carbon: Math.abs(lat * lng % 50),
            deforestationRisk: Math.abs(lat * lng % 100)
        };
        
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching reforestation data');
    }
});

// Add this endpoint to your server.js
app.get('/api/climate-proxy', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    try {
        const response = await fetch(url);
        const data = await response.text();
        res.send(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Error fetching climate data');
    }
});

const privateKey = require('./service-account.json');

// Initialize Earth Engine
async function initializeEE() {
  await new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(privateKey, resolve, reject);
  });
  await new Promise((resolve, reject) => {
    ee.initialize(null, null, resolve, reject);
  });
}

// Tile proxy endpoint
app.get('/ee-tiles/:encodedMapId/:z/:x/:y', async (req, res) => {
  try {
    const { encodedMapId, z, x, y } = req.params;
    const token = req.query.token;
    const mapId = decodeURIComponent(encodedMapId);
    
    const tileUrl = `https://earthengine.googleapis.com/v1/${mapId}/tiles/${z}/${x}/${y}`;
    // console.log('tile' +tileUrl)
    const response = await fetch(tileUrl, {
      timeout: 5000 // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Tile server responded with ${response.status}`);
    }
    
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600' // 1 hour cache
    });
    res.send(Buffer.from(await response.arrayBuffer()));
    
  } catch (error) {
    console.error('Tile fetch error:', {
      params: req.params,
      error: error.message
    });
    
    // Return transparent 1x1 pixel on error
    res.set('Content-Type', 'image/png');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  }
});
// Main endpoint for both Images and ImageCollections
app.post('/get-mapdata', async (req, res) => {
  try {
    console.log("Received request:", req.body); // Debug log
    
    const { dataset, visParams, dates } = req.body;
    if (!dataset) throw new Error("No dataset provided");

    let image;
    // try {
    //   // Try as Image first
    //   // image = ee.Image(dataset);
    //   // console.log("Loaded as Image");
    // } catch (imageError) {
      // Try as ImageCollection
      console.log("Trying as ImageCollection");
      let collection = ee.ImageCollection(dataset);
      
      // Apply date filter if provided
      if (dates?.start && dates?.end) {
        console.log(`Filtering from ${dates.start} to ${dates.end}`);
        collection = collection.filterDate(dates.start, dates.end);
      }
      
      image = collection.mosaic();
      console.log("Created mosaic from collection");
    // }

    // Verify the image
    // const sample = await ee.data.getPixels({
    //   image: image.select(visParams.bands || [0]).limit(1),
    //   grid: {
    //     crs: 'EPSG:4326',
    //     dimensions: {width: 1, height: 1}
    //   }
    // });
    // console.log("Sample pixel data:", sample);

    const mapId = await new Promise((resolve, reject) => {
      image.getMapId(visParams, (mapId, err) => {
        if (err) {
          console.error("getMapId error:", err);
          reject(err);
        } else {
          console.log("Generated mapId:", mapId);
          resolve(mapId);
        }
      });
    });

    res.json({
      mapid: mapId.mapid,
      token: mapId.token,
      tileUrl: `/ee-tiles/${encodeURIComponent(mapId.mapid)}/{z}/{x}/{y}?token=${mapId.token}`
    });
    
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

initializeEE().then(() =>{
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
});
