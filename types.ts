"use strict";

type handlerFunction = () => void;
type dataFunction = (payload: Object) => void;
type signalFunction = (flags: string[], payload: Object) => void;
type serverSelectorFunction = (server: ServerInfo) => boolean;

interface WebrtcClientHandler {
    onSetup: handlerFunction,
    onClose?: handlerFunction,
    onDataMessage?: dataFunction,
    onSignalMessage: signalFunction,
    onReconnect: handlerFunction
}

interface ServerInfo {
    "server_id": string,
    "server_type": String,
    "server_info": Object
}

interface SignalingInfo {
    "types": string[],
    "data": string
}

interface IceServers {
    iceServers: RTCIceServer[]
}