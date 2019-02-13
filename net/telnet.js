const Telnet = require('telnet');
const uuid = require('uuid/v4');
const _p = require('util').promisify;
const fs = require('fs');
const readFile = _p(fs.readFile);

function log(...args){
    let date = new Date();
    let stamp = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    console.log(`[${stamp}]`, ...args);
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
                    protocol: "telnet"
                }));
                process.send({event: "sync", clients: c});
            break;
        }
    }
});

Telnet.createServer(async (socket) => {
    socket.uuid = uuid();
    socket.readyState = true;
    socket._write = socket.write;
    socket.authenticated = false;
    socket.user = null;
    socket.name = null;
    socket.write = (data) => {
        try {
            if(!socket.readyState) return;
            socket._write(data);
        } catch(e) {
            socket.readyState = false;
        }
    }
    socket.do.transmit_binary();
    socket.prompt = "";
    socket.default_prompt = "";
    socket.masked = false;
    log(`[TELNET][${socket.uuid}] Connected`);
    socket.ipc = (obj) => {
        process.send(Object.assign({ts: Date.now(), uuid: socket.uuid, protocol: "telnet"}, obj));
    }
    socket.close = () => {
        socket.ipc({event: "close"});
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
        if(socket.internal.current_prompt !== null) {
            socket.internal.current_prompt(data);
        }
        socket.ipc({event: "command", data});
    });
    socket.on('error', (err) => {
        if(err.code != "ECONNRESET"){
            log(`[TELNET][${socket.uuid}][ERROR]: ${err.message}`);
        }
    });
    socket.on('close', ()=>{
        log(`[TELNET][${socket.uuid}] Disconnected`);
        clients.delete(socket.uuid);
        socket.ipc({event: "close"});
    });
    socket.write(await readFile("welcome.txt"));
    clients.set(socket.uuid, socket);
    socket.ipc({event: "connect"});
}).listen(23);