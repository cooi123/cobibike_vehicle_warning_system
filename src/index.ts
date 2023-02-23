import "./style.css"
console.log(process.env["MAP_BOX_API"])
declare var COBI: any
//Cobibike library
COBI.init('token');
import { initializeApp } from 'firebase/app';
import { getDatabase, push, set, ref, serverTimestamp, onValue, DataSnapshot, get, update } from "firebase/database";
import mapboxgl, { Marker } from 'mapbox-gl';

const MY_ACCESS_TOKEN = process.env["MAP_BOX_API"] || "undefine"
const DATABASE_URL = process.env["DATABASE_URL"]
console.log(DATABASE_URL)
const firebaseConfig = {
    //...

    databaseURL: DATABASE_URL
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const id = Date.now().toString(36) + Math.floor(Math.pow(10, 12) + Math.random() * 9 * Math.pow(10, 12)).toString(36)
const dbRef = ref(db, "/bike_data")
console.log(id)
function writeData(path: string, data: any) {

    push(ref(db, path), { ...data, 'time': serverTimestamp() })
}

mapboxgl.accessToken = MY_ACCESS_TOKEN
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mapbox/streets-v12', // style URL
    center: [145.1321705849278, -37.907477131394], // starting position [lng, lat]
    zoom: 15, // starting zoom
    pitch: 60
});

map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    // When active the map will receive updates to the device's location as it changes.
    trackUserLocation: true,
    // Draw an arrow next to the location dot to indicate which direction the device is heading.
    showUserHeading: true
}))

const nav = new mapboxgl.NavigationControl({
    visualizePitch: true,
    showCompass: true
});
map.addControl(nav, 'bottom-right');

interface coordinate {
    latitude: number,
    longitude: number
}


interface currentPredict {
    currentPos: coordinate,
    futurePos: coordinate,
    time: number | object
    id?: string,
    bearing: number
}
interface BikeData {
    bearing: number,
    postion: coordinate,
    speed: number
    time: number
}

interface COBIMobile {
    coordinate: coordinate,
    bearing: number,
    altitude: number,
    speed: number,
    horizontalAccuracy: number,
    verticalAccuracy: number

}
const vehicleDOM = document.getElementById('nearbyVehicle')

const bikeData: COBIMobile[] = []

const dotElem = document.createElement('div')
dotElem.className = 'mapboxgl-user-location-dot'
dotElem.classList.add('mapboxgl-user-location-show-heading')
const headingElem = document.createElement('div')
headingElem.className = 'mapboxgl-user-location-heading'
dotElem.appendChild(headingElem)
const userLocationDotMarker = new mapboxgl.Marker({
    element: dotElem, rotationAlignment: 'map'
});

const valStream = COBI.mobile.location.subscribe((data: COBIMobile) => {
    // writeData(`/bike_data/${id}`, data)
    const currentLngLat: mapboxgl.LngLatLike = [data.coordinate.longitude, data.coordinate.latitude]
    map.easeTo({
        center: currentLngLat,
        bearing: Math.round(data.bearing), easing: x => x
    })
    userLocationDotMarker.setLngLat(currentLngLat).addTo(map)
    userLocationDotMarker.setRotation(data.bearing)
    // map.rotateTo(data.bearing, { duration: 2000 })

    bikeData.push(data)
    console.log(bikeData)
    const locationData = bikeData.map((x: any) => x['coordinate'])
    if (locationData.length > 2) {
        const locationInLngLat = locationData.reduce((acc: string, current: coordinate, index) => acc + `${current.longitude},${current.latitude};`, '')

        const predictPos = predictNextPos(bikeData[bikeData.length - 1] as COBIMobile)
        if (nextPosMarker) {
            nextPosMarker.remove()
        }
        // nextPosMarker = new mapboxgl.Marker().setLngLat([predictPos['longitude'], predictPos['latitude']]).addTo(map)
        const locationInLngLatWithPredicted = locationInLngLat + `${predictPos.longitude},${predictPos.latitude}`
        fetch('https://api.mapbox.com/matching/v5/mapbox/cycling/' +
            locationInLngLatWithPredicted +
            `?access_token=${MY_ACCESS_TOKEN}` +
            '&geometries=geojson').then((response) => {
                if (!response.ok) {
                    throw new Error("map matching")

                }
                return response.json()
            }).then((mapMatchingData) => {
                console.log(data.bearing)
                const tracepoints = mapMatchingData["tracepoints"]
                const filterTracpoints = tracepoints.filter((x: any) => x ? true : false)
                const matched_coordinates = filterTracpoints.map((x: any) => x["location"])
                const nextMovement: coordinate[] = matched_coordinates.slice(-2).map((point: [number, number]) => ({ longitude: point[0], latitude: point[1] }))
                const path: currentPredict = { currentPos: nextMovement[0], futurePos: nextMovement[1], time: serverTimestamp(), bearing: data.bearing }

                console.log(path)
                set(ref(db, "/bikeMovement/" + id), path)
            })
    }

})

let nextPosMarker: mapboxgl.Marker;
const movementDbRef = ref(db, "/bikeMovement")
let otherVehicleMarkers: Marker[] = [];


function flashWarning(bearing: number) {

    const mapDiv = document.querySelector('.flashing-div')
    const style = document.createElement('style');


    if (bearing > 0 && bearing < 90) {
        style.innerHTML = `
        .flashing {
          border-top-style: solid;
          animation: flashing-top 1s ease-in-out infinite;
        }
      `;
    } else if (bearing > 90 && bearing < 180) {
        style.innerHTML = `
        .flashing {
          border-right-style: solid;
          animation: flashing-right 1s ease-in-out infinite;
        }
      `;
    } else if (bearing > 180 && bearing < 270) {
        style.innerHTML = `
        .flashing {
          border-bottom-style: solid;
          animation: flashing-bottom 1s ease-in-out infinite;
        }
      `;
    } else if (bearing > 270 && bearing < 360) {
        style.innerHTML = `
        .flashing {
          border-left-style: solid;
          animation: flashing-left 1s ease-in-out infinite;
        }
      `;
    }

    document.head.appendChild(style);

    // Add the "flashing" class to start the animation
    mapDiv?.classList.add('flashing');

    // Remove the "flashing" class to stop the animation
    setTimeout(() => {
        mapDiv?.classList.remove('flashing');
    }, 5000); // stop after 5 seconds
}
onValue(movementDbRef, (snapshot) => {


    const currentPos = bikeData[bikeData.length - 1]

    const allMovement = snapshot.val()
    let currentBikePredictedPath: currentPredict;
    const data: currentPredict[] = Object.keys(allMovement).reduce((arr, key) => {
        if (key != id) {
            return arr.concat({ ...allMovement[key], id: key })
        } else {
            currentBikePredictedPath = allMovement[key]
            return arr
        }
    }, [])
    const currentTimeInUTCSecond = Date.now()
    const filterMovement: currentPredict[] = data.filter((val: any) => currentTimeInUTCSecond - val.time < 10 * 1000)
    console.log(filterMovement)
    //only show vehicle within certain radius

    otherVehicleMarkers.forEach(x => x.remove())
    otherVehicleMarkers = filterMovement.map(value => {
        const dotElem = document.createElement('div')
        dotElem.className = 'mymapboxgl-user-location-dot'
        dotElem.classList.add('mapboxgl-user-location-show-heading')
        const headingElem = document.createElement('div')
        // const dot: HTMLElement | null = document.querySelector('.mapboxgl-user-location-dot')
        // dot ? dot.style.backgroundColor = '#eed202' : null
        headingElem.className = 'mapboxgl-user-location-heading'
        dotElem.appendChild(headingElem)
        const currentLngLat: mapboxgl.LngLatLike = [value.currentPos.longitude, value.currentPos.latitude]
        const otherVehicleMarker = new mapboxgl.Marker(dotElem).setLngLat(currentLngLat).addTo(map)
        currentBikePredictedPath ? otherVehicleMarker.setRotation(value.bearing - currentBikePredictedPath.bearing) : otherVehicleMarker.setRotation(value.bearing)

        const source: mapboxgl.GeoJSONSource = map.getSource(`${value.id}`) as mapboxgl.GeoJSONSource
        source ?
            source.setData({
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': [[value.currentPos.longitude, value.currentPos.latitude], [value.futurePos.longitude, value.futurePos.latitude]]

                }
            }) :
            map.addSource(`${value.id}`, {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [[value.currentPos.longitude, value.currentPos.latitude], [value.futurePos.longitude, value.futurePos.latitude]]
                    }
                }
            })


        if (!map.getLayer(`${value.id}`)) {
            map.addLayer({
                'id': `${value.id}`,
                'type': 'line',
                'source': `${value.id}`,
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#FF5733',
                    'line-width': 8
                }
            })
        }


        return otherVehicleMarker
    })


    //check collision for each of them
    const dangerousVehicle = filterMovement.filter(val => distance(val.currentPos, currentBikePredictedPath.currentPos)).filter(val => intersects(currentBikePredictedPath.currentPos, currentBikePredictedPath.futurePos, val.currentPos, val.futurePos))
    const position = dangerousVehicle.map(val => {
        flashWarning(getDirection(currentBikePredictedPath, val.currentPos))
        vehicleDOM ? vehicleDOM.innerText = `vehicle at ${getDirection(currentBikePredictedPath, val.currentPos)}` : null
        return {
            direction: getDirection(currentBikePredictedPath, val.currentPos),
            'distance': distance(currentBikePredictedPath.currentPos, val.currentPos)
        }
    })
    console.log(position)

})

function predictNextPos({ coordinate, bearing, speed }: COBIMobile): coordinate {
    //second
    //speed m/s
    const time = 10
    const r = 6378137.0
    const lat = coordinate['latitude']
    const lon = coordinate['longitude']
    const x = speed * Math.sin(bearing * Math.PI / 180) * time;
    const y = speed * Math.cos(bearing * Math.PI / 180) * time;
    const newLat = lat + 180 / Math.PI * y / r;
    const newLon = lon + 180 / Math.PI / Math.sin(lat * Math.PI / 180) * x / r;
    return { latitude: newLat, longitude: newLon }
}




function intersects(p1: coordinate, p2: coordinate, a1: coordinate, a2: coordinate) {
    //https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
    const a = p1.latitude, b = p1.longitude, c = p2.latitude, d = p2.longitude, p = a1.latitude, q = a1.longitude, r = a2.latitude, s = a2.longitude
    var det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
        //parrell or colinear check distance
        return true;
    } else {
        lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
        gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }
};

function distance(p1: coordinate, p2: coordinate) {
    const lat1 = p1.latitude, lat2 = p2.latitude, lon1 = p1.longitude, lon2 = p2.longitude
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}

function getDirection(currentPos: currentPredict, otherVehiclePos: coordinate) {
    const lat1 = currentPos.currentPos.latitude, ln1 = currentPos.currentPos.longitude, lat2 = otherVehiclePos.latitude, ln2 = otherVehiclePos.longitude
    const dLat = lat2 - lat1,
        dLon = ln2 - ln1

    const bearing = Math.atan2(dLon, dLat) * (180 / Math.PI)
    return bearing - currentPos.bearing
}