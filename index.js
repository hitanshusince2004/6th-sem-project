const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());

// Sample lat & lng (you can update this dynamically or pass via query later)
let lat = -3.4653;
let lng = -62.2159;

// Utility to simulate getLocationInfo
async function getLocationInfo(lat, lng) {
    return {
        coordinates: { lat, lng },
        location: "Amazon Rainforest",
        address: {
            country: "Brazil",
            state: "Amazonas"
        },
        weather: {
            temperature: 27,
            humidity: 85,
            pressure: 1012,
            windSpeed: 3.5,
            condition: "Partly Cloudy",
            feelsLike: 29,
            cloudiness: 50
        },
        reforestation: {
            soilQuality: "73.4",
            rainfall: "1234.5",
            nativeSpecies: ["Teak", "Mahogany", "Bamboo"],
            deforestationRisk: "13.45",
            carbonSequestration: "35.2",
            vegetationIndex: "0.85",
            erosionRisk: "12.3",
            terrainType: "Plain",
            accessibility: "Moderate",
            biodiversityScore: "8.9"
        }
    };
}

// API Route


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
