const arangojs = require('arangojs');

let database = new arangojs.Database({
    url: "http://localhost:8529"
});

database.useDatabase(process.env.ARANGO_DB);
database.useBasicAuth(process.env.ARANGO_USER, process.env.ARANGO_PASSWORD);

let collections = JSON.parse(process.env.ARANGO_COLLECTIONS);

let cols = {};

for(let col of collections){
    cols[col] = database.collection(col);
    cols[col].exists().then(b=>{
        if(!b){
            cols[col].create().then(()=>{
                console.log(`Created collection: ${col}`);
            });
        }
    });
}

module.exports = cols;
