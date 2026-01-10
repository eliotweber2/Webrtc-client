"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testHandler = exports.ClientSocketInterface = void 0;
var wrtc_1 = require("@roamhq/wrtc");
var ts_logger_1 = require("@origranot/ts-logger");
//const serverUrl = "http://localhost:8080";
//const serverUrl = "https://eliotweber.net";
var serverUrl = "https://didactic-bassoon-v6p5x9gqj59pfp6rr-8080.app.github.dev";
var prefix = "/webrtc";
var servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
    ]
};
var loggerOptions = {
    name: "ClientSocketInterfaceLogger",
    timestamps: true,
    transports: [
        new ts_logger_1.ConsoleTransport(),
        new ts_logger_1.FileTransport({ path: "logs/client-log.txt" })
    ]
};
var testHandler = {
    onSetup: function () { return console.log("Setup complete"); },
    onClose: function () { return console.log("Connection closed"); },
    onSignalMessage: function (flags, payload) { return console.log("Signal message received:", flags, payload); },
    onReconnect: function () { return console.log("Reconnected"); }
};
exports.testHandler = testHandler;
var ClientSocketInterface = /** @class */ (function () {
    function ClientSocketInterface(handler, handlerType, shouldReconnect) {
        if (shouldReconnect === void 0) { shouldReconnect = false; }
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
    ClientSocketInterface.prototype.setupIceCandidates = function () {
        var _this = this;
        this.peerConnection.onicecandidate = function (event) {
            if (!event.candidate)
                return;
            _this.iceCandidates.push(event.candidate);
        };
    };
    ClientSocketInterface.prototype.onSignalMessage = function (messagePayload) {
        var _a, _b, _c, _d;
        var messageJson = JSON.parse(messagePayload);
        var flags = messageJson.flags.split(" | ");
        var payload = messageJson.payload;
        flags = flags.map(function (flag) { return flag.trimEnd(); });
        this.logger.debug("Received signal message with flags: ".concat(flags.join(", ")));
        this.logger.debug("Message payload: ".concat(payload));
        var passedFlags = flags.slice(1).length > 0 ? flags.slice(1) : [];
        if (this.waitFor.has(flags[0])) {
            //Will always be a function
            this.waitFor.get(flags[0])(flags, payload);
        }
        switch (flags[0]) {
            case "MESSAGE":
                this.handler.onSignalMessage(passedFlags, payload);
                break;
            case "RECONNECT":
                (_b = (_a = this.handler).onReconnect) === null || _b === void 0 ? void 0 : _b.call(_a);
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
                (_d = (_c = this.handler).onClose) === null || _d === void 0 ? void 0 : _d.call(_c);
                this.closeConnection();
                this.isClosing = true;
                break;
            default:
                console.error("Unknown signal message type:", flags[0]);
        }
    };
    ClientSocketInterface.prototype.onClose = function () {
        var _a, _b;
        this.logger.info("Peer connection closed");
        (_b = (_a = this.handler).onClose) === null || _b === void 0 ? void 0 : _b.call(_a);
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
    };
    ClientSocketInterface.prototype.closeConnection = function () {
        this.isClosing = true;
        this.logger.info("Closing connection ".concat(this.connectionId));
        this.sendSignaling("", ["CLOSE"], true);
        this.waitForMessage("CLOSE", 2000, "Client did not confirm close. Closing anyway.");
    };
    ClientSocketInterface.prototype.sendSignaling = function (message, flags, toConnManager) {
        if (toConnManager === void 0) { toConnManager = false; }
        if (!toConnManager) {
            flags.unshift("MESSAGE");
        }
        var fullMessage = JSON.stringify({
            flags: flags.join(" | "),
            payload: message
        });
        this.logger.debug("Sending signal message with flags: ".concat(flags.join(", ")));
        this.logger.debug("Message data: ".concat(message));
        if (this.signalChannel.readyState === "open")
            this.signalChannel.send(fullMessage);
        else
            this.logger.warn("Signaling channel not open to send message: ".concat(fullMessage));
    };
    ClientSocketInterface.prototype.connectToServer = function (serverSelector) {
        return __awaiter(this, void 0, void 0, function () {
            var resultOk, resultErrorText;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resultOk = true;
                        resultErrorText = "";
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var waitPromise = _this.waitForMessage("SERVER_LIST", 8000, "");
                                waitPromise.then(function (value) {
                                    var payload = value.payload;
                                    var servers = JSON.parse(payload);
                                    var validServers = servers.filter(serverSelector);
                                    if (validServers.length < 1)
                                        reject("Invalid selector, passed no servers.");
                                    if (validServers.length > 1)
                                        reject("Invalid selector, passed more than one server.");
                                    resolve(validServers[0]);
                                }).catch(function () { return reject("Server list never received."); });
                                _this.sendSignaling("", ["GET_SERVERS"], true);
                            }).then(function (value) {
                                _this.joinServer(value.server_id);
                            }).catch(function (reason) {
                                resultErrorText = reason;
                                resultOk = false;
                            }).finally(function () {
                                if (!resultOk)
                                    _this.logger.error(resultErrorText);
                                return resultOk;
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ClientSocketInterface.prototype.waitForMessage = function (flag_1) {
        return __awaiter(this, arguments, void 0, function (flag, timeoutLength, errMsg) {
            var _this = this;
            if (timeoutLength === void 0) { timeoutLength = -1; }
            if (errMsg === void 0) { errMsg = ""; }
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this.waitFor.set(flag, function (flags, payload) {
                            resolve({ flags: flags, payload: payload });
                        });
                        if (timeoutLength > 0)
                            _this.timeouts.set(flag, setTimeout(function () {
                                if (errMsg !== null)
                                    _this.logger.error(errMsg);
                                reject();
                            }, timeoutLength));
                    }).finally(function () {
                        _this.waitFor.delete(flag);
                        if (_this.timeouts.has(flag))
                            clearTimeout(_this.timeouts.get(flag));
                    })];
            });
        });
    };
    ClientSocketInterface.prototype.createServer = function (type) {
        this.sendSignaling(JSON.stringify({
            method: "CREATE",
            type: type
        }), ["SERVER_CONNECT"], true);
    };
    ClientSocketInterface.prototype.logConnectionStates = function () {
        this.logger.debug("Connection state: ", this.peerConnection.connectionState);
        this.logger.debug("Ice connection state: ", this.peerConnection.iceConnectionState);
        this.logger.debug("Ice gathering state: ", this.peerConnection.iceGatheringState);
        this.logger.debug("Signaling state: ", this.peerConnection.signalingState);
        this.logger.debug("Remote description set? ", this.remoteDescriptionSet);
        this.logger.debug("Local description set? ", this.localDescriptionSet);
    };
    ClientSocketInterface.prototype.joinServer = function (id) {
        this.sendSignaling(JSON.stringify({
            method: "JOIN",
            serverId: id
        }), ["SERVER_CONNECT"], true);
    };
    ClientSocketInterface.prototype.getServers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var servers;
            return __generator(this, function (_a) {
                servers = this.waitForMessage("SERVER_LIST");
                this.sendSignaling("", ["GET_SERVERS"], true);
                return [2 /*return*/, servers];
            });
        });
    };
    ClientSocketInterface.prototype.checkResponseOk = function (response) {
        if (!response.ok) {
            this.logger.error("Server responded with status: ".concat(response.status));
            throw new Error("Server responded with status: ".concat(response.status));
        }
    };
    ClientSocketInterface.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                        var response, _a, offerType, offerSdp, id, offer, answer, offerResp, _i, _b, candidate, iceResp, candidates, _c, candidates_1, candidate, parsedCandidate;
                        var _this = this;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    this.logger.info("Pinging signaling server...");
                                    if (!!this.connectionId) return [3 /*break*/, 2];
                                    return [4 /*yield*/, fetch("".concat(serverUrl).concat(prefix, "/new-connection"), {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ "handlerType": this.handlerType })
                                        })];
                                case 1:
                                    response = _d.sent();
                                    return [3 /*break*/, 4];
                                case 2: return [4 /*yield*/, fetch("".concat(serverUrl).concat(prefix, "/connections/").concat(this.connectionId, "/reconnect"), {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" }
                                    })];
                                case 3:
                                    response = _d.sent();
                                    _d.label = 4;
                                case 4:
                                    this.checkResponseOk(response);
                                    this.connectedToSignalingServer = true;
                                    return [4 /*yield*/, response.json()];
                                case 5:
                                    _a = _d.sent(), offerType = _a.offerType, offerSdp = _a.offerSdp, id = _a.id;
                                    offer = new wrtc_1.RTCSessionDescription({ type: offerType.toLowerCase(), sdp: offerSdp });
                                    this.connectionId = id;
                                    return [4 /*yield*/, this.peerConnection.setRemoteDescription(offer)];
                                case 6:
                                    _d.sent();
                                    this.remoteDescriptionSet = true;
                                    return [4 /*yield*/, this.peerConnection.createAnswer()];
                                case 7:
                                    answer = _d.sent();
                                    return [4 /*yield*/, this.peerConnection.setLocalDescription(answer)];
                                case 8:
                                    _d.sent();
                                    this.localDescriptionSet = true;
                                    return [4 /*yield*/, fetch("".concat(serverUrl).concat(prefix, "/connections/").concat(this.connectionId, "/offer"), {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ offerType: answer.type.toUpperCase(), offerSdp: answer.sdp }),
                                        })];
                                case 9:
                                    offerResp = _d.sent();
                                    this.checkResponseOk(offerResp);
                                    this.logger.info("Exchanging ICE candidates...");
                                    this.logger.debug(this.iceCandidates.length);
                                    if (!(this.iceCandidates.length > 0)) return [3 /*break*/, 13];
                                    _i = 0, _b = this.iceCandidates;
                                    _d.label = 10;
                                case 10:
                                    if (!(_i < _b.length)) return [3 /*break*/, 13];
                                    candidate = _b[_i];
                                    return [4 /*yield*/, fetch("".concat(serverUrl).concat(prefix, "/connections/").concat(this.connectionId, "/ice-candidates"), {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(candidate),
                                        })];
                                case 11:
                                    _d.sent();
                                    _d.label = 12;
                                case 12:
                                    _i++;
                                    return [3 /*break*/, 10];
                                case 13:
                                    this.iceCandidates.length = 0;
                                    this.checkResponseOk(offerResp);
                                    return [4 /*yield*/, fetch("".concat(serverUrl).concat(prefix, "/connections/").concat(this.connectionId, "/ice-candidates"))];
                                case 14:
                                    iceResp = _d.sent();
                                    return [4 /*yield*/, iceResp.json()];
                                case 15:
                                    candidates = (_d.sent()).candidates;
                                    this.logger.debug(candidates.length);
                                    this.logger.debug(candidates);
                                    if (!(candidates && candidates.length > 0)) return [3 /*break*/, 19];
                                    _c = 0, candidates_1 = candidates;
                                    _d.label = 16;
                                case 16:
                                    if (!(_c < candidates_1.length)) return [3 /*break*/, 19];
                                    candidate = candidates_1[_c];
                                    parsedCandidate = new wrtc_1.RTCIceCandidate(candidate);
                                    return [4 /*yield*/, this.peerConnection.addIceCandidate(parsedCandidate)];
                                case 17:
                                    _d.sent();
                                    this.logger.debug(this.peerConnection.connectionState);
                                    _d.label = 18;
                                case 18:
                                    _c++;
                                    return [3 /*break*/, 16];
                                case 19:
                                    this.logger.info("Waiting for data channels...");
                                    this.logConnectionStates();
                                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                                            var channelsOpen = 0;
                                            _this.timeouts.set("dataChannelTimeout", setTimeout(function () {
                                                reject("Data channels did not open in time.");
                                            }, 10000));
                                            _this.peerConnection.ondatachannel = function (event) {
                                                if (event.channel.label === "signalChannel") {
                                                    _this.signalChannel = event.channel;
                                                }
                                                else if (event.channel.label === "dataChannel") {
                                                    _this.dataChannel = event.channel;
                                                }
                                                else {
                                                    _this.logger.error("Unknown data channel label: " + event.channel.label);
                                                    return;
                                                }
                                                channelsOpen++;
                                                if (channelsOpen === 2) {
                                                    resolve();
                                                }
                                            };
                                        })];
                                case 20:
                                    _d.sent();
                                    if (this.timeouts.get("dataChannelTimeout")) {
                                        clearTimeout(this.timeouts.get("dataChannelTimeout"));
                                    }
                                    this.handler.onSetup();
                                    this.signalChannel.onmessage = function (event) {
                                        _this.onSignalMessage(event.data);
                                    };
                                    this.signalChannel.onclose = function () {
                                        _this.logger.info("Signaling channel closed");
                                        _this.onClose();
                                    };
                                    this.dataChannel.onmessage = function (event) {
                                        var _a, _b;
                                        (_b = (_a = _this.handler).onDataMessage) === null || _b === void 0 ? void 0 : _b.call(_a, event.data);
                                    };
                                    this.logger.info("Testing data channels...");
                                    this.sendSignaling("", ["OPEN"], true);
                                    return [4 /*yield*/, this.waitForMessage("OPEN", 5000, "Data channels did not open properly.")];
                                case 21:
                                    _d.sent();
                                    this.logger.info("Setup complete.");
                                    resolve();
                                    return [2 /*return*/];
                            }
                        });
                    }); }).catch(function (err) {
                        if (err)
                            _this.logger.error("Connection setup failed:", err);
                        else
                            _this.logger.error("Connection setup failed.");
                        throw new Error("Connection setup failed.");
                    })];
            });
        });
    };
    return ClientSocketInterface;
}());
exports.ClientSocketInterface = ClientSocketInterface;
