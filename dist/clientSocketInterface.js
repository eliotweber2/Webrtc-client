"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testHandler = exports.ClientSocketInterface = void 0;
const wrtc_1 = require("@roamhq/wrtc");
const ts_logger_1 = require("@origranot/ts-logger");
//const serverUrl = "http://localhost:8080";
//const serverUrl = "https://eliotweber.net";
const serverUrl = "https://didactic-bassoon-v6p5x9gqj59pfp6rr-8080.app.github.dev";
const prefix = "/webrtc";
const servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
    ]
};
const DEFAULT_LOG_LEVEL = ts_logger_1.LOG_LEVEL.INFO;
const loggerOptions = {
    name: "ClientSocketInterfaceLogger",
    timestamps: true,
    transports: [
        new ts_logger_1.ConsoleTransport({ threshold: DEFAULT_LOG_LEVEL }),
        new ts_logger_1.FileTransport({ path: "logs/client-log.txt" })
    ]
};
const testHandler = {
    onSetup: () => console.log("Setup complete"),
    onClose: () => console.log("Connection closed"),
    onSignalMessage: (flags, payload) => console.log("Signal message received:", flags, payload),
    onReconnect: () => console.log("Reconnected")
};
exports.testHandler = testHandler;
class ClientSocketInterface {
    constructor(handler, handlerType, shouldReconnect = false) {
        this.logger = new ts_logger_1.Logger(loggerOptions);
        this.dataChannelConfig = {
            ordered: false,
            maxPacketLifetime: 1000
        };
        this.localDescriptionSet = false;
        this.remoteDescriptionSet = false;
        this.connectedToSignalingServer = false;
        this.iceCandidates = [];
        this.handlerType = handlerType;
        this.shouldReconnect = shouldReconnect;
        this.isClosing = false;
        this.handler = handler;
        this.waitFor = new Map();
        this.timeouts = new Map();
        this.peerConnection = new wrtc_1.RTCPeerConnection(servers);
        this.setupIceCandidates();
    }
    setupIceCandidates() {
        this.peerConnection.onicecandidate = (event) => {
            if (!event.candidate)
                return;
            this.iceCandidates.push(event.candidate);
        };
    }
    onSignalMessage(messagePayload) {
        const messageJson = JSON.parse(messagePayload);
        let flags = messageJson.flags.split(" | ");
        const payload = messageJson.payload;
        flags = flags.map((flag) => flag.trimEnd());
        this.logger.debug(`Received signal message with flags: ${flags.join(", ")}`);
        this.logger.debug(`Message payload: ${payload}`);
        const passedFlags = flags.slice(1).length > 0 ? flags.slice(1) : [];
        if (this.waitFor.has(flags[0])) {
            //Will always be a function
            this.waitFor.get(flags[0])(flags, payload);
        }
        switch (flags[0]) {
            case "MESSAGE":
                this.handler.onSignalMessage(passedFlags, payload);
                break;
            case "RECONNECT":
                this.handler.onReconnect?.();
                this.handler.onSetup();
                break;
            case "SHOULD_RECONNECT":
                this.shouldReconnect = true;
                break;
            case "NO_RECONNECT":
                this.shouldReconnect = false;
                break;
            case "OPEN":
                this.logger.debug("Data channels are open");
                if (this.timeouts.get("openBackup")) {
                    clearTimeout(this.timeouts.get("openBackup"));
                }
                break;
            case "SERVER_LIST":
                break;
            case "HEARTBEAT":
                this.sendSignaling("", ["HEARTBEAT"], true);
                break;
            case "CLOSE":
                this.handler.onClose?.();
                this.closeConnection();
                this.isClosing = true;
                break;
            default:
                console.error("Unknown signal message type:", flags[0]);
        }
    }
    onClose() {
        this.logger.info("Peer connection closed");
        this.handler.onClose?.();
        if (!this.isClosing) {
            this.logger.error("Connection closed unexpectedly");
            if (this.shouldReconnect) {
                this.logger.info("Attempting to reconnect...");
                this.peerConnection = new wrtc_1.RTCPeerConnection(servers);
                this.setupIceCandidates();
                this.start();
            }
        }
        else {
            this.logger.info("Connection closed");
        }
    }
    closeConnection() {
        this.isClosing = true;
        this.logger.info(`Closing connection ${this.connectionId}`);
        this.sendSignaling("", ["CLOSE"], true);
        this.waitForMessage("CLOSE", 2000, "Client did not confirm close. Closing anyway.");
    }
    sendSignaling(message, flags, toConnManager = false) {
        if (!toConnManager) {
            flags.unshift("MESSAGE");
        }
        const fullMessage = JSON.stringify({
            flags: flags.join(" | "),
            payload: message
        });
        this.logger.debug(`Sending signal message with flags: ${flags.join(", ")}`);
        this.logger.debug(`Message data: ${message}`);
        if (this.signalChannel.readyState === "open")
            this.signalChannel.send(fullMessage);
        else
            this.logger.warn(`Signaling channel not open to send message: ${fullMessage}`);
    }
    async connectToServer(serverSelector) {
        let resultOk = true;
        let resultErrorText = "";
        await new Promise((resolve, reject) => {
            const waitPromise = this.waitForMessage("SERVER_LIST", 8000, "");
            waitPromise.then((value) => {
                const payload = value.payload;
                const servers = JSON.parse(payload);
                const validServers = servers.filter(serverSelector);
                if (validServers.length < 1)
                    reject("Invalid selector, passed no servers.");
                if (validServers.length > 1)
                    reject("Invalid selector, passed more than one server.");
                resolve(validServers[0]);
            }).catch(() => reject("Server list never received."));
            this.sendSignaling("", ["GET_SERVERS"], true);
        }).then((value) => {
            this.joinServer(value.server_id);
        }).catch((reason) => {
            resultErrorText = reason;
            resultOk = false;
        }).finally(() => {
            if (!resultOk)
                this.logger.error(resultErrorText);
            return resultOk;
        });
    }
    async waitForMessage(flag, timeoutLength = -1, errMsg = "") {
        return new Promise((resolve, reject) => {
            this.waitFor.set(flag, (flags, payload) => {
                resolve({ flags, payload });
            });
            if (timeoutLength > 0)
                this.timeouts.set(flag, setTimeout(() => {
                    if (errMsg !== null)
                        this.logger.error(errMsg);
                    reject();
                }, timeoutLength));
        }).finally(() => {
            this.waitFor.delete(flag);
            if (this.timeouts.has(flag))
                clearTimeout(this.timeouts.get(flag));
        });
    }
    createServer(type) {
        this.sendSignaling(JSON.stringify({
            method: "CREATE",
            type: type
        }), ["SERVER_CONNECT"], true);
    }
    logConnectionStates() {
        this.logger.debug("Connection state: ", this.peerConnection.connectionState);
        this.logger.debug("Ice connection state: ", this.peerConnection.iceConnectionState);
        this.logger.debug("Ice gathering state: ", this.peerConnection.iceGatheringState);
        this.logger.debug("Signaling state: ", this.peerConnection.signalingState);
        this.logger.debug("Remote description set? ", this.remoteDescriptionSet);
        this.logger.debug("Local description set? ", this.localDescriptionSet);
    }
    joinServer(id) {
        this.sendSignaling(JSON.stringify({
            method: "JOIN",
            serverId: id
        }), ["SERVER_CONNECT"], true);
    }
    async getServers() {
        const servers = this.waitForMessage("SERVER_LIST");
        this.sendSignaling("", ["GET_SERVERS"], true);
        return servers;
    }
    checkResponseOk(response) {
        if (!response.ok) {
            this.logger.error(`Server responded with status: ${response.status}`);
            throw new Error(`Server responded with status: ${response.status}`);
        }
    }
    async start() {
        return new Promise(async (resolve, reject) => {
            this.logger.info("Pinging signaling server...");
            let response;
            if (!this.connectionId) {
                response = await fetch(`${serverUrl}${prefix}/new-connection`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ "handlerType": this.handlerType })
                });
            }
            else {
                response = await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/reconnect`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
            }
            this.checkResponseOk(response);
            this.connectedToSignalingServer = true;
            const { offerType, offerSdp, id } = await response.json();
            const offer = new wrtc_1.RTCSessionDescription({ type: offerType.toLowerCase(), sdp: offerSdp });
            this.connectionId = id;
            await this.peerConnection.setRemoteDescription(offer);
            this.remoteDescriptionSet = true;
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.localDescriptionSet = true;
            const offerResp = await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/offer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ offerType: answer.type.toUpperCase(), offerSdp: answer.sdp }),
            });
            this.checkResponseOk(offerResp);
            this.logger.info("Exchanging ICE candidates...");
            this.logger.debug(this.iceCandidates.length);
            if (this.iceCandidates.length > 0) {
                for (const candidate of this.iceCandidates) {
                    await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/ice-candidates`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(candidate),
                    });
                }
            }
            this.iceCandidates.length = 0;
            this.checkResponseOk(offerResp);
            const iceResp = await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/ice-candidates`);
            const { candidates } = await iceResp.json();
            this.logger.debug(candidates.length);
            this.logger.debug(candidates);
            if (candidates && candidates.length > 0) {
                for (const candidate of candidates) {
                    const parsedCandidate = new wrtc_1.RTCIceCandidate(candidate);
                    await this.peerConnection.addIceCandidate(parsedCandidate);
                    this.logger.debug(this.peerConnection.connectionState);
                }
            }
            this.logger.info("Waiting for data channels...");
            this.logConnectionStates();
            await new Promise((resolve, reject) => {
                let channelsOpen = 0;
                this.timeouts.set("dataChannelTimeout", setTimeout(() => {
                    reject("Data channels did not open in time.");
                }, 10000));
                this.peerConnection.ondatachannel = (event) => {
                    if (event.channel.label === "signalChannel") {
                        this.signalChannel = event.channel;
                    }
                    else if (event.channel.label === "dataChannel") {
                        this.dataChannel = event.channel;
                    }
                    else {
                        this.logger.error("Unknown data channel label: " + event.channel.label);
                        return;
                    }
                    channelsOpen++;
                    if (channelsOpen === 2) {
                        resolve();
                    }
                };
            });
            if (this.timeouts.get("dataChannelTimeout")) {
                clearTimeout(this.timeouts.get("dataChannelTimeout"));
            }
            this.handler.onSetup();
            this.signalChannel.onmessage = (event) => {
                this.onSignalMessage(event.data);
            };
            this.signalChannel.onclose = () => {
                this.logger.info("Signaling channel closed");
                this.onClose();
            };
            this.dataChannel.onmessage = (event) => {
                this.handler.onDataMessage?.(event.data);
            };
            this.logger.info("Testing data channels...");
            this.sendSignaling("", ["OPEN"], true);
            await this.waitForMessage("OPEN", 5000, "Data channels did not open properly.");
            this.logger.info("Setup complete.");
            resolve();
        }).catch((err) => {
            if (err)
                this.logger.error("Connection setup failed:", err);
            else
                this.logger.error("Connection setup failed.");
            throw new Error("Connection setup failed.");
        });
    }
}
exports.ClientSocketInterface = ClientSocketInterface;
//# sourceMappingURL=clientSocketInterface.js.map