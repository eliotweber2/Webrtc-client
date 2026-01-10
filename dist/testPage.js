"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const clientSocketInterface_1 = require("./clientSocketInterface");
const prompt = require("prompt-sync")();
const mode = "X";
class TicTacToeClient {
    constructor(type) {
        this.handler = JSON.parse(JSON.stringify(clientSocketInterface_1.testHandler));
        this.handler.onSetup = () => console.log(`Client ${this.type} setup.`);
        this.handler.onSignalMessage = (flags, payload) => this.handleMessage(flags, payload);
        this.connection = new clientSocketInterface_1.ClientSocketInterface(this.handler, "passthrough", true);
        this.type = type;
    }
    getMove() {
        console.log(`Client ${this.type}: `);
        const xCoord = parseInt(prompt("X Coordinate: "));
        const yCoord = parseInt(prompt("Y Coordinate: "));
        this.connection.sendSignaling(JSON.stringify({
            x: xCoord, y: yCoord,
        }), [`${this.type}_MOVE`]);
    }
    handleMessage(flags, payload) {
        switch (flags[0]) {
            case "MOVE":
                this.getMove();
                break;
            case "WIN":
                console.log(`Client ${this.type} won!`);
                break;
            case "LOSE":
                console.log(`Client ${this.type} lost!`);
                break;
            case "DRAW":
                console.log(`Client ${this.type} drew!`);
                break;
            default:
                console.log("Invalid flag: " + flags[0]);
        }
    }
    start() {
        return this.connection.start();
    }
}
async function startClient(mode) {
    const client = new TicTacToeClient(mode);
    await client.start().then(() => {
        if (mode === "X") {
            client.connection.createServer("tic-tac-toe");
        }
        else {
            client.connection.connectToServer(() => true);
        }
    });
}
async function setupClients() {
    await startClient("X");
    await startClient("O");
}
/*
const client1 = new TicTacToeClient("X");
const setupPromise1 = client1.start();
setupPromise1.then(() => {
    client1.connection.createServer("tic-tac-toe");
    const client2 = new TicTacToeClient("O");
    const setupPromise2 = client2.start();
    setupPromise2.then(() => {
    client2.connection.connectToServer(() => true);
    });
});
*/
setupClients();
//testHandler.onSetup = () => console.log(`Test client setup.`);
//const client = new ClientSocketInterface(testHandler, "passthrough", true);
//client.setupConnection();
//# sourceMappingURL=testPage.js.map