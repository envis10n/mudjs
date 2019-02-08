({
    name: "gossip",
    permissions: [],
    options: [],
    handler: async function(context = {}, args = [], options = {}){
        if(!context.caller.authenticated) return "You are not logged in.";
        let message = args.join(" ");
        engine.grapevine.chat.send(context.caller.name, message, "gossip");
        engine.network.clients.broadcast({
            event: "print",
            payload: `${context.caller.name} says, "${message}"`
        })
    }
})