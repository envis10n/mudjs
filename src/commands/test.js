({
    name: "test",
    permissions: [],
    options: [],
    handler: async function(context = {}, args = [], options = {}){
        let answer = await context.caller.ask("What is your favorite color? ");
        return `Ah, ${answer} is your favorite color!`;
    }
})