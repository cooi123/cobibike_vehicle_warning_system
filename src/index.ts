declare var COBI: any
COBI.init('token');
import { response } from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, push, set,ref, serverTimestamp, onValue, DataSnapshot} from "firebase/database";
import mapboxgl from 'mapbox-gl';
const mapboxMapMatching = require('@mapbox/mapbox-sdk/services/styles')
const MY_ACCESS_TOKEN =  "pk.eyJ1IjoiY2FsZWJvb2kiLCJhIjoiY2tvNTVrNnMzMG9tYjJwcncyY2JsamM1NyJ9.aoY9sduHWrxydrrwgC_6iA"
const mapMatching = mapboxMapMatching({ accessToken: MY_ACCESS_TOKEN })
const firebaseConfig = {
    //...

    databaseURL:'https://cobibikeapp-default-rtdb.asia-southeast1.firebasedatabase.app/'
  };
  
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
const dbRef= ref(db,"/bike_data")

function writeData(path:string, data:any){
    
    push(ref(db,path),{...data, 'time': serverTimestamp()})
}


type coordinate={
    latitude:number,
    longitude:number
}

interface BikeData{
    bearing:number,
    postion:coordinate,
    speed:number
    time:number
}

interface COBIMobile{
    coordinate: coordinate,
    bearing: number,
    altitude:number,
    speed:number,
    horizontalAccuracy:number,
    verticalAccuracy:number

}
const speedDOM= document.getElementById('speed')
const distanceDOM = document.getElementById('distance')
const routeDOM = document.getElementById('route')
const coordDOM = document.getElementById('coordinate')
const headingDOM = document.getElementById('heading')


set(ref(db,'/bike_data'),null)
const valStream = COBI.mobile.location.subscribe((data:COBIMobile)=>writeData('/bike_data',data))

COBI.mobile.location.subscribe(({coordinate,bearing}:COBIMobile)=>
{
    coordDOM?coordDOM.innerText=`lat:${coordinate.latitude},lon:${coordinate.longitude}`:null
    headingDOM?headingDOM.innerText=`${bearing}`:null
})

COBI.navigationService.distanceToDestination.subscribe((distance:number)=>distanceDOM?distanceDOM.innerText=`${distance.toFixed(2)} m`:null)
const route = COBI.navigationService.route.subscribe((route:number)=>routeDOM?routeDOM.innerText=`${route}`:null)
COBI.rideService.speed.subscribe((speed:number)=>speedDOM?speedDOM.innerText=`${speed.toFixed(2)} m/s`:null);
// COBI.navigationService.control.route.subscribe(console.log)

let nextPosMarker: mapboxgl.Marker;
onValue(dbRef,(snapshot)=>{
    const data = Object.values(snapshot.val())
    const locationData = data.map((x:any)=>x['coordinate'])
    if (locationData.length>2){
    const locationInLngLat = locationData.reduce((acc: string, current:coordinate,index)=>acc + `${current.longitude},${current.latitude};`,'')

    const predictPos= predictNextPos(data[data.length-1] as COBIMobile)
    if(nextPosMarker){
        nextPosMarker.remove()
    } 
    nextPosMarker = new mapboxgl.Marker().setLngLat([predictPos['longitude'],predictPos['latitude']]).addTo(map)
    const locationInLngLatWithPredicted = locationInLngLat + `${predictPos.longitude},${predictPos.latitude}`
    fetch('https://api.mapbox.com/matching/v5/mapbox/cycling/' + 
    locationInLngLatWithPredicted  + 
        `?access_token=${MY_ACCESS_TOKEN}` +
        '&geometries=geojson').then((response)=>response.json()).then((data)=>{
            const tracepoints = data["tracepoints"]
            const matched_coordinates = tracepoints.map((x:any)=>x["location"])

            const source: mapboxgl.GeoJSONSource = map.getSource('route') as mapboxgl.GeoJSONSource
            source?
            source.setData({
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': matched_coordinates
                    
                }
            }):
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
            
            map.panTo(matched_coordinates[0])
            console.log(matched_coordinates)
            console.log(matched_coordinates.slice(0,-1))
            const actualPathSource: mapboxgl.GeoJSONSource = map.getSource('actualRoute') as mapboxgl.GeoJSONSource
            actualPathSource?
            actualPathSource.setData({
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': matched_coordinates.slice(0,-1)
                    
                }
            }):
            map.addSource('actualRoute', {
                        'type': 'geojson',
                        'data': {
                            'type': 'Feature',
                            'properties': {},
                            'geometry': {
                                'type': 'LineString',
                                'coordinates': matched_coordinates.slice(0,-1)
                                
                            }
                        }
                    })
        })

        if(!map.getLayer("route")){
            map.addLayer({
                'id': 'route',
                'type': 'line',
                'source': 'route',
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#888',
                    'line-width': 8
                }
            })
        }
        if (!map.getLayer('actualRoute')){
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
                    'line-width': 8
                }
            })
        }

    }
    
})

function predictNextPos({coordinate,bearing,speed}:COBIMobile):coordinate{
    const time = 10
	const r= 6378137.0
	const lat = coordinate['latitude']
	const lon = coordinate['longitude']
	const x = speed * Math.sin(bearing * Math.PI / 180) * time / 3600;
	const y = speed * Math.cos(bearing * Math.PI / 180) * time / 3600;
	const newLat = lat + 180 / Math.PI * y / r;
	const newLon = lon + 180 / Math.PI / Math.sin(lat * Math.PI / 180) * x / r;
	return {latitude:newLat, longitude:newLon}
}


mapboxgl.accessToken= "pk.eyJ1IjoiY2FsZWJvb2kiLCJhIjoiY2tvNTVrNnMzMG9tYjJwcncyY2JsamM1NyJ9.aoY9sduHWrxydrrwgC_6iA"
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mapbox/streets-v12', // style URL
    center: [-122.483696, 37.833818], // starting position [lng, lat]
    zoom: 15 // starting zoom
});

// map.on('click', (e)=>{
//     fetch('https://api.mapbox.com/matching/v5/mapbox/driving/' + 
//     '-117.17282,32.71204;-117.17288,32.71225;-117.17293,32.71244;-117.17292,32.71256;-117.17298,32.712603;-117.17314,32.71259;-117.17334,32.71254' + 
//     `?access_token=${MY_ACCESS_TOKEN}` +
//     '&geometries=geojson').then((response)=>response.json()).then((data)=>{
//         const tracepoints = data["tracepoints"]
//         const matched_coordinates = tracepoints.map((x:any)=>x["location"])
//         map.addSource('route', {
//                     'type': 'geojson',
//                     'data': {
//                         'type': 'Feature',
//                         'properties': {},
//                         'geometry': {
//                             'type': 'LineString',
//                             'coordinates': matched_coordinates
                            
//                         }
//                     }
//                 })
//                 map.addLayer({
//                     'id': 'route',
//                     'type': 'line',
//                     'source': 'route',
//                     'layout': {
//                         'line-join': 'round',
//                         'line-cap': 'round'
//                     },
//                     'paint': {
//                         'line-color': '#888',
//                         'line-width': 8
//                     }
//                 })
//         map.panTo(matched_coordinates[0])
//     })
// })

        
