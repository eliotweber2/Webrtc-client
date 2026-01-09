"use strict";

import { RTCPeerConnection, RTCIceCandidate, RTCDataChannel, RTCPeerConnectionIceEvent, RTCSessionDescription } from "@roamhq/wrtc";
//const serverUrl = 'http://localhost:8080';
const serverUrl = 'https://eliotweber.net';
//const serverUrl = 'https://haunted-spirit-7v7xg6rpjjr9hr5xq-8080.app.github.dev';
const prefix = '/webrtc';

const servers: IceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ]
};

const testHandler: WebrtcClientHandler = {
        onSetup: () => console.log('Setup complete'),
        onClose: () => console.log('Connection closed'),
        onSignalMessage: (flags: string[], data) => console.log('Signal message received:', flags, data),
        onReconnect: () => console.log("Reconnected")
}

class ClientSocketInterface {

    private connectedToSignalingServer: boolean;
    private readonly iceCandidates: RTCIceCandidate[];
    private shouldReconnect: boolean;
    private readonly handlerType: string;
    private isClosing: boolean;
    private connectionId: number;
    
    readonly handler: WebrtcClientHandler;

    private readonly waitFor: Map<string, signalFunction>;
    private readonly timeouts: Map<string, number>;

    private peerConnection: RTCPeerConnection;
    private signaling: RTCDataChannel;
    private data: RTCDataChannel;
    
    constructor(handler: WebrtcClientHandler, handlerType: string, shouldReconnect: boolean = false) {

        this.connectedToSignalingServer = false;
        this.iceCandidates = [];

        this.handlerType = handlerType;

        this.shouldReconnect = shouldReconnect;
        this.isClosing = false;

        this.handler = handler;

        this.waitFor = new Map();
        this.timeouts = new Map();

        this.peerConnection = new RTCPeerConnection(servers);
    }

    setupIceCandidates() {
        this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (!event.candidate) return;
            if (!this.connectedToSignalingServer) {this.iceCandidates.push(event.candidate); return; }
            //console.log(event.candidate)
            fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/ice-candidates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                }),
                
            });
        };
    }

    onSignalMessage(messageData: string) {
        const messageJson = JSON.parse(messageData);
        let flags = messageJson.flags.split(' | ');
        const data = messageJson.data;

        flags = flags.map((flag: string) => flag.trimEnd());

        const passedFlags = flags.slice(1).length > 0? flags.slice(1) : [];

        if (this.waitFor.hasOwnProperty(flags[0])) {
            //Will always be a function
            this.waitFor.get(flags[0])!(flags, data);
        }

        switch (flags[0]) {
            case 'MESSAGE':
                this.handler.onSignalMessage(passedFlags, data);
                break;

            case 'RECONNECT':
                this.handler.onReconnect?.();
                this.handler.onSetup();
                break;

            case 'SHOULD_RECONNECT':
                this.shouldReconnect = true;
                break;

            case 'NO_RECONNECT':
                this.shouldReconnect = false;
                break;

            case 'OPEN':
                // console.log('Received OPEN signal');

                if (this.timeouts.get("openBackup")) {
                    clearTimeout(this.timeouts.get("openBackup"));
                }
                break;
            
            case "SERVER_LIST":
                break;

            case "HEARTBEAT":
                this.sendSignaling('', ["HEARTBEAT"], true);
                break;

            case 'CLOSE':
                this.handler.onClose?.();
                this.closeConnection();
                this.isClosing = true;
                break;

            default:
                console.error('Unknown signal message type:', flags[0]);
        }
    }

    onClose() {
        console.log('Peer connection closed');
        this.handler.onClose?.();
        if (!this.isClosing) {
            console.error('Connection closed unexpectedly');
            if (this.shouldReconnect) {
                console.log('Attempting to reconnect...');
                this.peerConnection = new RTCPeerConnection(servers);
                this.setupIceCandidates();
                this.start();
            }
        } else {
            console.log('Connection closed');
        }
    }

    closeConnection() {
        this.isClosing = true;
        console.log(`Closing connection ${this.connectionId}`);
        this.sendSignaling('', ['CLOSE'], true);
        this.waitForMessage("CLOSE", true, 2000, "Client did not confirm close. Closing anyway.");
    }

    sendSignaling(message:string, flags:string[], toConnManager=false) {
        if (!toConnManager) {
            if (flags === undefined) {
                console.log(message,flags);
            }
            flags.unshift('MESSAGE');
        }
        const fullMessage = JSON.stringify({
            flags: flags.join(' | '),
            data: message
        })
        if (this.signaling) this.signaling.send(fullMessage);
        else console.log(`Signaling channel not open to send message: ${fullMessage}`);
    }

    async connectToServer(serverSelector: serverSelectorFunction) {
        let resultOk = true;
        let resultErrorText = '';
        await new Promise((resolve,reject) => {
            const waitPromise = this.waitForMessage("SERVER_LIST", true, 8000, "");

            waitPromise.then((value) => {
                const data = (value as SignalingInfo).data;
                const servers: ServerInfo[] = JSON.parse(data);
                const validServers = servers.filter(serverSelector);

                if (validServers.length < 1) reject("Invalid selector, passed no servers.");
                if (validServers.length > 1) reject("Invalid selector, passed more than one server.");

                resolve(validServers[0]);
            }).catch(() => reject("Server list never received."));

            this.sendSignaling('', ['GET_SERVERS'], true);

        }).then((value) => {
            this.joinServer((value as ServerInfo).server_id);
        }).catch((reason) => {
            resultErrorText = reason;
            resultOk = false;
        }).finally(() => {
            if (!resultOk) console.log(resultErrorText);
            return resultOk;
        });
    }

    async waitForMessage(flag: string, isTimeout=false, timeoutLength=-1, errMsg="") {
        return new Promise((resolve, reject) => {
            this.waitFor.set(flag, (flags, data) => {
                resolve({flags,data});
            });
            if (isTimeout) this.timeouts.set(flag, setTimeout(() => {
                if (errMsg !== null) console.log(errMsg);
                reject();
            }, timeoutLength) as unknown as number);
        }).finally(() => {
            this.waitFor.delete(flag);
            if (this.timeouts.has(flag)) clearTimeout(this.timeouts.get(flag)!);
        });
    }

    createServer(type: string) {
        this.sendSignaling(JSON.stringify({
            method: "CREATE",
            type: type
        }),["SERVER_CONNECT"], true);
    }

    joinServer(id: string) {
        this.sendSignaling(JSON.stringify({
            method: "JOIN",
            serverId: id
        }),["SERVER_CONNECT"], true);
    }

    async getServers() {
        const servers = this.waitForMessage("SERVER_LIST");
        this.sendSignaling("", ["GET_SERVERS"], true);
        return servers;
    }

    async start() {
        return new Promise<void>(async (resolve,reject) => {

            try {
                console.log('Pinging signaling server...');
                
                let response;
                if (!this.connectionId) {
                    response = await fetch(`${serverUrl}${prefix}/new-connection`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({'handlerType': this.handlerType})
                        }
                    );
                } else {
                    response = await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/reconnect`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                }

                if (response.status !== 200) {
                    console.error("Bad response code: " + response.status);
                    return;
                }
                this.connectedToSignalingServer = true;
                const { offerType, offerSdp, id } = await response.json();
                const offer = new RTCSessionDescription({type: offerType.toLowerCase(), sdp: offerSdp});
                this.connectionId = id;

                await this.peerConnection.setRemoteDescription(offer);

                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                const offerResp = await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/offer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({offerType: answer.type.toUpperCase(), offerSdp: answer.sdp}),
                });

                console.log("Exchanging ICE candidates...")

                if (this.iceCandidates.length > 0) {
                    for (const candidate of this.iceCandidates) {
                        await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/ice-candidates`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(candidate),
                        });
                    }
                }
                this.iceCandidates.length = 0;

                const iceResp = await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/ice-candidates`);
                const { candidates } = await iceResp.json();
                //console.log(candidates.length);
                if (candidates && candidates.length > 0) {
                    for (const candidate of candidates) {
                        const parsedCandidate = new RTCIceCandidate(candidate);
                        await this.peerConnection.addIceCandidate(parsedCandidate);
                    }
                }

                console.log("Setting up data channels...")

                await new Promise<void> ((resolve, reject) => {
                    let received = 0;
                    this.timeouts.set('dataChannelSetup', setTimeout(() => {
                        reject(new Error('Data channel setup timeout'));
                    }, 10000) as unknown as number);
                    this.peerConnection.ondatachannel = (event) => {
                        console.log('Data channel received:', event.channel.label);
                        if (event.channel.label === 'signaling') {
                            this.signaling = event.channel;
                        } else if (event.channel.label === 'data') {
                            this.data = event.channel;
                        }

                        received++;
                        if (received === 2) resolve();
                    };
                });

                if (this.timeouts.has('dataChannelSetup')) {
                    clearTimeout(this.timeouts.get('dataChannelSetup')!);
                }

                this.signaling.onmessage = (event) => {
                    this.onSignalMessage(event.data);
                }

                this.signaling.onclose = () => {
                    console.log('Signaling channel closed');
                    this.onClose();
                }

                this.data.onmessage = (event) => {
                    this.handler.onDataMessage?.(event.data);
                }

                console.log('Testing data channel communication...');

                await new Promise<void>((resolve, reject) => {
                    this.waitForMessage("OPEN", true, 5000, "Data channel OPEN message not received in time.").then(() => {
                        resolve();
                    }).catch(() => {
                        reject(new Error('Data channel OPEN message timeout'));
                    });
                    
                    this.sendSignaling('', ['OPEN'], true);
                });

                console.log('Connection setup complete');
                this.handler.onSetup();

            } catch (error) {
                    console.error('Error during connection setup:', error);
                    reject();
            }
            resolve();
        }).catch((err) => {
            console.error('Connection setup failed:', err);
        });
    }
}

const client = new ClientSocketInterface(testHandler, "passthrough");
client.start();

export { ClientSocketInterface };