"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var clientSocketInterface_1 = require("./clientSocketInterface");
var prompt = require("prompt-sync")();
var TicTacToeClient = /** @class */ (function () {
    function TicTacToeClient(type) {
        var _this = this;
        this.handler = JSON.parse(JSON.stringify(clientSocketInterface_1.testHandler));
        this.handler.onSetup = function () { return console.log("Client ".concat(_this.type, " setup.")); };
        this.handler.onSignalMessage = function (flags, payload) { return _this.handleMessage(flags, payload); };
        this.connection = new clientSocketInterface_1.ClientSocketInterface(this.handler, "passthrough", true);
        this.type = type;
    }
    TicTacToeClient.prototype.getMove = function () {
        console.log("Client ".concat(this.type, ": "));
        var xCoord = parseInt(prompt("X Coordinate: "));
        var yCoord = parseInt(prompt("Y Coordinate: "));
        this.connection.sendSignaling(JSON.stringify({
            x: xCoord, y: yCoord,
        }), ["".concat(this.type, "_MOVE")]);
    };
    TicTacToeClient.prototype.handleMessage = function (flags, payload) {
        switch (flags[0]) {
            case "MOVE":
                this.getMove();
                break;
            case "WIN":
                console.log("Client ".concat(this.type, " won!"));
                break;
            case "LOSE":
                console.log("Client ".concat(this.type, " lost!"));
                break;
            case "DRAW":
                console.log("Client ".concat(this.type, " drew!"));
                break;
            default:
                console.log("Invalid flag: " + flags[0]);
        }
    };
    TicTacToeClient.prototype.start = function () {
        return this.connection.start();
    };
    return TicTacToeClient;
}());
var client1 = new TicTacToeClient("X");
var setupPromise1 = client1.start();
setupPromise1.then(function () {
    client1.connection.createServer("tic-tac-toe");
    var client2 = new TicTacToeClient("O");
    var setupPromise2 = client2.start();
    setupPromise2.then(function () {
        client2.connection.connectToServer(function () { return true; });
    });
});
//testHandler.onSetup = () => console.log(`Test client setup.`);
//const client = new ClientSocketInterface(testHandler, "passthrough", true);
//client.setupConnection();
