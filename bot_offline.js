var telegram = require('node-telegram-bot-api');
var emoji = require('node-emoji');
var moment = require('moment');
var mongoose = require('mongoose');
var PriorityQueue = require('js-priority-queue');
var db = mongoose.connection;
moment().format();
mongoose.connect('mongodb://SheduleTelegramBot:Password1!@scheduleusers-shard-00-00-1k8ex.mongodb.net:27017,scheduleusers-shard-00-01-1k8ex.mongodb.net:27017,scheduleusers-shard-00-02-1k8ex.mongodb.net:27017/test?ssl=true&replicaSet=ScheduleUsers-shard-0&authSource=admin', { useMongoClient: true });
console.log("db: ", db);
db.on('error', function (err) {
    console.log('connection error:', err.message);
});
db.once('open', function callback() {
    console.log("Connected to DB!");
    priorityQueue = new PriorityQueue({comparator: compareEvents});
    /*readEvents(priorityQueue);
    setTimeout(function () {
        console.log("PQlen - ", priorityQueue.length);
        while (priorityQueue.length != 0) {
            var e = priorityQueue.dequeue();
            notifyAboutEvent(e);
            console.log(e.notify);
        }
    }, 500);*/
    readEvents(priorityQueue);
    setTimeout(function (){
        init();
    } ,500);
});
var Schema = mongoose.Schema;
const usersStorageFile = 'users.json';
const token = '358469384:AAHYQ-NrDsfR6vbNf19pa1wflp56TIr4N_U';
var api = new telegram(token,{
    updates: {
        enabled: true,
        get_interval: 100
    },
    polling: true
});
const botMessage = {
    error: emoji.emojify("Oh, no! :sob: An error has occured! Please, try again later... "),
    start: emoji.emojify("Please, enter /remind if you are ready to add new event! :wink:"),
    greet: emoji.emojify(   "I want to help you to make shedules for your events :clock2:\n" +
                            "Moreover I can notify you :love_letter: so you would never miss your mother in law's birthday! ;3"),
    enterEvent: emoji.emojify("Okay! Please, enter the name of the event :smile:"),
    step0: emoji.emojify("Are you ready to create event? Please, enter /remind"),
    step1: emoji.emojify("Great! Now enter the date :clock2: in this format YYYY-MM-DD HH:mm"),
    step2err_format: emoji.emojify( "Sorry, I don't understand... try to use one of these formats:\n" +
                                    "YYYY-MM-DD LT\n" +
                                    "YYYY-MM-DD h:mm A\n" +
                                    "YYYY-MM-DD HH:mm\n" +
                                    "YYYY-MM-DD HH:mm"),
    step2err_expired: emoji.emojify("Hey! The date is expired! Think about the future :clock2:"),
    step2: emoji.emojify("Very nice! Now you can /finish making your event or continue adding some details about it (they are not necessary)"),
    step2next: emoji.emojify("You may enter time before notification in format HH:mm"),
    step3: emoji.emojify("Very well :wink: \nNow you can /finish making your event"),
    step3next: emoji.emojify("You may enter the number of times the notification will appear and the interval between them. Here is an example: N every M days/weeks/months/years"),
    step3err: emoji.emojify("Oh no! The stated time is incorrect! :confused: Please, try again! "),
    step4: emoji.emojify("Niiice :grinning: \nNow you can /finish making your event"),
    finish: emoji.emojify(  "Well done! Your event has been saved :love_letter: \n" +
                            "I will let you know, when it is about to happen! :grin:"),
    finish_before: emoji.emojify(   "Your event was not saved... you can create another one! :grin: \n")
};
var userSchema = new Schema({
    userId: Number,
    events: [{
        event: String,
        time: Date,
        notify: Date
    }],
    state: Number,
    temp: []
});
var EventSchema = new Schema({
    userId: Number,
    event: String,
    time: Date,
    notify: Date
});
var temp = [
    //userId: Number,
    //event: String,
    //time: Date,
    //notify: Date,
    //state: Number
];
var EventTable = mongoose.model('EventTable',EventSchema);
var UserModel = mongoose.model('UserModel',userSchema);
var compareEvents = function (a, b) {
    return a.notify.valueOf() - b.notify.valueOf();
};
var priorityQueue;
function readEvents(pq) {
    //pq.clear();
    EventTable.find({}, function (err, event) {
        event.forEach(function (t) {
            pq.queue(t);
            console.log(t);
        })
    });
}
function userExists(userId,callback){
    UserModel.findOne({userId : userId}, function (err, foundUser) {
        //console.log("FOUND USER:",foundUser);
        if (err) {
            return callback(err, null);
        }
        return callback(null, foundUser);
    });
}
function saveUser(id,callback){
    userExists(id,function(err,result){
        if(err){
            return callback(err,null);
        }
        if(!result){
            temp.push({
                userId: id,
                event: "",
                time: null,
                notify: null,
                state: 0
            });
            var newUser = new UserModel({
                userId: id,
                events: [],
                state: 0,
                temp: temp
            });
            newUser.save(function(err){
                if(err){
                    return callback(err,null);
                }else{
                    return callback(null,true);
                }
            });
        }else{
            return callback(null,false);
        }
    });
}
api.onText(/\/start/,function (message,match) {
    var isChat = message.hasOwnProperty('chat');
    var userId = isChat ? message.chat.id : message.from.id;
    saveUser(userId,function (err,result){
        if(err){
            console.log(err);
            api.sendMessage(userId,message.error);
            return;
        }
        var who = "my friend!";
        if(isChat)
            who = (message.from.last_nam)?message.from.last_nam:''+" "+message.from.first_name;
        var greeting = "Hello, " + who + "!\n" + botMessage.greet;
        if(result){
            greeting = "Welcome, " + who + "!\n" + "Nice to meet you! " + botMessage.greet;
        }
        api.sendMessage(userId,greeting);
        setTimeout(function () {
            api.sendMessage(userId,botMessage.start);
        },200);
        //state 0
        var index = temp.findIndex(function(t){
            return (t.userId===userId);
        });
        temp[index] = {
            userId: userId,
            event: null,
            time: null,
            notify: null,
            repeats: null,
            number: null,
            interval: null,
            state: 0
        };
        setTemp(userId,temp[index]);
        setState(userId,0);
    });
});
api.onText(/\/remind/, function (message) {
    //console.log(message);
    var isChat = message.hasOwnProperty('chat');
    var userId = isChat ? message.chat.id : message.from.id;
    api.sendMessage(userId,botMessage.enterEvent);
    //state 1
    var index = temp.findIndex(function(t){
        return (t.userId===userId);
    });
    temp[index] = {
        userId: userId,
        event: null,
        time: null,
        notify: null,
        repeats: null,
        number: null,
        interval: null,
        state: 1
    };
    setTemp(userId,temp[index]);
    setState(userId,1);
});
api.onText(/\/show/,function (message) {
    var isChat = message.hasOwnProperty('chat');
    var userId = isChat ? message.chat.id : message.from.id;
    showAllEvents(userId);
});
api.onText(/\/finish/,function(message){
    //console.log(message);
    var isChat = message.hasOwnProperty('chat');
    var userId = isChat ? message.chat.id : message.from.id;
    userExists(userId,function (err,foundUser) {
        if(err){
            console.log(err);
            api.sendMessage(botMessage.error);
        }else{
            if(foundUser.state>2){
                addInfoToDB(foundUser,userId,function (err,result) {
                    if(err||!result){
                        //api.sendMessage(userId,err);
                    }else if(result){
                        api.sendMessage(userId,result);
                    }
                });
            }else{
                api.sendMessage(userId,botMessage.finish_before);
            }
            setState(userId,0);
            setTimeout(function () {
                api.sendMessage(userId,botMessage.start);
            },200);
        }
    });
});
function setState(userId,state){
    UserModel.update({userId: userId},{state: state},
        function(err, result){
            if(err){
                console.log(err);
                api.sendMessage(userId,botMessage.error);
            }else if(!result){
                console.log("Could not update state");
                api.sendMessage(userId,botMessage.error);
            }
        });
}
function setTemp(userId,temp){
    UserModel.update({userId: userId},{temp: temp},
        function(err, result){
            if(err){
                console.log(err);
                api.sendMessage(userId,botMessage.error);
            }else if(!result){
                console.log("Could not update temp");
                api.sendMessage(userId,botMessage.error);
            }
        });
}
function showAllEvents(userId){
    userExists(userId,function (err,result) {
        if(err){
            console.log(err);
        }else if(result){
            if(result.events&&result.events.length>0){
                for(var i = 0; i < result.events.length; i++){
                    api.sendMessage(userId,"You have *"+result.events[i].event+"* at "+result.events[i].time.toLocaleString(),{parse_mode: "markdown"});
                }
            }else{
                api.sendMessage(userId,"Sorry, there is nothing to show...");
            }
        }
    });
}
function addInfoToDB(foundUser,userId,callback){
    var events = foundUser.events;
    var index = temp.findIndex(function(t){
        return (t.userId===userId);
    });
    var n = 1;
    if(temp[index].repeats)
        n = temp[index].repeats;
    var not = moment(temp[index].notify);
    var tim = moment(temp[index].time);
    for(var i = 0; i <n; i++){
        var newEvent = {userId: userId,
            event:temp[index].event,
            time:tim,
            notify:not
        };
        events.push(newEvent);
        addEvent(newEvent,function (err,result) {
            if(err){
                console.log(err);
                //return callback(botMessage.error,null);
            }else if(!result){
                console.log(result);
                //return callback(botMessage.error,null);
            }
        });
        setTimeout(function () {
            priorityQueue.queue(newEvent);
            console.log("EVENT",newEvent);
            setTimeout(function (){
                init();
            } ,500);
        },1000);
        if(temp[index].repeats) {
            not.add(temp[index].number, temp[index].interval);
            tim.add(temp[index].number, temp[index].interval);
        }
    }
    UserModel.update({userId: userId},{events: events},
        function(err, result){
            if(err){
                console.log(err);
                //return callback(botMessage.error,null);
            }else if(!result){
                console.log(result);
                //return callback(botMessage.error,null);
            }
        });
    temp[index] = {
        userId: userId,
        event: null,
        time: null,
        notify: null,
        repeats: null,
        number: null,
        interval: null,
        state: 0
    };
    setTemp(userId,temp[index]);
    return callback(null,botMessage.finish);
}
api.on('message', function (message) {
    console.log(message);
    var userId = message.hasOwnProperty('chat') ? message.chat.id : message.from.id;
    userExists(userId,function (err,result) {
        if(err) {
            console.log(err);
            api.sendMessage(botMessage.error);
            return;
        }
        if(result && message.hasOwnProperty('text')&& message.text.charAt(0)!=='/'){
            //console.log("TEMP:",temp);
            var index = temp.findIndex(function(t){
                return (t.userId===userId);
            });
            if(message.hasOwnProperty('text')){
                //console.log(message);
                var text = message.text;
                var state = result.state;
                switch(state) {
                    case 0:
                        api.sendMessage(userId, botMessage.step0);
                        break;
                    case 1://event
                        state++;
                        setState(userId,state);
                        api.sendMessage(userId, botMessage.step1);
                        //console.log(temp);
                        temp[index].event=text;
                        temp[index].state=state;
                        break;
                    case 2://time
                        dateIsOkay(text,function (err,result) {
                            if(err){
                                api.sendMessage(userId, err);
                            }else{
                                state++;
                                setState(userId,state);
                                api.sendMessage(userId, botMessage.step2);
                                api.sendMessage(userId, botMessage.step2next);
                                index = temp.findIndex(function(t){
                                    return (t.userId===userId);
                                });
                                temp[index].time = result;
                                temp[index].notify = result;
                            }
                        });
                        break;
                    case 3://notify
                        index = temp.findIndex(function(t){
                            return (t.userId===userId);
                        });
                        timeIsOkay(text,temp[index].time,function(err,result){
                            if(err){
                                api.sendMessage(userId, err);
                            }else{
                                state++;
                                setState(userId, state);
                                api.sendMessage(userId, botMessage.step3);
                                api.sendMessage(userId, botMessage.step3next);
                                temp[index].notify=result;
                            }
                        });
                        break;
                    case 4:
                        index = temp.findIndex(function(t){
                            return (t.userId===userId);
                        });
                        intervalIsOkay(text,function(err,result){
                            if(err){
                                api.sendMessage(userId, err);
                            }else{
                                state++;
                                setState(userId, state);
                                api.sendMessage(userId,botMessage.step4);
                                console.log(result);
                                if(result.repeats>1){
                                    temp[index].repeats = result.repeats;
                                    temp[index].number = result.number;
                                    temp[index].interval = result.interval;
                                    console.log(temp[index]);
                                }
                            }
                        });

                }
                setTemp(userId,temp[index]);
            }
        }
    });
});
function intervalIsOkay(text,callback){
    var line = text.split(" ");
    if(line.length<3||line.length>4)
        callback("Please, state the interval clearly, I am a dumb bot xd",null);
    var N = parseInt(line[0]),M,interval;
    if(line.length===3){
        M = 1;
        interval = line[2];
    }else if(line.length===4){
        M = parseInt(line[2]);
        interval = line[3];
    }
    if(!N||!M||N<1||M<1)
        callback(emoji.emojify("Please, enter correct numbers, so I could make a schedule for you :sweat_smile:"),null);
    /*if(interval==="day"||interval==="days"||interval==="d"){
        return callback(null,{repeats:N,number:M,interval:"days"});
    }
    if(interval==="week"||interval==="weeks"||interval==="w"){
        return callback(null,{repeats:N,number:M,interval:"weeks"});
    }
    if(interval==="month"||interval==="months"||interval==="m"){
        return callback(null,{repeats:N,number:M,interval:"months"});
    }
    if(interval==="year"||interval==="years"||interval==="y"){
        return callback(null,{repeats:N,number:M,interval:"years"});
    }*/
    console.log(N,M,interval);
    if(/day|days|d/i.test(interval)){
        return callback(null,{repeats:N,number:M,interval:"days"});
    }
    if(/week|weeks|w/i.test(interval)){
        return callback(null,{repeats:N,number:M,interval:"weeks"});
    }
    if(/month|months|m/i.test(interval)){
        return callback(null,{repeats:N,number:M,interval:"months"});
    }
    if(/year|years|y/i.test(interval)){
        return callback(null,{repeats:N,number:M,interval:"years"});
    }
    return callback(emoji.emojify("Sorry, I don't understand... :sob: Please, enter the interval clearly (days/weeks/months/years)"),null);
}
function timeIsOkay(notify,date,callback){
    var formats = ["HH:mm","h:mm"];
    var now = moment();
    var m = moment(date);
    var n = moment(notify,formats,true);
    if(!n.isValid()) {
        return callback(botMessage.step2err_format, null);
    }
    //console.log("M",m);
    //console.log("N",n);
    var t = notify.split(':');
    var t1 = parseInt(t[0])*60;
    var t2 = parseInt(t[1]);
    if(t1<0||t2<0){
        return callback(botMessage.step2err_format, null);
    }
    m.subtract((t1+t2),'minutes');
    /*console.log(n);
    var d = new Date(n.format('YYYY-MM-DD HH:mm:ss'));
    console.log(d);
    if(!d)
        callback(botMessage.step2err_format, null);
    console.log("DATE+:",d.getHours()*60+d.getMinutes());
    m.subtract((d.getHours()*60+d.getMinutes()),'minutes');*/
    //console.log("IsAfter:", (moment(date) > m));
    console.log("Result:",m);
    if(moment(now).isAfter(m)){
        return callback(botMessage.step2err_expired, null);
    }
    else return callback(null,m);
}

function dateIsOkay(text, callback){
    var formats = ["YYYY-MM-DD LT","YYYY-MM-DD h:mm A","YYYY-MM-DD HH A","YYYY-MM-DD HH:mm","YY-MM-DD HH:mm"];
    var now = moment();
    var m = moment(text,formats,true);
    //console.log(m.format());
    if(!m.isValid()) {
        return callback(botMessage.step2err_format, null);
    }
    else if(moment(now).isAfter(m)){
        return callback(botMessage.step2err_expired, null);
    }
    else return callback(null,text);
}
function addEvent(t,callback){
    var newEvent = new EventTable({
        userId: t.userId,
        event: t.event,
        time: t.time,
        notify: t.notify
    });
    //console.log(newEvent);
    newEvent.save(function(err){
        if(err){
            //return callback(err,null);
        }else{
            //return callback(null,true);
        }
    });
}
var currentTimeout = null;
var currentEvent = null;

function resetCurEvent() {
    //console.log(currentEvent.notify.valueOf() - Date.now().valueOf() <= 0);
    if (currentEvent.notify.valueOf() - Date.now().valueOf() <= 0) {
        console.log("NOTIFY");
        notifyAboutEvent(currentEvent);
        EventTable.remove(currentEvent);
        EventTable.remove(currentEvent, function (err, removed) {
            if (err) {
                console.log(err);
            } else if (removed) {
                console.log(removed);
            }
        });
        removeFromUserDB(currentEvent);
    }
    setTimeout(function () {
        init();
    }, 500);
}

function notifyAboutEvent(event) {
    console.log("NOTIFY");
    api.sendMessage(event.userId, "Hello there! Just wanted to remind, that you have\n *" + event.event + "*\n on " + event.time.toLocaleString(), {parse_mode: "markdown"});
}

function removeFromUserDB(event) {
    UserModel.findOne({userId: event.userId}, function (err, result) {
        var oldEvents = result.events;
        for (var i = 0; i < oldEvents.length; i++) {
            if (oldEvents[i].time == event.time && oldEvents[i].notify == event.notify) {
                oldEvents.slice(i, 1);
                console.log(oldEvents);
                UserModel.update({userId: event.userId}, {events:oldEvents}, function(err, events){
                    if(err) console.log(err);
                })
            }
        }
    })
}

function init() {
    console.log(priorityQueue);
    if (priorityQueue.length !== 0) {
        currentEvent = priorityQueue.dequeue();
        console.log(currentEvent);
        console.log(currentEvent.notify.valueOf());
        console.log(Date.now().valueOf());
        console.log(currentEvent.notify.valueOf() - Date.now().valueOf());
        currentTimeout = setTimeout(resetCurEvent, currentEvent.notify.valueOf() - Date.now().valueOf());
    }
}