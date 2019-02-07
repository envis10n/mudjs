const WebSocket = require('ws');
let engine = require('./engine');

module.exports.load = () => {
    return new Promise((resolve, reject)=>{
        let wss = new WebSocket.Server({
            host: process.env.WS_HOST,
            port: process.env.WS_PORT
        }, () => {
            console.log(`WebSocket listening on ${process.env.WS_HOST}:${process.env.WS_PORT}...`);
            resolve(wss);
        });
        wss.on('connection', (socket) => {
            socket.uuid = util.uuid();
            socket._send = socket.send;
            socket.send = (obj) => {
                socket._send(JSON.stringify(Object.assign({ts: Date.now()}, obj)));
            }
            socket.on('message', (message) => {
                console.log(`${socket.uuid}: ${message}`);
            });
            socket.on('error', (err) => {
                console.log(`${socket.uuid}::Error: ${err}`);
            });
            socket.on('close', (code, reason) => {
                engine.network.clients.delete(socket.uuid);
            });
            engine.network.clients.set(socket.uuid, socket);
        });
    });
}