declare var COBI: any
COBI.init('token');
import { initializeApp } from 'firebase/app';
import { getDatabase, push, set,ref} from "firebase/database";

const firebaseConfig = {
    //...

    databaseURL:'https://cobibikeapp-default-rtdb.asia-southeast1.firebasedatabase.app/'
  };
  
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

function writeData(path:string, data:any){
    
    push(ref(db,path),data)
}


type coordinate={
    latitude:number,
    longtitude:number
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

set(ref(db,'/bike_data'),null)
const valStream = COBI.mobile.location.subscribe((data:COBIMobile)=>writeData('/bike_data',data))
COBI.navigationService.distanceToDestination.subscribe(console.log)
const route = COBI.navigationService.route.subscribe(console.log)

