const express = require('express');
const cors = require('cors');
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
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