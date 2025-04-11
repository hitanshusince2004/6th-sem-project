// Initialize map and layers
const map = L.map('map').setView([-3.4653, -62.2159], 5);
let heatLayer, searchMarker = null;

// Add these variables at the top with your other declarations
let vegetationChart, carbonChart, deforestationChart;
let currentLocation = { lat: -3.4653, lng: -62.2159 };

// Add these with your other chart variables
let vegetationPredictionChart, carbonPredictionChart, deforestationPredictionChart;
let predictionData = {};

// Add this with your other constants at the top of main.js
const proxyUrl = 'http://localhost:3000/api/climate-proxy?url=';

// Base layers
const baseLayers = {
    "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri World Imagery'
    }),
    "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenTopoMap'
    }),
    "Street": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap'
    })
};

// Alert layer groups
const alertLayers = {
    "Deforestation": L.layerGroup(),
    "Fires": L.layerGroup()
};

// Initialize map components
function initializeMap() {
    baseLayers.Satellite.addTo(map);
    L.control.layers(baseLayers, alertLayers, { collapsed: false }).addTo(map);

    heatLayer = L.heatLayer([], {
        radius: 25,
        blur: 15,
        maxZoom: 10,
        gradient: { 0.4: 'blue', 0.6: 'lime', 1: 'red' }
    }).addTo(map);
}

// Socket.IO connection
const socket = io('http://localhost:3000', {
    transports: ['websocket'],
    withCredentials: true
});

// Alert processing
function processAlert(alert) {
    const marker = L.circleMarker([alert.lat, alert.lng], {
        color: alert.type === 'deforestation' ? '#ff4444' : '#ffaa00',
        fillColor: alert.type === 'deforestation' ? '#ff0000' : '#ff8800',
        radius: alert.type === 'deforestation' ? Math.sqrt(alert.confidence) : alert.intensity,
        fillOpacity: 0.7
    }).bindPopup(`
        <strong>${alert.type.toUpperCase()}</strong><br>
        Date: ${new Date(alert.date).toLocaleString()}<br>
        Coordinates: ${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}<br>
        ${alert.confidence ? `Confidence: ${alert.confidence}%` : ''}
    `);

    alert.type === 'deforestation'
        ? alertLayers.Deforestation.addLayer(marker)
        : alertLayers.Fires.addLayer(marker);

    heatLayer.addLatLng([alert.lat, alert.lng, alert.confidence || alert.intensity]);
}

// Search input with autocomplete
document.getElementById('search-input').addEventListener('input', async (e) => {
    const query = e.target.value;
    const datalist = document.getElementById('search-suggestions');

    if (query.length < 3) {
        datalist.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const results = await response.json();

        datalist.innerHTML = '';
        results.forEach(place => {
            const option = document.createElement('option');
            option.value = place.display_name;
            datalist.appendChild(option);
        });
    } catch (err) {
        console.error('Autocomplete error:', err);
    }
});

// On selecting a place
document.getElementById('search-input').addEventListener('change', async (e) => {
    const query = e.target.value;
    if (!query) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const results = await response.json();

        if (results.length > 0) {
            const place = results[0];
            const lat = parseFloat(place.lat);
            const lon = parseFloat(place.lon);

            map.setView([lat, lon], 10);
            if (searchMarker) map.removeLayer(searchMarker);
            searchMarker = L.marker([lat, lon]).addTo(map)
                .bindPopup(`<strong>${place.display_name}</strong>`)
                .openPopup();
        }
    } catch (error) {
        console.error('Search error:', error);
    }
});

// Fetch location & weather info
async function getLocationInfo(lat, lng) {
    try {
        const [nominatimResponse, weatherResponse] = await Promise.all([
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`),
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=85ba9bab0b044a5765bea06262ad6966&units=metric`)
        ]);

        const locationData = await nominatimResponse.json();
        const weatherData = await weatherResponse.json();

        return {
            coordinates: { lat, lng },
            location: locationData.display_name,
            address: locationData.address,
            weather: {
                temperature: weatherData.main.temp,
                humidity: weatherData.main.humidity,
                pressure: weatherData.main.pressure,
                windSpeed: weatherData.wind.speed,
                condition: weatherData.weather[0].description,
                feelsLike: weatherData.main.feels_like,
                cloudiness: weatherData.clouds.all
            },
            reforestation: {
                soilQuality: ((Math.sin(lat) * Math.cos(lng) * 0.5 + 0.5) * 100).toFixed(1),
                rainfall: (Math.random() * 3000).toFixed(1),
                nativeSpecies: ['Mahogany', 'Teak', 'Oak', 'Pine', 'Bamboo', 'Eucalyptus']
                    .sort(() => 0.5 - Math.random()).slice(0, 3),
                deforestationRisk: Math.abs(lat * lng % 100).toFixed(2),
                carbonSequestration: (Math.random() * 50).toFixed(2),
                vegetationIndex: (Math.random() * 1).toFixed(2),
                erosionRisk: (Math.random() * 100).toFixed(2),
                terrainType: ['Mountain', 'Plain', 'Plateau', 'Valley'][Math.floor(Math.random() * 4)],
                accessibility: ['Easy', 'Moderate', 'Difficult'][Math.floor(Math.random() * 3)],
                biodiversityScore: (Math.random() * 10).toFixed(2)
            }
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Info Panel
function showLoading() {
    document.querySelector('.loader').style.display = 'block';
    document.querySelector('.info-content').innerHTML = '';
    document.getElementById('info-panel').classList.add('active');
}

function showInfoPanel(data) {
    const content = document.querySelector('.info-content');
    document.querySelector('.loader').style.display = 'none';

    if (!data) {
        content.innerHTML = '<div class="error">Error loading location data</div>';
        return;
    }

    content.innerHTML = `
        <div class="info-item">
            <h4>Location</h4>
            <p>${data.location}</p>
            <p>Latitude: ${data.coordinates.lat.toFixed(4)}</p>
            <p>Longitude: ${data.coordinates.lng.toFixed(4)}</p>
            <p>Country: ${data.address?.country || 'N/A'}</p>
            <p>State: ${data.address?.state || 'N/A'}</p>
        </div>
        <div class="info-item">
            <h4>Weather</h4>
            <p>Temperature: ${data.weather.temperature}°C</p>
            <p>Feels Like: ${data.weather.feelsLike}°C</p>
            <p>Humidity: ${data.weather.humidity}%</p>
            <p>Pressure: ${data.weather.pressure} hPa</p>
            <p>Wind Speed: ${data.weather.windSpeed} m/s</p>
            <p>Cloudiness: ${data.weather.cloudiness}%</p>
            <p>Condition: ${data.weather.condition}</p>
        </div>
        <div class="info-item">
            <h4>Reforestation Potential</h4>
            <p>Soil Quality: ${data.reforestation.soilQuality}%</p>
            <p>Rainfall: ${data.reforestation.rainfall} mm</p>
            <p>Deforestation Risk: ${data.reforestation.deforestationRisk}%</p>
            <p>Carbon Sequestration: ${data.reforestation.carbonSequestration} t/ha</p>
            <p>Vegetation Index: ${data.reforestation.vegetationIndex}</p>
            <p>Erosion Risk: ${data.reforestation.erosionRisk}%</p>
            <p>Terrain Type: ${data.reforestation.terrainType}</p>
            <p>Accessibility: ${data.reforestation.accessibility}</p>
            <p>Biodiversity Score: ${data.reforestation.biodiversityScore}/10</p>
            <p>Native Species: ${data.reforestation.nativeSpecies.join(', ')}</p>
        </div>
        <div class="info-item">
            <a href="#" id="json-link">View as JSON</a>
        </div>
    `;

    document.getElementById('json-link').addEventListener('click', async (e) => {
        e.preventDefault();
        const jsonString = JSON.stringify(data, null, 4);
    
        try {
            const response = await fetch('http://localhost:3000/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: jsonString
            });
    
            if (response.ok) {
                window.open('http://localhost:5173/', '_blank');
            } else {
                console.error('Failed to send data');
            }
        } catch (err) {
            console.error('Error:', err);
        }
    });
    
}



function closePanel() {
    document.getElementById('info-panel').classList.remove('active');
}

// Map click event
map.on('click', async (e) => {
    showLoading();
    const info = await getLocationInfo(e.latlng.lat, e.latlng.lng);
    showInfoPanel(info);
});

async function fetchReforestationData(lat, lng) {
    try {
        // First get country ISO code using reverse geocoding
        const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const geoData = await geoResponse.json();
        const countryCode = geoData.address?.country_code?.toUpperCase();
        
        if (!countryCode) {
            throw new Error("Could not determine country code");
        }

        // Get climate data from World Bank API
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 10; // Last 10 years of data
        const endYear = currentYear - 1;
        
        const [tempResponse, precipResponse] = await Promise.all([
            fetch(`https://climateknowledgeportal.worldbank.org/api/data/get-download-data/historical/tas/${startYear}/${endYear}/${countryCode}`),
            fetch(`https://climateknowledgeportal.worldbank.org/api/data/get-download-data/historical/pr/${startYear}/${endYear}/${countryCode}`)
        ]);

        if (!tempResponse.ok || !precipResponse.ok) {
            throw new Error("Failed to fetch climate data");
        }

        const tempData = await tempResponse.text();
        const precipData = await precipResponse.text();

        // Process CSV data
        const processCSV = (csv) => {
            const lines = csv.split('\n').slice(1); // Skip header
            const result = {
                dates: [],
                values: []
            };
            
            lines.forEach(line => {
                if (line.trim()) {
                    const [year, value] = line.split(',');
                    result.dates.push(year);
                    result.values.push(parseFloat(value));
                }
            });
            
            return result;
        };

        const temp = processCSV(tempData);
        const precip = processCSV(precipData);

        // Generate vegetation indices based on climate data
        const ndvi = temp.values.map((t, i) => {
            // NDVI tends to be higher with moderate temps and good precipitation
            const tempFactor = Math.max(0, 1 - Math.abs(t - 20) / 20); // Optimal around 20°C
            const precipFactor = Math.min(1, precip.values[i] / 2000); // Scale precipitation
            return 0.2 + 0.6 * (tempFactor * 0.6 + precipFactor * 0.4);
        });

        const evi = ndvi.map(n => n * 0.9); // EVI is typically slightly lower than NDVI

        // Generate carbon sequestration estimates (tons per hectare)
        const carbon = temp.values.map((t, i) => {
            // Carbon sequestration is better with moderate temps and good precipitation
            const tempFactor = Math.max(0, 1 - Math.abs(t - 18) / 18);
            const precipFactor = Math.min(1, precip.values[i] / 1800);
            return 5 + 30 * (tempFactor * 0.5 + precipFactor * 0.5);
        });

        // Deforestation risk (percentage)
        const deforestation = temp.values.map((t, i) => {
            // Higher risk with higher temps and lower precipitation
            const tempRisk = Math.min(1, Math.max(0, (t - 25) / 15));
            const precipRisk = Math.min(1, Math.max(0, (1000 - precip.values[i]) / 1000));
            return 20 + 60 * (tempRisk * 0.6 + precipRisk * 0.4);
        });

        return {
            dates: temp.dates,
            ndvi,
            evi,
            carbon,
            deforestation,
            temperature: temp.values,
            precipitation: precip.values
        };
        
    } catch (error) {
        console.error("Error fetching climate data:", error);
        // Fallback to generated data if API fails
        return generateSampleData(lat, lng);
    }
}

function generateSampleData(lat, lng) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 10}, (_, i) => (currentYear - 9 + i).toString());
    
    // Generate data with some location-based variation
    const latFactor = Math.abs(lat / 90);
    const lngFactor = Math.abs(lng / 180);
    
    return {
        dates: years,
        ndvi: years.map(() => 0.3 + latFactor * 0.4 + (Math.random() * 0.2)),
        evi: years.map(() => 0.25 + latFactor * 0.35 + (Math.random() * 0.15)),
        carbon: years.map(() => 10 + latFactor * 25 + (Math.random() * 10)),
        deforestation: years.map(() => 20 + lngFactor * 50 + (Math.random() * 20)),
        temperature: years.map(() => 15 + latFactor * 10 + (Math.random() * 5)),
        precipitation: years.map(() => 800 + lngFactor * 1000 + (Math.random() * 400))
    };
}

function createVegetationChart(data) {
    const ctx = document.getElementById('vegetationChart');
    if (vegetationChart) vegetationChart.destroy();
    
    vegetationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'NDVI',
                    data: data.ndvi,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.3,
                    fill: true,
                    borderWidth: 2
                },
                {
                    label: 'EVI',
                    data: data.evi,
                    borderColor: '#8BC34A',
                    backgroundColor: 'rgba(139, 195, 74, 0.1)',
                    tension: 0.3,
                    fill: true,
                    borderWidth: 2
                }
            ]
        },
        options: getChartOptions('Vegetation Indices', { min: 0, max: 1 })
    });
}

function createCarbonChart(data) {
    const ctx = document.getElementById('carbonChart');
    if (carbonChart) carbonChart.destroy();
    
    carbonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'Carbon (t/ha)',
                    data: data.carbon,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Temperature (°C)',
                    data: data.temperature,
                    type: 'line',
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: getChartOptions('Carbon Sequestration & Temperature', 
            { beginAtZero: true }, 
            { beginAtZero: false, position: 'right' }
        )
    });
}

function createDeforestationChart(data) {
    const ctx = document.getElementById('deforestationChart');
    if (deforestationChart) deforestationChart.destroy();
    
    deforestationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'Deforestation Risk %',
                    data: data.deforestation,
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.3,
                    fill: true,
                    borderWidth: 2
                },
                {
                    label: 'Precipitation (mm)',
                    data: data.precipitation,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.3,
                    fill: true,
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: getChartOptions('Deforestation Risk & Precipitation', 
            { min: 0, max: 100 }, 
            { beginAtZero: true, position: 'right' }
        )
    });
}

function getChartOptions(title, yAxisOptions, y1AxisOptions = null) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: title,
                font: {
                    size: 14,
                    weight: 'bold'
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        },
        scales: {
            y: {
                ...yAxisOptions,
                grid: {
                    drawOnChartArea: !y1AxisOptions // Only draw grid if no secondary axis
                }
            }
        }
    };

    if (y1AxisOptions) {
        options.scales.y1 = {
            ...y1AxisOptions,
            grid: {
                drawOnChartArea: false
            },
            position: 'right'
        };
    }

    return options;
}

// Add these panel control functions
function showReforestationPanel() {
    document.getElementById('reforestation-panel').classList.add('active');
}

function closeReforestationPanel() {
    document.getElementById('reforestation-panel').classList.remove('active');
}



/**
 * Uses historical data to predict future trends using linear regression
 * @param {Array} historicalData - Array of historical values
 * @param {Array} years - Array of year labels
 * @param {number} futureYears - Number of years to predict
 * @returns {Object} - Contains predicted values and future year labels
 */
function predictFutureTrends(historicalData, years, futureYears = 5) {
    // Simple linear regression implementation
    const n = historicalData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    // Calculate regression coefficients
    historicalData.forEach((y, i) => {
        sumX += i;
        sumY += y;
        sumXY += i * y;
        sumXX += i * i;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Generate predictions
    const predictions = [];
    const futureLabels = [];
    const lastYear = parseInt(years[years.length - 1]);
    
    for (let i = 0; i < futureYears; i++) {
        const x = n + i;
        predictions.push(slope * x + intercept);
        futureLabels.push((lastYear + i + 1).toString());
    }
    
    return {
        predictions,
        futureLabels,
        slope,
        intercept
    };
}

async function generatePredictions(lat, lng) {
    try {
        // Get historical data
        const historicalData = await fetchReforestationData(lat, lng);
        
        // Predict each metric
        const vegetationPrediction = predictFutureTrends(historicalData.ndvi, historicalData.dates);
        const carbonPrediction = predictFutureTrends(historicalData.carbon, historicalData.dates);
        const deforestationPrediction = predictFutureTrends(historicalData.deforestation, historicalData.dates);
        
        return {
            historical: historicalData,
            predictions: {
                vegetation: vegetationPrediction,
                carbon: carbonPrediction,
                deforestation: deforestationPrediction
            }
        };
    } catch (error) {
        console.error("Prediction error:", error);
        return null;
    }
}

function createVegetationPredictionChart(data) {
    const ctx = document.getElementById('vegetationPredictionChart');
    if (vegetationPredictionChart) vegetationPredictionChart.destroy();
    
    vegetationPredictionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...data.historical.dates, ...data.predictions.vegetation.futureLabels],
            datasets: [
                {
                    label: 'Historical NDVI',
                    data: [...data.historical.ndvi, ...Array(data.predictions.vegetation.predictions.length).fill(null)],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2
                },
                {
                    label: 'Predicted NDVI',
                    data: [...Array(data.historical.ndvi.length).fill(null), ...data.predictions.vegetation.predictions],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true
                }
            ]
        },
        options: getChartOptions('Vegetation Index Prediction', { min: 0, max: 1 })
    });
}

// Similar functions for carbon and deforestation predictions...
function createCarbonPredictionChart(data) {
    const ctx = document.getElementById('carbonPredictionChart');
    if (carbonPredictionChart) carbonPredictionChart.destroy();
    
    carbonPredictionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...data.historical.dates, ...data.predictions.carbon.futureLabels],
            datasets: [
                {
                    label: 'Historical Carbon',
                    data: [...data.historical.carbon, ...Array(data.predictions.carbon.predictions.length).fill(null)],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2
                },
                {
                    label: 'Predicted Carbon',
                    data: [...Array(data.historical.carbon.length).fill(null), ...data.predictions.carbon.predictions],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true
                }
            ]
        },
        options: getChartOptions('Carbon Sequestration Prediction', { beginAtZero: true })
    });
}

function createDeforestationPredictionChart(data) {
    const ctx = document.getElementById('deforestationPredictionChart');
    if (deforestationPredictionChart) deforestationPredictionChart.destroy();
    
    deforestationPredictionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...data.historical.dates, ...data.predictions.deforestation.futureLabels],
            datasets: [
                {
                    label: 'Historical Risk',
                    data: [...data.historical.deforestation, ...Array(data.predictions.deforestation.predictions.length).fill(null)],
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2
                },
                {
                    label: 'Predicted Risk',
                    data: [...Array(data.historical.deforestation.length).fill(null), ...data.predictions.deforestation.predictions],
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true
                }
            ]
        },
        options: getChartOptions('Deforestation Risk Prediction', { min: 0, max: 100 })
    });
}

function showPredictionPanel() {
    document.getElementById('prediction-panel').classList.add('active');
}

function closePredictionPanel() {
    document.getElementById('prediction-panel').classList.remove('active');
}

map.on('click', async (e) => {
    showLoading();
    const { lat, lng } = e.latlng;
    currentLocation = { lat, lng };
    
    const info = await getLocationInfo(lat, lng);
    showInfoPanel(info);
    
    // Load and show historical data
    const reforestationData = await fetchReforestationData(lat, lng);
    createVegetationChart(reforestationData);
    createCarbonChart(reforestationData);
    createDeforestationChart(reforestationData);
    
    // Generate and show predictions
    predictionData = await generatePredictions(lat, lng);
    if (predictionData) {
        createVegetationPredictionChart(predictionData);
        createCarbonPredictionChart(predictionData);
        createDeforestationPredictionChart(predictionData);
    }
});

// Initialize map
initializeMap();
