const WebSocket = require('ws');
const uuid = require('uuid/v4');
const _p = require('util').promisify;
const fs = require('fs');
const readFile = _p(fs.readFile);

function log(...args){
    let date = new Date();
    let stamp = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    console.log(`[${stamp}][WEBSOCKET]`, ...args);
}

let clients = new Map();

process.on('message', (message) => {
    let socket = clients.get(message.uuid);
    if(socket) {
        let dobj;
        switch(message.event){
            case "close":
                socket.close();
            break;
            case "ask":
                dobj = message.args[0];
                socket.ask(dobj.prompt, dobj.mask);
            break;
            case "send":
                socket.send(...message.args);
            break;
            case "auth":
                dobj = message.args[0];
                socket.authenticated = true;
                socket.name = dobj.name;
                socket.user = dobj.user;
            break;
        }
    } else {
        switch(message.event){
            case "sync":
                let c = Array.from(clients).map(el=>el[1]).map(el=>({
                    uuid: el.uuid,
                    authenticated: el.authenticated,
                    name: el.name,
                    user: el.user,
                    protocol: "websocket"
                }));
                process.send({event: "sync", clients: c});
            break;
            case "engine.connect":
                clients.forEach(client=>{
                    client.print("Connection to game service established.");
                });
            break;
            case "engine.disconnect":
                clients.forEach(client=>{
                    client.print("Connection to game service lost.");
                });
            break;
        }
    }
});

let wss = new WebSocket.Server({
    host: "localhost",
    port: 45678
}, () => {
    console.log(`WebSocket listening on localhost:45678...`);
});
wss.on('connection', async (socket) => {
    socket.uuid = uuid();
    socket.authenticated = false;
    socket.name = null;
    socket.internal = {};
    socket.internal.current_prompt = null;
    socket._send = socket.send;
    socket.ipc = (obj) => {
        process.send(Object.assign({ts: Date.now(), uuid: socket.uuid, protocol: "websocket"}, obj));
    }
    log(`[${socket.uuid}] Connected`);
    socket.send = (obj) => {
        if(typeof obj == "string") obj = {event: "print", payload: obj};
        if(socket.readyState == 1){
            socket._send(JSON.stringify(Object.assign({ts: Date.now()}, obj)));
            return true;
        } else return false;
    }
    socket.ask = (prompt, mask = false) => {
        return new Promise((resolve, reject)=>{
            if(socket.internal.current_prompt !== null) reject("Prompt already active.");
            else {
                socket.internal.current_prompt = (arg) => {
                    socket.internal.current_prompt = null;
                    resolve(arg);
                }
                socket.send({event:"prompt", prompt: prompt, mask});
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
                    if(dobj.command == "") return;
                    if(socket.internal.current_prompt !== null) {
                        socket.internal.current_prompt(dobj.command);
                    }
                    socket.ipc({event: "command", data: dobj});
                break;
                case "keep-alive":
                    socket.ipc({event: "keep-alive"});
                break;
            }
        } catch(e) {

        }
    });
    socket.on('error', (err) => {
        log(`[${socket.uuid}][ERROR]: ${err}`);
    });
    socket.on('close', (code, reason) => {
        log(`[${socket.uuid}] Disconnected`);
        clients.delete(socket.uuid);
    });
    clients.set(socket.uuid, socket);

    // Start keep-alive loop
    socket.send({event:"keep-alive"});
    socket.send(await readFile("welcome.txt"));
    socket.ipc({event: "connect"});
});