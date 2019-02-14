let engine = require('./engine');

const protocols = {
    WS: 0,
    TELNET: 1,
    0: "WS",
    1: "TELNET"
};

module.exports.connect = async (client) => {
    if(client.login_attempts == undefined) client.login_attempts = 0;
    if(client.login_attempts >= 3) {
        client.send("Attempt limit reached.");
        client.close();
    }
    let username = await client.ask("What is your name? ");
    if(!(new RegExp(/[a-zA-Z]/g)).test(username)) {
        client.send("Names may only contain a-z and A-Z.");
        module.exports.connect(client);
    } else {
        let user = await engine.db.accounts.findOne({username: username});
        if(user === null){
            let password = await client.ask("Create your account by entering a password: ", true);
            if(client.type == protocols.TELNET) client.write("\n");
            let password2 = await client.ask("Retype password: ", true);
            if(password != password2) {
                client.send("Passwords did not match.");
                module.exports.connect(client);
            } else {
                let s = await util.crypto.hash_pass(password);
                delete password;
                delete password2;
                user = await engine.db.accounts.save({
                    _key: util.uuid(),
                    username,
                    password: {
                        hash: s.hash,
                        salt: s.salt
                    },
                    permissions: [],
                    created: Date.now(),
                    last_login: Date.now(),
                    flags: [],
                    online: true
                }, true);
                client.user = user._key;
                client.name = user.username;
                client.authenticated = true;
                client.send("Character creation is currently disabled.");
            }
        } else {
            let password = await client.ask("Enter password: ", true);
            if(!(await util.crypto.scrypt_compare(password, user.password.salt, user.password.hash))){
                client.login_attempts += 1;
                client.send("Incorrect password.");
                module.exports.connect(client);
            } else {
                client.authenticated = true;
                client.name = user.username;
                client.user = user._key;
                user.last_login = Date.now();
                user.online = true;
                user.update();
                client.auth();
                client.send("Character creation is currently disabled.");
            }
        }
    }
}

module.exports.command = async (socket, dobj) => {
    if(socket.internal.current_prompt !== null){
        socket.internal.current_prompt(dobj.command || dobj);
    } else if(socket.authenticated) {
        // Handle command
        if(dobj.command != undefined) dobj = dobj.command;
        if(dobj == "") return;
        let command = dobj.split(' ');
        let cmd = command[0];
        let args = command.slice(1);
        switch(cmd){
            default:
                command = engine.commands.get_command(cmd);
                if(command){
                    let argv = util.parse_arguments(args, command.options || []);
                    try {
                        let user = await engine.db.accounts.findOne({_key: socket.user});
                        if(util.hasPermissions(command.permissions, user.permissions)) {
                            let res = await command.handler({
                                caller: socket,
                                user
                            }, argv.args, argv.flags);
                            if(res !== undefined && res !== null) socket.print(res);
                        } else {
                            socket.print(`Unknown command: ${cmd}`);
                        }
                    } catch(e) {
                        console.log(e);
                        socket.print(`Error: ${e.message}`);
                    }
                } else {
                    socket.print(`Unknown command: ${cmd}`);
                }
            break;
        }
    }
}