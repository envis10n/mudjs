const ipc = require('node-ipc');
const {fork} = require('child_process');
ipc.config.id = "mudjs_net";
ipc.config.retry = 1500;
ipc.config.silent = true;
let servers = new Map();
let engine = null;
let server_cb = new Map();
function get_clients(key){
    return new Promise((resolve, reject)=>{
        server_cb.set(key, (clients) => {
            server_cb.delete(key);
            resolve(clients);
        });
        servers.get(key).send({event: "sync"});
    });
}
ipc.serve(()=>{
    // Load network layer.
    let telnet = fork("net/telnet.js", [], {cwd: process.cwd()});
    telnet.on("message", (message)=>{
        if(engine == null) return;
        switch(message.event){
            case "sync":
                console.log("Received sync response from telnet.");
                let cb = server_cb.get("telnet");
                if(cb) cb(message.clients);
            break;
            default:
                ipc.server.emit(engine, "message", message);
            break;
        }
    });
    servers.set("telnet", telnet);
    ipc.server.on("connect", (socket)=>{
        engine = socket;
        servers.forEach(server=>{
            server.send({event: "engine.connect"});
        });
    });
    ipc.server.on("socket.disconnect", (...args)=>{
        engine = null;
        servers.forEach(server=>{
            server.send({event:"engine.disconnect"});
        });
    });
    ipc.server.on("message", async (message, socket)=>{
        switch(message.event){
            case "sync":
                console.log("Received sync request.");
                let telnet_clients = await get_clients("telnet");
                ipc.server.emit(socket, "message", {
                    event: "sync",
                    clients: telnet_clients
                });
                console.log("Sync response sent.");
            break;
            default:
                switch(message.protocol){
                    case "telnet":
                        telnet.send(message);
                    break;
                }
            break;
        }
    });
});
ipc.server.start();
