let videos = [];
let rooms = [1, 2, 3, 4, 5];
let PeerConnection = window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection;

function getNumPerRow() {
    let len = videos.length;
    let biggest;

    // Ensure length is even for better division.
    if (len % 2 === 1) {
        len++;
    }

    biggest = Math.ceil(Math.sqrt(len));
    while (len % biggest !== 0) {
        biggest++;
    }
    return biggest;
}

function subdivideVideos() {
    let perRow = getNumPerRow();
    let numInRow = 0;
    for (let i = 0, len = videos.length; i < len; i++) {
        let video = videos[i];
        setWH(video, i);
        numInRow = (numInRow + 1) % perRow;
    }
}

function setWH(video, i) {
    let perRow = getNumPerRow();
    let perColumn = Math.ceil(videos.length / perRow);
    let width = Math.floor((window.innerWidth) / perRow);
    let height = Math.floor((window.innerHeight - 190) / perColumn);
    video.width = width;
    video.height = height;
    video.style.position = "absolute";
    video.style.left = (i % perRow) * width + "px";
    video.style.top = Math.floor(i / perRow) * height + "px";
}

function cloneVideo(domId, socketId) {
    let video = document.getElementById(domId);
    let clone = video.cloneNode(false);
    clone.id = "remote" + socketId;
    document.getElementById('videos').appendChild(clone);
    videos.push(clone);
    return clone;
}

function removeVideo(socketId) {
    let video = document.getElementById('remote' + socketId);
    if (video) {
        videos.splice(videos.indexOf(video), 1);
        video.parentNode.removeChild(video);
    }
}

function addToChat(msg, color) {
    let messages = document.getElementById('messages');
    msg = sanitize(msg);
    if (color) {
        msg = '<span style="color: ' + color + '; padding-left: 15px">' + msg + '</span>';
    } else {
        msg = '<strong style="padding-left: 15px">' + msg + '</strong>';
    }
    messages.innerHTML = messages.innerHTML + msg + '<br>';
    messages.scrollTop = 10000;
}

function sanitize(msg) {
    return msg.replace(/</g, '&lt;');
}

function initFullScreen() {
    let button = document.getElementById("fullscreen");
    button.addEventListener('click', function (event) {
        let elem = document.getElementById("videos");
        //show full screen
        elem.webkitRequestFullScreen();
    });
}

//generate roomid

function initNewRoom() {
    let button = document.getElementById("newRoom");

    button.addEventListener('click', function (event) {

        let chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
        let string_length = 8;
        let randomstring = '';
        for (let i = 0; i < string_length; i++) {
            let rnum = Math.floor(Math.random() * chars.length);
            randomstring += chars.substring(rnum, rnum + 1);
        }

        window.location.hash = randomstring;
        location.reload();
    })
}

function initChat() {
    let input = document.getElementById("chatinput");
    let room = window.location.hash.slice(1);
    let color = "#" + ((1 << 24) * Math.random() | 0).toString(16);

    input.addEventListener('keydown', function (event) {
        let key = event.which || event.keyCode;
        if (key === 13) {
            rtc._socket.send(JSON.stringify({
                "eventName": "chat_msg",
                "data": {
                    "messages": input.value,
                    "room": room,
                    "color": color
                }
            }), function (error) {
                if (error) {
                    console.log(error);
                }
            });
            addToChat(input.value);
            input.value = "";
        }
    }, false);
    rtc.on('receive_chat_msg', function (data) {
        console.log(data.color);
        addToChat(data.messages, data.color.toString(16));
    });
}


function init() {
    if (PeerConnection) {
        rtc.createStream({
            "video": true,
            "audio": true
        }, function (stream) {
            document.getElementById('you').src = URL.createObjectURL(stream);
            videos.push(document.getElementById('you'));
            rtc.attachStream(stream, 'you');
            subdivideVideos();
        });
    } else {
        alert('Your browser is not supported or you have to turn on flags. In chrome you go to chrome://flags and turn on Enable PeerConnection remember to restart chrome');
    }


    let room = window.location.hash.slice(1);

    //When using localhost
    rtc.connect("ws://localhost:8000/", room);

    rtc.on('add remote stream', function (stream, socketId) {
        console.log("ADDING REMOTE STREAM...");
        let clone = cloneVideo('you', socketId);
        document.getElementById(clone.id).setAttribute("class", "");
        rtc.attachStream(stream, clone.id);
        subdivideVideos();
    });
    rtc.on('disconnect stream', function (data) {
        console.log('remove ' + data);
        removeVideo(data);
    });
    initFullScreen();
    initNewRoom();
    initChat();
}

window.onresize = function (event) {
    subdivideVideos();
};
