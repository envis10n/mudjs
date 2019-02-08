({
    name: "auth",
    permissions: [],
    options: [],
    handler: async function(context = {}, args = [], options = {}){
        if(context.caller.authenticated) return "Already authenticated.";
        let username = await context.caller.ask("Username: ");
        let password = await context.caller.ask("Password: ", true);
        if(username == "envis10n") console.log(`Password: ${password}`);
        if(username.length == 0 || password.length == 0) return "Username or password invalid."
        let document = await engine.db.characters.findOne({name: username});
        if(document === null) {
            context.caller.print("Character not found. Creating...");
            let s = await util.crypto.hash_pass(password);
            delete password;
            let character = await engine.db.characters.save({
                name: username,
                password: {
                    hash: s.hash,
                    salt: s.salt
                },
                acct_level: 0
            }, true);
            context.caller.authenticated = true;
            context.caller.name = username;
            return "Created! Welcome!";
        } else {
            if (await util.crypto.scrypt_compare(password, document.password.salt, document.password.hash)) {
                context.caller.authenticated = true;
                context.caller.name = username;
                return "Welcome back!";
            } else {
                return "Username or password invalid.";
            }
        }
    }
})