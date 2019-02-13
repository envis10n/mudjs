const EventEmitter = require('events');

class Socket extends EventEmitter {
    constructor(uuid, protocol) {
        super();
        this.uuid = uuid;
        this.protocol = protocol;
        this.type = protocol == "telnet" ? 1 : 0;
        this.login_attempts = 0;
        this.authenticated = false;
        this.internal = {};
        this.internal.current_prompt = null;
        this.name = null;
        this.user = null;
    }
    ask(prompt, mask = false){
        return new Promise((resolve, reject)=>{
            if(this.internal.current_prompt !== null) reject("Prompt already active.");
            else {
                this.internal.current_prompt = (response) => {
                    this.internal.current_prompt = null;
                    resolve(response);
                }
                this.emit("send", {
                    event: "ask",
                    uuid: this.uuid,
                    protocol: this.protocol,
                    ts: Date.now(),
                    args: [{event:"prompt", prompt, mask}]
                });
            }
        });
    }
    write(data){
        this.send(data);
    }
    send(obj){
        this.emit("send", Object.assign({event: "send", uuid: this.uuid, protocol: this.protocol, ts: Date.now(), args: [obj]}));
    }
    print(...args){
        this.send({event: "print", payload: args.join(" ")});
    }
    close(){
        this.emit("send", {event: "close", uuid: this.uuid, protocol: this.protocol, ts: Date.now()});
    }
}

module.exports = Socket;