declare var COBI: any
COBI.init('token');
import { response } from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, push, set, ref, serverTimestamp, onValue, DataSnapshot, get, update } from "firebase/database";
import mapboxgl from 'mapbox-gl';
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


interface coordinate {
    latitude: number,
    longitude: number
}
interface coordinateFromDB extends coordinate {
    time: number
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
const speedDOM = document.getElementById('speed')
const distanceDOM = document.getElementById('distance')
const routeDOM = document.getElementById('route')
const coordDOM = document.getElementById('coordinate')
const headingDOM = document.getElementById('heading')


let bikeId: string;

// const bikeNo= get(ref(db,'/bikeNumber')).then((datasnapshot=>{
//     if(datasnapshot.exists()){
//         bikeId =datasnapshot.val()
//         update(ref(db), {number: parseInt(bikeId) + 1})
//     }else{
//         push(ref(db,'/bikeNumber'),'1')
//     }
// console.log(bikeId)

//     }))
const bikeData: COBIMobile[] = []

const valStream = COBI.mobile.location.subscribe((data: COBIMobile) => {
    writeData(`/bike_data/${id}`, data)
    bikeData.push(data)
    const locationData = bikeData.map((x: any) => x['coordinate'])
    if (locationData.length > 2) {
        const locationInLngLat = locationData.reduce((acc: string, current: coordinate, index) => acc + `${current.longitude},${current.latitude};`, '')

        const predictPos = predictNextPos(bikeData[bikeData.length - 1] as COBIMobile)
        console.log(predictPos)
        console.log(locationData[bikeData.length - 1])
        if (nextPosMarker) {
            nextPosMarker.remove()
        }
        nextPosMarker = new mapboxgl.Marker().setLngLat([predictPos['longitude'], predictPos['latitude']]).addTo(map)
        const locationInLngLatWithPredicted = locationInLngLat + `${predictPos.longitude},${predictPos.latitude}`
        fetch('https://api.mapbox.com/matching/v5/mapbox/cycling/' +
            locationInLngLatWithPredicted +
            `?access_token=${MY_ACCESS_TOKEN}` +
            '&geometries=geojson').then((response) => response.json()).then((data) => {
                const tracepoints = data["tracepoints"]
                const matched_coordinates = tracepoints.map((x: any) => x["location"])
                const nextMovement: coordinate[] = matched_coordinates.slice(-2).map((point: [number, number]) => ({ longtitude: point[0], latitude: point[1] }))
                set(ref(db, "/bikeMovement/" + id), { ...nextMovement, 'time': serverTimestamp() })
                const source: mapboxgl.GeoJSONSource = map.getSource('route') as mapboxgl.GeoJSONSource
                source ?
                    source.setData({
                        'type': 'Feature',
                        'properties': {},
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': matched_coordinates

                        }
                    }) :
                    map.addSource('route', {
                        'type': 'geojson',
                        'data': {
                            'type': 'Feature',
                            'properties': {},
                            'geometry': {
                                'type': 'LineString',
                                'coordinates': matched_coordinates

                            }
                        }
                    })

                map.panTo(matched_coordinates[matched_coordinates.length - 1])
                console.log(matched_coordinates)
                console.log(matched_coordinates.slice(0, -1))
                const actualPathSource: mapboxgl.GeoJSONSource = map.getSource('actualRoute') as mapboxgl.GeoJSONSource
                actualPathSource ?
                    actualPathSource.setData({
                        'type': 'Feature',
                        'properties': {},
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': matched_coordinates.slice(0, -1)

                        }
                    }) :
                    map.addSource('actualRoute', {
                        'type': 'geojson',
                        'data': {
                            'type': 'Feature',
                            'properties': {},
                            'geometry': {
                                'type': 'LineString',
                                'coordinates': matched_coordinates.slice(0, -1)

                            }
                        }
                    })
            })

        if (!map.getLayer("route")) {
            map.addLayer({
                'id': 'route',
                'type': 'line',
                'source': 'route',
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
        if (!map.getLayer('actualRoute')) {
            map.addLayer({
                'id': 'actualRoute',
                'type': 'line',
                'source': 'actualRoute',
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#00f',
                    'line-width': 5
                }
            })
        }

    }

})


COBI.mobile.location.subscribe(({ coordinate, bearing }: COBIMobile) => {
    coordDOM ? coordDOM.innerText = `lat:${coordinate.latitude},lon:${coordinate.longitude}` : null
    headingDOM ? headingDOM.innerText = `${bearing}` : null
})

COBI.navigationService.distanceToDestination.subscribe((distance: number) => distanceDOM ? distanceDOM.innerText = `${distance.toFixed(2)} m` : null)
const route = COBI.navigationService.route.subscribe((route: number) => routeDOM ? routeDOM.innerText = `${route}` : null)
COBI.rideService.speed.subscribe((speed: number) => speedDOM ? speedDOM.innerText = `${speed.toFixed(2)} m/s` : null);
// COBI.navigationService.control.route.subscribe(console.log)
let nextPosMarker: mapboxgl.Marker;
const movementDbRef = ref(db, "/bikeMovement")
onValue(movementDbRef, (snapshot) => {
    const data = Object.values(snapshot.val())
    const currentTimeInUTCSecond = Date.now()
    const filterMovement = data.filter((val: any) => currentTimeInUTCSecond - val.time < 10 * 1000)
    console.log(filterMovement)
    //check collision for each of them

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


mapboxgl.accessToken = "pk.eyJ1IjoiY2FsZWJvb2kiLCJhIjoiY2tvNTVrNnMzMG9tYjJwcncyY2JsamM1NyJ9.aoY9sduHWrxydrrwgC_6iA"
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mapbox/streets-v12', // style URL
    center: [-122.483696, 37.833818], // starting position [lng, lat]
    zoom: 15 // starting zoom
});

function intersects(a: number, b: number, c: number, d: number, p: number, q: number, r: number, s: number) {
    //https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
    var det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
        //parrell or colinear check distance
        return false;
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
console.log(distance({ latitude: 50.1189, longitude: 8.63913633995057 }, { latitude: 50.118436033, longitude: 8.64002683 }))