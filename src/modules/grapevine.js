const EventEmitter = require('events');
const WebSocket = require('ws');
let engine = require('./engine');
let chalk = require('chalk');

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
                            engine.network.clients.broadcast({
                                event: "print",
                                payload: "Connection to grapevine established."
                            });
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
                    case "restart":
                        if(typeof dobj.payload.downtime != "number") dobj.payload.downtime = Number(dobj.payload.downtime);
                        console.log(`Grapevine restart initiated. Reconnecting in ${dobj.payload.downtime+15} seconds.`);
                        ws.close();
                        gv.socket = null;
                        engine.world.timers.after((dobj.payload.downtime+15) * 1000, () => {
                            gv.connect();
                        });
                    break;
                    case "channels/broadcast":
                        console.log(`Broadcast from [${dobj.payload.channel}] ${dobj.payload.name}@${dobj.payload.game}`);
                        engine.network.clients.broadcast({
                            event: "print",
                            payload: `${chalk.blueBright(`${dobj.payload.name}@${dobj.payload.game}`)} ${chalk.white('says,')} ${chalk.greenBright(`"${dobj.payload.message}"`)}`
                        });
                    break;
                    default:
                        console.log(`Unhandled grapevine event:`, dobj);
                    break;
                }
            } catch(e) {
                console.log(e);
                console.log(`Error parsing grapevine: ${data}`);
            }
        });

        ws.on('close', (code, reason) => {
            console.log("Lost connection to grapevine.");
            engine.network.clients.broadcast({
                event: "print",
                payload: "Disconnected from grapevine."
            });
        });

        gv.socket = ws;
    }
}

gv.chat = {};
gv.chat.send = (user, message, channel) => {
    if(!user || !message) return false;
    if(gv.socket === null) return false;
    gv.socket.send({
        event: "channels/send",
        ref: util.uuid(),
        payload: {
            channel: channel,
            name: user,
            message
        }
    });
}

module.exports = gv;