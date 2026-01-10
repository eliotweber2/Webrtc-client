import { ClientSocketInterface, testHandler } from "./clientSocketInterface";
const prompt = require("prompt-sync")();

class TicTacToeClient {

    private handler: WebrtcClientHandler;
    public connection: ClientSocketInterface;
    private type: string;

    constructor(type: string) {
        this.handler = JSON.parse(JSON.stringify(testHandler));
        this.handler.onSetup = () => console.log(`Client ${this.type} setup.`);
        this.handler.onSignalMessage = (flags, payload) => this.handleMessage(flags,payload);
        this.connection = new ClientSocketInterface(this.handler, "passthrough", true);
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

    handleMessage(flags: string[], payload: any) {
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




//testHandler.onSetup = () => console.log(`Test client setup.`);
//const client = new ClientSocketInterface(testHandler, "passthrough", true);
//client.setupConnection();