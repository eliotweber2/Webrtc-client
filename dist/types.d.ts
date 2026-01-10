type HandlerFunction = () => void;
type DataFunction = (payload: Object) => void;
type SignalFunction = (flags: string[], payload: Object) => void;
type ServerSelectorFunction = (server: ServerInfo) => boolean;
interface WebrtcClientHandler {
    onSetup: HandlerFunction;
    onClose?: HandlerFunction;
    onDataMessage?: DataFunction;
    onSignalMessage: SignalFunction;
    onReconnect: HandlerFunction;
}
interface ServerInfo {
    "server_id": string;
    "server_type": String;
    "server_info": Object;
}
interface SignalingInfo {
    "types": string[];
    "payload": string;
}
interface IceServers {
    iceServers: RTCIceServer[];
}
//# sourceMappingURL=types.d.ts.map