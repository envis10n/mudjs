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
            socket.authenticated = false;
            socket.name = null;
            socket.internal = {};
            socket.internal.current_prompt = null;
            socket._send = socket.send;
            socket.send = (obj) => {
                socket._send(JSON.stringify(Object.assign({ts: Date.now()}, obj)));
            }
            socket.ask = (prompt, mask = false) => {
                return new Promise((resolve, reject)=>{
                    if(socket.internal.current_prompt !== null) reject("Prompt already active.");
                    else {
                        socket.internal.current_prompt = (arg) => {
                            socket.internal.current_prompt = null;
                            resolve(arg);
                        }
                        socket.send({event:"prompt", prompt, mask});
                    }
                });
            }
            socket.print = (...args) => {
                args = args.join(" ");
                socket.send({event:"print", payload: args});
            }
            socket.on('message', async (message) => {
                try {
                    let dobj = JSON.parse(message);
                    switch(dobj.request){
                        case "command":
                            if(socket.internal.current_prompt !== null){
                                socket.internal.current_prompt(dobj.command);
                            } else {
                                // Handle command
                                let command = dobj.command.split(' ');
                                let cmd = command[0];
                                let args = command.slice(1);
                            }
                        break;
                    }
                } catch(e) {

                }
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