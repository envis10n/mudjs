const ipc = require('node-ipc');
const {fork} = require('child_process');
ipc.config.id = "mudjs_net";
ipc.config.retry = 1500;
ipc.config.silent = true;
ipc.serve(()=>{
    // Load network layer.
    let telnet = fork("net/telnet.js", [], {cwd: process.cwd()});
    ipc.server.on("connect", (socket)=>{
        telnet.on("message", (message)=>{
            ipc.server.emit(socket, "message", message);
        });
    });
    ipc.server.on("message", (message)=>{
        switch(message.protocol){
            case "telnet":
                telnet.send(message);
            break;
        }
    });
});
ipc.server.start();
