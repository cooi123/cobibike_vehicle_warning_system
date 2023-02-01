declare var COBI: any
COBI.init('token');
import { response } from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, push, set, ref, serverTimestamp, onValue, DataSnapshot, get, update } from "firebase/database";
import mapboxgl, { Marker } from 'mapbox-gl';
const mapboxMapMatching = require('@mapbox/mapbox-sdk/services/styles')
const MY_ACCESS_TOKEN = "pk.eyJ1IjoiY2FsZWJvb2kiLCJhIjoiY2tvNTVrNnMzMG9tYjJwcncyY2JsamM1NyJ9.aoY9sduHWrxydrrwgC_6iA"
const mapMatching = mapboxMapMatching({ accessToken: MY_ACCESS_TOKEN })
const firebaseConfig = {
    //...

    databaseURL: 'https://cobibikeapp-default-rtdb.asia-southeast1.firebasedatabase.app/'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const id = Date.now().toString(36) + Math.floor(Math.pow(10, 12) + Math.random() * 9 * Math.pow(10, 12)).toString(36)
const dbRef = ref(db, "/bike_data")
console.log(id)
function writeData(path: string, data: any) {

    push(ref(db, path), { ...data, 'time': serverTimestamp() })
}

mapboxgl.accessToken = "pk.eyJ1IjoiY2FsZWJvb2kiLCJhIjoiY2tvNTVrNnMzMG9tYjJwcncyY2JsamM1NyJ9.aoY9sduHWrxydrrwgC_6iA"
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
interface coordinateFromDB extends coordinate {
    time: number
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

    vehicleDOM ? vehicleDOM.innerText = `${map.getBearing() - data.bearing}` : null
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
                console.log(data)
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

// COBI.navigationService.control.route.subscribe(console.log)
let nextPosMarker: mapboxgl.Marker;
const movementDbRef = ref(db, "/bikeMovement")
let otherVehicleMarkers: Marker[] = [];
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
        dotElem.className = 'mapboxgl-user-location-dot'
        dotElem.classList.add('mapboxgl-user-location-show-heading')
        const headingElem = document.createElement('div')
        headingElem.className = 'mapboxgl-user-location-heading'
        dotElem.appendChild(headingElem)
        const currentLngLat: mapboxgl.LngLatLike = [value.currentPos.longitude, value.currentPos.latitude]
        const otherVehicleMarker = new mapboxgl.Marker(dotElem).setLngLat(currentLngLat).addTo(map)
        otherVehicleMarker.setRotation(value.bearing)
        return otherVehicleMarker
    })


    //check collision for each of them
    const dangerousVehicle = filterMovement.filter(val => intersects(currentBikePredictedPath.currentPos, currentBikePredictedPath.futurePos, val.currentPos, val.futurePos))
    const position = dangerousVehicle.map(val => {
        vehicleDOM ? vehicleDOM.innerText = `vehicle at ${getDirection(currentBikePredictedPath.currentPos, val.currentPos)}` : null
        return {
            direction: getDirection(currentBikePredictedPath.currentPos, val.currentPos),
            'distance': distance(currentBikePredictedPath.currentPos, val.currentPos)
        }
    })
    console.log(position)
    // filterMovement.map((val:[coordinateFromDB,co])=>{
    //     filterMovement.filter(p2=> intersects(val[0]['latitude'], val[0]['longitude'],val[1]['latitude'], val[1]['longitude'], p2[0]['latitude'], p2[0]['longitude'],p2[1]['latitude'], p2[1]['longitude']))
    // } )

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

console.log(`intersect ${intersects({ "latitude": 50.118746544727124, "longitude": 8.638783785656932 }, { "latitude": 50.118732786096054, "longitude": 8.638419005230906 }, { "latitude": 50.119001078688704, "longitude": 8.639025184468272 }, { "latitude": 50.118694949840226, "longitude": 8.639518710927012 })}`)

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
console.log(distance({ latitude: 50.1189, longitude: 8.63913633995057 }, { latitude: 50.118436033, longitude: 8.64002683 }))

function getDirection(currentPos: coordinate, otherVehiclePos: coordinate) {
    const lat1 = currentPos.latitude, ln1 = currentPos.longitude, lat2 = otherVehiclePos.latitude, ln2 = otherVehiclePos.longitude
    const dLat = lat2 - lat1,
        dLon = ln2 - ln1

    const bearing = Math.atan2(dLon, dLat) * (180 / Math.PI)
    var coordNames = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
    var coordIndex = Math.round(bearing / 45);
    if (coordIndex < 0) {
        coordIndex = coordIndex + 8
    };
    return coordNames[coordIndex]
}
console.log(getDirection({ "latitude": 50.118869362113756, "longitude": 8.639162559524522 }, { latitude: 50.119379, longitude: 8.63838 }))