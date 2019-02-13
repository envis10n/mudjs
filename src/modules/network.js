const WebSocket = require('ws');
const Telnet = require('telnet');
let engine = require('./engine');
let handlers = require('./handlers');

const protocols = {
    WS: 0,
    TELNET: 1,
    0: "WS",
    1: "TELNET"
};

module.exports.protocols = protocols;

module.exports.load_ws = () => {
    return new Promise((resolve, reject)=>{
        let wss = new WebSocket.Server({
            host: process.env.WS_HOST,
            port: process.env.WS_PORT
        }, () => {
            console.log(`WebSocket listening on ${process.env.WS_HOST}:${process.env.WS_PORT}...`);
            resolve(wss);
        });
        wss.on('connection', async (socket) => {
            socket.uuid = util.uuid();
            socket.type = protocols.WS;
            socket.authenticated = false;
            socket.name = null;
            socket.internal = {};
            socket.internal.current_prompt = null;
            socket._send = socket.send;
            console.log(`${protocols[socket.type]} Client ${socket.uuid} connected.`);
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
                            handlers.command(socket, dobj);
                        break;
                        case "keep-alive":
                            socket.keep_alive = engine.world.timers.after(25000, () => {
                                socket.keep_alive = null;
                                socket.send({event: "keep-alive"});
                            });
                        break;
                    }
                } catch(e) {

                }
            });
            socket.on('error', (err) => {
                console.log(`${socket.uuid}::Error: ${err}`);
            });
            socket.on('close', (code, reason) => {
                if(socket.keep_alive !== null) {
                    engine.world.timers.delete(socket.keep_alive.id);
                }
                engine.db.accounts.findOne({_key: socket.user}).then(user => {
                    user.online = false;
                    user.update();
                }, err => {

                });
                console.log(`${protocols[socket.type]} Client ${socket.uuid} disconnected.`);
                engine.network.clients.delete(socket.uuid);
            });
            engine.network.clients.set(socket.uuid, socket);

            // Start keep-alive loop
            socket.send({event:"keep-alive"});
            socket.send(await util.fs.readFile("welcome.txt"));
            handlers.connect(socket);
        });
    });
}

module.exports.load_telnet = () => {
    return new Promise((resolve, reject)=>{
        let tnet = Telnet.createServer(async (socket) => {
            socket.uuid = util.uuid();
            socket.readyState = true;
            socket._write = socket.write;
            socket.write = (data) => {
                try {
                    if(!socket.readyState) return;
                    socket._write(data);
                } catch(e) {
                    socket.readyState = false;
                }
            }
            socket.authenticated = false;
            socket.name = null;
            socket.type = protocols.TELNET;
            socket.do.transmit_binary();
            socket.prompt = "";
            socket.default_prompt = "";
            socket.masked = false;
            console.log(`${protocols[socket.type]} Client ${socket.uuid} connected.`);
            socket.close = () => {
                socket.readyState = false;
                socket.end();
            }
            socket.setMask = (n) => {
                if(!socket.readyState) return;
                socket.masked = n;
                if(n == true) {
                    socket.will.echo();
                } else {
                    socket.wont.echo();
                }
            }
            socket.internal = {
                current_prompt: null
            };
            socket.addPrompt = (input) => {
                if(input.length > 0) return `${input}\n${socket.prompt}`;
                else return socket.prompt;
            }
            socket.setPrompt = (prompt) => {
                socket.default_prompt = prompt;
            }
            socket.send = (data) => {
                if(typeof data == "object") {
                    switch(data.event){
                        case "print":
                            data = data.payload;
                            socket.send(data);
                        break;
                        case "prompt":
                            socket.prompt = data.prompt;
                            socket.setMask(data.mask);
                            socket.write('\n'+socket.prompt);
                        break;
                    }
                } else {
                    data = Buffer.concat([Buffer.from('\n'+data), Buffer.from("\n"+socket.prompt)]);
                    socket.write(data);
                }
            }
            socket.ask = (prompt, mask = false) => {
                return new Promise((resolve, reject)=>{
                    if(socket.internal.current_prompt !== null) reject("Prompt already active.");
                    else {
                        socket.internal.current_prompt = (arg) => {
                            socket.internal.current_prompt = null;
                            socket.prompt = socket.default_prompt;
                            socket.setMask(false);
                            resolve(arg);
                        }
                        socket.send({event:"prompt", prompt, mask});
                    }
                });
            }
            socket.print = socket.send;
            socket.on('end', ()=>{
                socket.readyState = false;
            });
            socket.on('data', async (data) => {
                data = data.toString().trim();
                if(data == "") {
                    return;
                }
                handlers.command(socket, data);
            });
            socket.on('error', (err) => {
                if(err.code != "ECONNRESET"){
                    console.log(`Telnet client error: ${err.message}`);
                }
            });
            socket.on('close', ()=>{
                engine.db.accounts.findOne({_key: socket.user}).then(user => {
                    user.online = false;
                    user.update();
                }, err => {

                });
                console.log(`${protocols[socket.type]} Client ${socket.uuid} disconnected.`);
                engine.network.clients.delete(socket.uuid);
            });
            engine.network.clients.set(socket.uuid, socket);
            socket.write(await util.fs.readFile("welcome.txt"));
            handlers.connect(socket);
        }).listen(23);
        resolve(tnet);
    });
}
