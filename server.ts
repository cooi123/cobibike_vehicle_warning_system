import express from 'express';
import { Request, Response } from 'express';
import path = require("path")

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static('dist'));

app.get("/", (req:Request, res:Response) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
})

const server = app.listen (process.env.PORT || 4000);
// const portNumber = server.address().port;
// const {port}= server.address()
console.log("listening on "+ 4000);
console.log("listening on "+ 4000);


