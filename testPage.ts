import { ClientSocketInterface, testHandler } from "./clientSocketInterface";
const prompt = require("prompt-sync")();

const mode = "X";

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

async function startClient(mode: string) {
    const client = new TicTacToeClient(mode);
    await client.start().then(() => {
        if (mode === "X") {
            client.connection.createServer("tic-tac-toe");
        } else {
            client.connection.connectToServer(() => true);
        }
    });
}

async function setupClients() {
    await startClient("X");
    await startClient("O");
}

//setupClients();

startClient(mode);