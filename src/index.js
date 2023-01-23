"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
COBI.init('token');
const app_1 = require("firebase/app");
const database_1 = require("firebase/database");
const firebaseConfig = {
    //...
    databaseURL: 'https://cobibikeapp-default-rtdb.asia-southeast1.firebasedatabase.app/'
};
const app = (0, app_1.initializeApp)(firebaseConfig);
const db = (0, database_1.getDatabase)(app);
function writeData(path, data) {
    (0, database_1.push)((0, database_1.ref)(db, path), Object.assign(Object.assign({}, data), { 'time': (0, database_1.serverTimestamp)() }));
}
const speedDOM = document.getElementById('speed');
const distanceDOM = document.getElementById('distance');
const routeDOM = document.getElementById('route');
const coordDOM = document.getElementById('coordinate');
(0, database_1.set)((0, database_1.ref)(db, '/bike_data'), null);
const valStream = COBI.mobile.location.subscribe((data) => writeData('/bike_data', data));
COBI.mobile.location.subscribe(({ coordinate }) => coordDOM ? coordDOM.innerText = `lat:${coordinate.latitude},lon:${coordinate.longitude}` : null);
COBI.navigationService.distanceToDestination.subscribe((distance) => distanceDOM ? distanceDOM.innerText = `${distance.toFixed(2)} m` : null);
const route = COBI.navigationService.route.subscribe((route) => routeDOM ? routeDOM.innerText = `${route}` : null);
COBI.rideService.speed.subscribe((speed) => speedDOM ? speedDOM.innerText = `${speed.toFixed(2)} m/s` : null);
COBI.navigationService.control.route.subscribe(console.log);
