({
    name: "test",
    permissions: [],
    options: [],
    handler: async function(context = {}, args = [], options = {}){
        let classes = engine.game.classes.getDescriptions();
        return classes.map(cl=>`[${cl.name}]\n\t${cl.description}`).join('\n\n');
    }
})