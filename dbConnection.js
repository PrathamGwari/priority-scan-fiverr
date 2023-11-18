const mongoose = require('mongoose');
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI;

function infoLog(message){ console.log(`[INFO] ${message} [/INFO]`) }

async function connectToDB() {
    try{
        infoLog(`MONGO_URI: ${MONGO_URI}`)
        const connect = await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        infoLog('Successfully connected to MongoDB');
    }
    catch(err){
        console.log(err);
        process.exit(1);
    }
}

module.exports = connectToDB;