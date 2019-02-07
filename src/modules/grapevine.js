const EventEmitter = require('events');
const WebSocket = require('ws');
let engine = require('./engine');

let gv = new EventEmitter();

gv.socket = null;

gv.connect = () => {
    if(gv.socket !== null) return;
    else {
        let ws = new WebSocket("wss://grapevine.haus/socket");

        ws._send = ws.send;

        ws.send = (obj) => {
            ws._send(JSON.stringify(Object.assign({ts: Date.now()}, obj)));
        }

        ws.once('open', ()=>{
            console.log("Grapevine connection established.");
            ws.send({
                "event": "authenticate",
                "payload": {
                    "client_id": process.env.GV_CLIENT_ID,
                    "client_secret": process.env.GV_CLIENT_SECRET,
                    "supports": JSON.parse(process.env.GV_SUPPORTS),
                    "channels": JSON.parse(process.env.GV_CHANNELS),
                    "version": process.env.GV_VERSION,
                    "user_agent": process.env.GV_USERAGENT
                }
            });
        });

        ws.on('message', data => {
            try {
                let dobj = JSON.parse(data);
                switch(dobj.event){
                    case "authenticate":
                        if(dobj.status == "success") {
                            console.log("Authenticated with grapevine.");
                        }
                    break;
                    case "heartbeat":
                        ws.send({
                            event: "heartbeat",
                            payload: {
                                players: Array.from(engine.network.clients).filter(el=>el[1].authenticated).map(el=>el[1].name)
                            }
                        });
                    break;
                }
            } catch(e) {
                console.log(`Error parsing grapevine: ${data}`);
            }
        });

        gv.socket = ws;
    }
}

module.exports = gv;