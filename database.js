var mongoose = require('mongoose');
mongoose.connect('mongodb://SheduleTelegramBot:Password1!@scheduleusers-shard-00-00-1k8ex.mongodb.net:27017,scheduleusers-shard-00-01-1k8ex.mongodb.net:27017,scheduleusers-shard-00-02-1k8ex.mongodb.net:27017/test?ssl=true&replicaSet=ScheduleUsers-shard-0&authSource=admin', { useMongoClient: true });
var db = mongoose.connection;

console.log("db: ", db);

db.on('error', function (err) {
    console.log('connection error:', err.message);
});
db.once('open', function callback () {
    console.log("Connected to DB!");
});