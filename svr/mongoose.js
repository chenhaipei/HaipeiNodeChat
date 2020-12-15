let http = require("http");
let url = require("url");
let fs = require("fs");
let mongoose = require("mongoose");

// Database connection.
let dbUrl = "mongodb://localhost:27017/chpdb";
mongoose.connect(dbUrl, {useUnifiedTopology: true, useNewUrlParser: true});

// Database schema.
let historySchema = new mongoose.Schema({user: String, content: String, time: Date});
let History = mongoose.model("history", historySchema);

async function listAllHistory() {
    return await History.find({});
}

async function allHistoryRoute(response) {
    let history = await listAllHistory();
    response.write(JSON.stringify(history));
    response.end();
}

function templateRoute(response) {
    fs.readFile("chatroom.html", function (err, contents) {
        response.writeHeader(200, {"Content-Type": "text/html"});
        response.write(contents);
        response.end();
    });
}

let server = http.createServer(function (request, response) {
    let reqUrl = url.parse(request.url, true);

    if (reqUrl.path === "/") {
        templateRoute(response);
    } else if (reqUrl.path === "/history") {
        allHistoryRoute(response);
    }
});

server.listen(9000, function () {
    console.log("Listening on 9000");
});
