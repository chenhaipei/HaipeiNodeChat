//require("sys");
let WebSocket = require('ws')
let WebSocketServer = WebSocket.Server;
let chatLib = require("./chatLib");
let EVENT_TYPE = chatLib.EVENT_TYPE;
let PORT = chatLib.PORT;
let wss = new WebSocketServer({
    port: PORT
});

let zTool = require("./zTool");
let onlineUserMap = new zTool.SimpleMap();
let historyContent = new zTool.CircleList(100);
let connCounter = 1;
let uid = null;
let mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/chatroom');
let db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    // we're connected!
    console.log("db connection is OK");

});

let loginSchema = mongoose.Schema({
    uid: Number,
    nickName: String,
    loginDate: Date,
    logoutDate: Date
})


let loginUserModel = mongoose.model("loginUser", loginSchema);

wss.on('connection', function (conn) {
    conn.on('message', function (message) {
        let mData = chatLib.analyzeMessageData(message);

        if (mData && mData.EVENT) {
            switch (mData.EVENT) {
                case EVENT_TYPE.LOGIN:
                    // New user connection
                    uid = connCounter;
                    let newUser = {
                        'uid': connCounter,
                        'nick': chatLib.getMsgFirstDataValue(mData)
                    };
                    console.log('User:{\'uid\':' + newUser.uid + ',\'nickname\':' + newUser.nick + '}coming on protocol websocket draft ' + conn.protocolVersion);
                    console.log('current connecting counter: ' + wss.clients.size);
                    console.log(uid);
                    conn.uid = connCounter;
                    console.log('name:' + conn.uid);
                    // Add newly connected users to the list of online users
                    onlineUserMap.put(uid, newUser);

                    //save in db
                    let user = new loginUserModel({
                        uid: newUser.uid,
                        nickName: newUser.nick,
                        loginDate: Date.now(),
                        logoutDate: null
                    })
                    user.save(function (err, loginUser) {
                        if (err) return console.log(err);
                        console.log("data save ok")
                    })
                    conn.oId = user._id; //save MongoDb _id to client
                    //
                    console.log(onlineUserMap);
                    // Broadcast information about new users to online users
                    wss.clients.forEach(function (client) {
                        client.send(JSON.stringify({
                            'user': onlineUserMap.get(uid),
                            'event': EVENT_TYPE.LOGIN,
                            'values': [newUser],
                            'counter': connCounter
                        }))
                    });
                    connCounter++;
                    break;

                case EVENT_TYPE.SPEAK:
                    // The user speaks something
                    let content = chatLib.getMsgSecondDataValue(mData);
                    //Synchronize user message
                    wss.clients.forEach(function (client) {
                        client.send(JSON.stringify({
                            'user': onlineUserMap.get(chatLib.getMsgFirstDataValue(mData)),
                            'event': EVENT_TYPE.SPEAK,
                            'values': [content]
                        }))
                    });
                    historyContent.add({
                        'user': onlineUserMap.get(uid),
                        'content': content,
                        'time': new Date().getTime()
                    });
                    break;

                case EVENT_TYPE.LIST_USER:
                    // Get the current online user
                    conn.send(JSON.stringify({
                        'user': onlineUserMap.get(uid),
                        'event': EVENT_TYPE.LIST_USER,
                        'values': onlineUserMap.values()
                    }));
                    break;

                case EVENT_TYPE.LIST_HISTORY:
                    // Get the most recent chat history message
                    conn.send(JSON.stringify({
                        'user': onlineUserMap.get(uid),
                        'event': EVENT_TYPE.LIST_HISTORY,
                        'values': historyContent.values()
                    }));
                    break;

                default:
                    break;
            }

        } else {
            // There was an error with the event type.
            // Load and log,
            // Send an error message to the current user
            console.log('desc:message,userId:' + chatLib.getMsgFirstDataValue(mData) + ',message:' + message);
            conn.send(JSON.stringify({
                'uid': chatLib.getMsgFirstDataValue(mData),
                'event': EVENT_TYPE.ERROR
            }));
        }
    });
    conn.on('error', function () {
        console.log(Array.prototype.join.call(arguments, ", "));
    });
    conn.on('close', function () {
        // Remove from the list of online users
        //console.log(onlineUserMap);
        //console.log(conn.uid);
        let logoutUser = onlineUserMap.remove(conn.uid);
        //save in db
        //let user = new logoutUserModel({uid: logoutUser.uid, nickName: logoutUser.nick, logoutDate: Date.now()})
        loginUserModel.findById(conn.oId, function (err, loginuser) {
            //console.log(loginuser);
            if (err) {
                console.log(err)
            } else {
                if (loginuser) {
                    loginUserModel.updateOne(loginuser, {logoutDate: Date.now()}, function (err, model) {
                        if (err) console.log(err);
                    })
                }
            }
        });
        // user.save(function (err, loginUser) {
        //     if (err) return console.log(err);
        //     console.log("data save ok")
        // })
        //
        console.log(onlineUserMap);
        console.log(logoutUser);
        wss.clients.forEach(function (client) {

            if (client !== conn && client.readyState === WebSocket.OPEN) {
                console.log('logoutUid:' + conn.uid);
                client.send(JSON.stringify({
                    'uid': conn.uid,
                    'event': EVENT_TYPE.LOGOUT,
                    'values': [logoutUser]
                }));
            }

        })
        // for (let k in onlineUserMap.keySet()) {
        //     console.log('k is :' + k);
        //     //console.log(!wss.clients.hasOwnProperty(k));
        //     //if (!wss.clients.hasOwnProperty(k)) continue;
        //     console.log(conn.name);
        //     if(wss.clients)
        //     //if (!wss.clients[k]) {
        //     console.log('remove');
        //     let logoutUser = onlineUserMap.remove(k);
        //     if (logoutUser) {
        //         //save in db
        //         let user = new logoutUserModel({uid: logoutUser.uid, nickName: logoutUser.nick, loginDate: Date.now()})
        //         user.save(function (err, loginUser) {
        //             if (err) return console.log(err);
        //             console.log("data save ok")
        //         })
        //         //
        //         // Broadcast information about the exited user to the online user
        //         wss.clients.forEach(function (client) {
        //             client.send(JSON.stringify({
        //                 'uid': k,
        //                 'event': EVENT_TYPE.LOGOUT,
        //                 'values': [logoutUser]
        //             }));
        //         });
        //     }
        //     //}
        // }
        console.log('User:{\'uid\':' + logoutUser.uid + ',\'nickname\':' + logoutUser.nick + '} has left.');
        console.log('current connecting counter: ' + wss.clients.size);
    });
});
console.log('Start listening on port ' + PORT);
