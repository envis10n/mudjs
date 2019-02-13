// Global utilities
require('./src/util');
const ipc = require('node-ipc');
const Socket = require('./src/classes/socket');
let chalk = require('chalk');
chalk.level = 2;
ipc.config.id = "mudjs_engine";
ipc.config.retry = 1500;
ipc.config.silent = true;
function connectIPC(){
    return new Promise((resolve, reject)=>{
        ipc.connectTo("mudjs_net", () => {
            ipc.of.mudjs_net.on("connect", ()=>{
                resolve();
            });
        });
    });
}
// Load server
(async () => {
    // Load IPC connection.
    await connectIPC();
    // Load engine data so it gets cached.
    let engine = require('./src/modules/engine');
    let handlers = require('./src/modules/handlers');
    ipc.of.mudjs_net.on("message", async (message) => {
        let socket;
        switch(message.event){
            case "connect":
                socket = new Socket(message.uuid, message.protocol);
                socket.on("send", (obj) => {
                    ipc.of.mudjs_net.emit("message", obj);
                });
                socket.on("close", ()=>{
                    engine.network.clients.delete(socket.uuid);
                    if(socket.keep_alive !== null){
                        engine.world.timers.delete(socket.keep_alive.id);
                    }
                    socket = null;
                });
                engine.network.clients.set(socket.uuid, socket);
                handlers.connect(socket);
            break;
            case "close":
                socket = engine.network.clients.get(message.uuid);
                if(socket){
                    socket.emit("close");
                }
            break;
            case "command":
                socket = engine.network.clients.get(message.uuid);
                if(socket){
                    handlers.command(socket, message.data);
                }
            break;
            case "sync":
                console.log("Sync response received.");
                engine.network.clients.clear();
                message.clients = message.clients.filter(el=>el);
                for(let client of message.clients){
                    let nclient = new Socket(client.uuid, client.protocol);
                    nclient.authenticated = client.authenticated;
                    nclient.name = client.name;
                    nclient.user = client.user;
                    nclient.on("send", (obj) => {
                        ipc.of.mudjs_net.emit("message", obj);
                    });
                    nclient.on("close", ()=>{
                        engine.network.clients.delete(nclient.uuid);
                        if(socket.keep_alive !== null){
                            engine.world.timers.delete(socket.keep_alive.id);
                        }
                        nclient = null;
                    });
                    engine.network.clients.set(nclient.uuid, nclient);
                }
            break;
            case "keep-alive":
                socket = engine.network.clients.get(message.uuid);
                if(socket){
                    socket.keep_alive = engine.world.timers.after(25000, () => {
                        socket.keep_alive = null;
                        socket.send({event: "keep-alive"});
                    });
                }
            break;
        }
    });
    console.log("Requesting sync...");
    ipc.of.mudjs_net.emit("message", {event: "sync"});
    ipc.of.mudjs_net.on("disconnect", ()=>{
        engine.network.clients.clear();
    });
    // Load grapevine.
    let grapevine = require('./src/modules/grapevine');

    // Attach grapevine to engine.
    engine.grapevine = grapevine;
    
    if(process.env.GV_ENABLED == "true") {
        console.log("Connecting to Grapevine...");
        engine.grapevine.connect();
    }
    else console.log("Grapevine disabled.");
})();