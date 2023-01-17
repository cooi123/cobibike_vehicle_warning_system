"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path = require("path");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.static('dist'));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});
const server = app.listen(process.env.PORT || 4000);
// const portNumber = server.address().port;
// const {port}= server.address()
console.log("listening on " + 4000);
