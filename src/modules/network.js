const WebSocket = require('ws');
const Telnet = require('telnet');
let engine = require('./engine');

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
        wss.on('connection', (socket) => {
            socket.uuid = util.uuid();
            socket.type = protocols.WS;
            socket.authenticated = false;
            socket.name = null;
            socket.internal = {};
            socket.internal.current_prompt = null;
            socket._send = socket.send;
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
                                if(dobj.command == "") return;
                                let command = dobj.command.split(' ');
                                let cmd = command[0];
                                let args = command.slice(1);
                                switch(cmd){
                                    default:
                                        command = engine.commands.get(cmd);
                                        if(command){
                                            let argv = util.parse_arguments(args, command.options || []);
                                            try {
                                                let character;
                                                if(socket.authenticated) {
                                                    character = await engine.db.characters.findOne({name: socket.name});
                                                }
                                                if(command.permissions.find(el=>el == "ADMINISTRATOR") && character.acct_level < 3) return;
                                                let res = await command.handler({
                                                    caller: socket,
                                                    character
                                                }, argv.args, argv.flags);
                                                if(res !== undefined && res !== null) socket.print(res);
                                            } catch(e) {
                                                console.log(e);
                                                socket.print(`Error: ${e.message}`);
                                            }
                                        } else {
                                            socket.print(`Unknown command: ${cmd}`);
                                        }
                                    break;
                                }
                            }
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
                engine.network.clients.delete(socket.uuid);
            });
            engine.network.clients.set(socket.uuid, socket);

            // Start keep-alive loop
            socket.send({event:"keep-alive"});
            socket.send("Welcome to MUD.js!\n\nLogin (or create a character) with `auth`");
        });
    });
}

module.exports.load_telnet = () => {
    return new Promise((resolve, reject)=>{
        let tnet = Telnet.createServer((socket) => {
            socket.uuid = util.uuid();
            socket.authenticated = false;
            socket.name = null;
            socket.type = protocols.TELNET;
            socket.do.transmit_binary();
            socket.prompt = "$ ";
            socket.masked = false;
            socket.setMask = (n) => {
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
                            socket.write(socket.prompt);
                        break;
                    }
                } else {
                    data = Buffer.concat([Buffer.from("\r"+data), Buffer.from("\n"+socket.prompt)]);
                    socket.write(data);
                }
            }
            socket.ask = (prompt, mask = false) => {
                return new Promise((resolve, reject)=>{
                    if(socket.internal.current_prompt !== null) reject("Prompt already active.");
                    else {
                        socket.internal.current_prompt = (arg) => {
                            socket.internal.current_prompt = null;
                            socket.prompt = "$ ";
                            socket.setMask(false);
                            resolve(arg);
                        }
                        socket.send({event:"prompt", prompt, mask});
                    }
                });
            }
            socket.print = socket.send;
            socket.on('data', async (data) => {
                data = data.toString().trim();
                if(data == "") {
                    socket.write(socket.prompt);
                    return;
                }
                if(socket.internal.current_prompt !== null){
                    socket.internal.current_prompt(data);
                } else {
                    // Handle command
                    let command = data.split(' ');
                    let cmd = command[0];
                    let args = command.slice(1);
                    switch(cmd){
                        default:
                            command = engine.commands.get(cmd);
                            if(command){
                                let argv = util.parse_arguments(args, command.options || []);
                                try {
                                    let character;
                                    if(socket.authenticated) {
                                        character = await engine.db.characters.findOne({name: socket.name});
                                    }
                                    if(command.permissions.find(el=>el == "ADMINISTRATOR") && character.acct_level < 3) return;
                                    let res = await command.handler({
                                        caller: socket,
                                        character
                                    }, argv.args, argv.flags);
                                    if(res !== undefined && res !== null) socket.print(res);
                                } catch(e) {
                                    console.log(e);
                                    socket.send(`Error: ${e.message}`);
                                }
                            } else {
                                socket.send(`Unknown command: ${cmd}`);
                            }
                        break;
                    }
                }
            });
            socket.on('close', ()=>{
                engine.network.clients.delete(socket.uuid);
            });
            engine.network.clients.set(socket.uuid, socket);
            socket.write("Welcome to MUD.js!\n\nLogin (or create a character) with `auth`\n$ ");
        }).listen(23);
        resolve(tnet);
    });
}