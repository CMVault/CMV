echo 'const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./data/camera-vault.db");

db.all("SELECT * FROM cameras LIMIT 5", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    
    console.log("Sample camera data:");
    console.log(JSON.stringify(rows[0], null, 2));
    
    console.log("\nAll column names:");
    if (rows[0]) {
        console.log(Object.keys(rows[0]));
    }
});

db.close();' > fix-api-response.js
