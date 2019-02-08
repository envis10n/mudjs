({
    name: "reload",
    permissions: ["ADMINISTRATOR"],
    options: [],
    handler: async function(context = {}, args = [], options = {}){
        try {
            if(options.file) {
                return `Could not reload ${options.file}.`;
            } else {
                engine.commands.load_all();
                return "Commands reloaded.";
            }
        } catch(e) {
            return `Reload failed: ${e.message}`;
        }
    }
})