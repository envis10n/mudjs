({
    name: "gossip",
    permissions: [],
    options: [],
    handler: async function(context = {}, args = [], options = {}){
        let message = args.join(" ");
        engine.grapevine.chat.send(context.caller.name, message, "gossip");
        engine.network.clients.broadcast({
            event: "print",
            payload: `[gossip] ${context.caller.name} says, ${message}`
        })
    }
})