declare const testHandler: WebrtcClientHandler;
declare class ClientSocketInterface {
    private connectedToSignalingServer;
    private readonly iceCandidates;
    private shouldReconnect;
    private readonly handlerType;
    private isClosing;
    private connectionId;
    private logger;
    private readonly dataChannelConfig;
    readonly handler: WebrtcClientHandler;
    private readonly waitFor;
    private readonly timeouts;
    private peerConnection;
    private signalChannel;
    private dataChannel;
    private localDescriptionSet;
    private remoteDescriptionSet;
    constructor(handler: WebrtcClientHandler, handlerType: string, shouldReconnect?: boolean);
    setupIceCandidates(): void;
    onSignalMessage(messagePayload: string): void;
    onClose(): void;
    closeConnection(): void;
    sendSignaling(message: string, flags: string[], toConnManager?: boolean): void;
    connectToServer(serverSelector: ServerSelectorFunction): Promise<void>;
    waitForMessage(flag: string, timeoutLength?: number, errMsg?: string): Promise<unknown>;
    createServer(type: string): void;
    logConnectionStates(): void;
    joinServer(id: string): void;
    getServers(): Promise<unknown>;
    checkResponseOk(response: Response): void;
    start(): Promise<void>;
}
export { ClientSocketInterface, testHandler };
//# sourceMappingURL=clientSocketInterface.d.ts.map