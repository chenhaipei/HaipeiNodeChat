require("sys");
let WebSocketServer = require('../node_modules/ws').Server;
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
                    console.log('current connecting counter: ' + wss.clients.length);
                    console.log(uid);
                    // Add newly connected users to the list of online users
                    onlineUserMap.put(uid, newUser);
                    console.log(onlineUserMap);
                    connCounter++;
                    // Broadcast information about new users to online users
                    wss.clients.forEach(function (client) {
                        client.send(JSON.stringify({
                            'user': onlineUserMap.get(uid),
                            'event': EVENT_TYPE.LOGIN,
                            'values': [newUser],
                            'counter': connCounter
                        }))
                    });
                    break;

                case EVENT_TYPE.SPEAK:
                    // The user speaks something
                    let content = chatLib.getMsgSecondDataValue(mData);
                    //Synchronize user message
                    for (let j = 0; j < wss.clients.length; j++) {
                        wss.clients[j].send(JSON.stringify({
                            'user': onlineUserMap.get(chatLib.getMsgFirstDataValue(mData)),
                            'event': EVENT_TYPE.SPEAK,
                            'values': [content]
                        }));
                    }
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
        for (let k in onlineUserMap.keySet()) {
            console.log('k is :' + k);
            if(!wss.clients.hasOwnProperty(k)) continue;
            if (!wss.clients[k]) {
                var logoutUser = onlineUserMap.remove(k);
                if (logoutUser) {
                    // Broadcast information about the exited user to the online user
                    wss.clients.forEach(function(client){
                     client.send(JSON.stringify({
                            'uid': k,
                            'event': EVENT_TYPE.LOGOUT,
                            'values': [logoutUser]
                        }));
                    });
                }
            }
        }
        console.log('User:{\'uid\':' + logoutUser.uid + ',\'nickname\':' + logoutUser.nick + '} has leaved');
        console.log('current connecting counter: ' + wss.clients.length);

    });
});
console.log('Start listening on port ' + PORT);
