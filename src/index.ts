declare var COBI: any
COBI.init('token');
import { initializeApp } from 'firebase/app';
import { getDatabase, push, set,ref, serverTimestamp} from "firebase/database";

const firebaseConfig = {
    //...

    databaseURL:'https://cobibikeapp-default-rtdb.asia-southeast1.firebasedatabase.app/'
  };
  
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

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

set(ref(db,'/bike_data'),null)
const valStream = COBI.mobile.location.subscribe((data:COBIMobile)=>writeData('/bike_data',data))

COBI.mobile.location.subscribe(({coordinate}:COBIMobile)=>coordDOM?coordDOM.innerText=`lat:${coordinate.latitude},lon:${coordinate.longitude}`:null)

COBI.navigationService.distanceToDestination.subscribe((distance:number)=>distanceDOM?distanceDOM.innerText=`${distance.toFixed(2)} m`:null)
const route = COBI.navigationService.route.subscribe((route:number)=>routeDOM?routeDOM.innerText=`${route}`:null)
COBI.rideService.speed.subscribe((speed:number)=>speedDOM?speedDOM.innerText=`${speed.toFixed(2)} m/s`:null);
COBI.navigationService.control.route.subscribe(console.log)