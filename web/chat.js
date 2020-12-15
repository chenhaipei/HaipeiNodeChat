let HOST = chatLib.HOST;
let EVENT_TYPE = chatLib.EVENT_TYPE;
let PORT = chatLib.PORT;

$(document).ready(function () {
    let socket = null;
    let onlineUserMap = new zTool.SimpleMap();
    let currentUser = null;
    let currentUserNick = null;
    let uid = 1;
    let connCounter = 1;
    let flag = 0;

    if (typeof WebSocket === 'undefined') {
        $("#prePage").hide();
        $("#errorPage").show();
    }

    function updateOnlineUser() {
        let html = ["<div>在线用户(" + onlineUserMap.size() + ")</div>"];
        if (onlineUserMap.size() > 0) {
            let users = onlineUserMap.values();
            for (let i in users) {
                html.push("<div>");
                if(!users.hasOwnProperty(i)) continue;
                if (users[i].uid === currentUser.uid) {
                    html.push("<b>" + formatUserString(users[i]) + "(我)</b>");
                } else {
                    html.push(formatUserString(users[i]));
                }
                html.push("</div>");
            }
        }

        $("#onlineUsers").html(html.join(''));
    }

    function appendMessage(msg) {
        $("#talkFrame").append("<div>" + msg + "</div>");
    }

    function formatUserString(user) {
        if (!user) {
            return '';
        }
        return user.nick + "<span class='gray'>(" + user.uid + ")</span> ";
    }

    function formatUserTalkString(user) {
        return formatUserString(user) + new Date().format("hh:mm:ss") + " ";
    }

    function formatUserTalkHisString(user, time) {
        return formatUserString(user) + new Date(time).format("yyyy-MM-dd hh:mm:ss") + " ";
    }

    function reset() {
        if (socket) {
            socket.close();
        }
        socket = null;
        onlineUserMap = null;
        $("#onlineUsers").html("");
        $("#talkFrame").html("");
        $("#nickInput").val("");
    }

    function close() {

    }

    $("#open").click(function () {
        currentUserNick = $.trim($("#nickInput").val());
        if ('' === currentUserNick) {
            alert('请先输入昵称');
            return;
        }
        $("#prePage").hide();
        $("#mainPage").show();
        reset();

        socket = new WebSocket("ws://" + HOST + ":" + PORT);
        onlineUserMap = new zTool.SimpleMap();
        socket.onmessage = function (event) {
            let i;
            let mData = chatLib.analyzeMessageData(event.data);

            if (mData && mData.event) {
                switch (mData.event) {
                    case EVENT_TYPE.LOGIN:
                        // 新用户连接
                        let newUser = mData.values[0];
                        if (flag === 0) {
                            currentUser = newUser;
                            flag = 1;
                        }
                        connCounter = mData.counter;
                        uid = connCounter;
                        onlineUserMap.put(uid, newUser);
                        updateOnlineUser();
                        appendMessage(formatUserTalkString(newUser) + "[进入房间]");
                        break;

                    case EVENT_TYPE.LOGOUT:
                        // 用户退出
                        let user = mData.values[0];
                        alert(user.uid);
                        onlineUserMap.remove(user.uid);
                        updateOnlineUser();
                        appendMessage(formatUserTalkString(user) + "[离开房间]");
                        break;

                    case EVENT_TYPE.SPEAK:
                        // 用户发言
                        let content = mData.values[0];
                        if (mData.user.uid !== currentUser.uid) {
                            appendMessage(formatUserTalkString(mData.user));
                            appendMessage("<span>&nbsp;&nbsp;</span>" + content);
                        }
                        break;

                    case EVENT_TYPE.LIST_USER:
                        // 获取当前在线用户
                        let users = mData.values;
                        if (users && users.length) {
                            for (i in users) {
                                // alert(i + ' user : ' + users[i].uid);
                                // alert('uid: ' + currentUser.uid);
                                if(!users.hasOwnProperty(i)) continue;
                                if (users[i].uid !== currentUser.uid) onlineUserMap.put(users[i].uid, users[i]);
                            }
                        }
                        //alert('currentUser:' + currentUser);
                        updateOnlineUser();
                        break;

                    case EVENT_TYPE.LIST_HISTORY:
                        // 获取历史消息
                        //{'user':data.user,'content':content,'time':new Date().getTime()}
                        let data = mData.values;
                        if (data && data.length) {
                            for (i in data) {
                                if(!data.hasOwnProperty(i)) continue;
                                appendMessage(formatUserTalkHisString(data[i].user, data[i].time));
                                appendMessage("<span>&nbsp;&nbsp;</span>" + data[i].content);
                            }
                            appendMessage("<span class='gray'>==================以上为最近的历史消息==================</span>");
                        }
                        break;

                    case EVENT_TYPE.ERROR:
                        // 出错了
                        appendMessage("[系统繁忙...]");
                        break;

                    default:
                        break;
                }

            }
        };

        socket.onerror = function () {
            appendMessage("[网络出错啦，请稍后重试...]");
        };

        socket.onclose = function () {
            appendMessage("[网络连接已被关闭...]");
            close();
        };

        socket.onopen = function () {
            socket.send(JSON.stringify({
                'EVENT': EVENT_TYPE.LOGIN,
                'values': [currentUserNick]
            }));
            socket.send(JSON.stringify({
                'EVENT': EVENT_TYPE.LIST_USER,
                'values': [currentUserNick]
            }));
            socket.send(JSON.stringify({
                'EVENT': EVENT_TYPE.LIST_HISTORY,
                'values': [currentUserNick]
            }));
        };
    });

    $("#message").keyup(function (event) {
        if (13 === event.keyCode) {
            sendMsg();
        }
    });

    function sendMsg() {
        let value = $.trim($("#message").val());
        if (value) {
            $("#message").val('');
            appendMessage(formatUserTalkString(currentUser));
            appendMessage("<span>&nbsp;&nbsp;</span>" + value);
            socket.send(JSON.stringify({
                'EVENT': EVENT_TYPE.SPEAK,
                'values': [currentUser.uid, value]
            }));
        }
    }

    $("#send").click(function () {
        sendMsg();
    });

    $("#createroom").click(function (event) {
    })

    function show(value) {
        $("#response").html(value);
    }
});
