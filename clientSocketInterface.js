const wrtc = require('@roamhq/wrtc');
//const fetch = require('node-fetch');

const serverUrl = 'http://localhost:3000';
//const serverUrl = 'http://34.30.63.214:3000';
const prefix = '/api';

const type = 'testing'

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ]
};

const testHandler = {
        onSetup: () => console.log('Setup complete'),
        onOpen: () => console.log('Connection opened'),
        onClose: () => console.log('Connection closed'),
        onSignalMessage: (flags, payload) => console.log('Signal message received:', flags, payload),
        onReconnect: (flags, payload) => console.log('Reconnected:', flags, payload),
}

class ClientSocketInterface {
    constructor(handler, shouldReconnect = false) {
        this.setupPeerConnection(servers);

        this.connectedToSignalingServer = false;
        this.iceCandidates = [];
        

        this.shouldReconnect = shouldReconnect;
        this.isClosing = false;

        this.handler = handler;
        this.handler.connection = this;
    }

    setupPeerConnection(servers) {
        this.peerConnection = new wrtc.RTCPeerConnection(servers);
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                if (!this.connectedToSignalingServer) this.iceCandidates.push(event.candidate);
                else {
                    fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/ice-candidate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(event.candidate),
                    });
                }
            }
        };
    }

    onSignalMessage(messageData) {
        let flags = messageData.split(' | ');
        const payload = flags[flags.length - 1];
        flags = flags.slice(0, -1);

        const passedFlags = flags.slice(1).length > 0? flags.slice(1) : [];

        // console.log(messageData, flags, payload);

        switch (flags[0]) {
            case 'MESSAGE':
                this.handler.onSignalMessage(passedFlags, payload);
                break;

            case 'RECONNECT':
                if (this.handler.onReconnect) this.handler.onReconnect(passedFlags, payload);
                this.handler.onSetup(passedFlags, payload);
                break;

            case 'SHOULD_RECONNECT':
                this.shouldReconnect = true;
                break;

            case 'NO_RECONNECT':
                this.shouldReconnect = false;
                break;

            case 'OPEN':
                // console.log('Received OPEN signal');
                if (this.handler.onOpen) this.handler.onOpen(passedFlags, payload);

                this.confirmOpen();
                if (this.openBackup) {
                    clearTimeout(this.openBackup);
                }
                break;

            case 'CLOSE':
                this.handler?.onClose(passedFlags, payload);
                this.closeConnection();
                if (this.closeBackup) {
                    clearTimeout(this.closeBackup);
                }
                this.isClosing = true;
                break;

            default:
                console.error('Unknown signal message type:', flags[0]);
        }
    }

    onClose() {
        console.log('Peer connection closed');
        this.handler?.onClose();
        if (!this.isClosing) {
            console.error('Connection closed unexpectedly');
            if (this.shouldReconnect) {
                console.log('Attempting to reconnect...');
                this.setupPeerConnection(servers);
                this.setupConnection();
            }
        } else {
            console.log('Connection closed');
        }
    }

    closeConnection() {
        this.isClosing = true;
        console.log(`Closing connection ${this.id}`);
        this.sendSignaling('', ['CLOSE'], true);
        this.closeBackup = setTimeout(() => {
            console.error('Peer did not confirm close. Closing anyway.');
            this.peerConnection.close();
        }, 1000);
    }

    sendSignaling(message, flags, toConnManager=false) {
        if (!toConnManager) {
            flags.unshift('MESSAGE');
        }
        const fullMessage = flags.reduce((msg, flag) => `${msg}${flag} | `, '') + message;
        this.signaling.send(fullMessage);
    }

    async setupConnection() {
        try {
            console.log('Pinging signaling server...');
            
            let response;
            if (!this.connectionId) {
                response = await fetch(`${serverUrl}${prefix}/new-connection`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
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

            this.connectedToSignalingServer = true;
                
            const { id, offer } = await response.json();
            this.connectionId = id;

            await this.peerConnection.setRemoteDescription(new wrtc.RTCSessionDescription(offer));

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            const offerResp = await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/offer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(answer),
            });

            console.log('Exchanging ICE candidates...');

            if (this.iceCandidates.length > 0) {
                for (const candidate of this.iceCandidates) {
                    await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/ice-candidate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(candidate),
                    });
                }
            }
            this.iceCandidates = [];
            
            const iceResp = await fetch(`${serverUrl}${prefix}/connections/${this.connectionId}/candidates`);
            const { iceCandidates } = await iceResp.json();
            if (iceCandidates && iceCandidates.length > 0) {
                for (const candidate of iceCandidates) {
                    await this.peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
                }
            }

            console.log('Setting up data channels...');

            await new Promise((resolve, reject) => {
                let received = 0;
                this.channelBackup = setTimeout(() => {
                    reject(new Error('Data channel setup timeout'));
                }, 5000);
                this.peerConnection.ondatachannel = (event) => {
                    console.log('Data channel received:', event.channel.label);
                    this[event.channel.label] = event.channel;

                    received++;
                    if (received === 2) resolve();
                };
            });

            if (this.channelBackup) {
                clearTimeout(this.channelBackup);
            }

            this.signaling.onmessage = (event) => {
                this.onSignalMessage(event.data);
            }

            this.signaling.onclose = () => {
                console.log('Signaling channel closed');
                this.onClose();
            }

            this.data.onmessage = (event) => {
                this.handler.onDataMessage(event.data);
            }

            console.log('Testing data channel communication...');

            await new Promise((resolve, reject) => {
                this.confirmOpen = resolve;
                this.openBackup = setTimeout(() => {
                    reject(new Error('Data channel open confirmation timeout'));
                }, 5000);
                
                this.sendSignaling('', ['OPEN'], true);
            });

            console.log('Connection setup complete');
            this.handler.onSetup();

        } catch (error) {
                console.error('Error during connection setup:', error);
        }   
    }

}

testHandler.onSetup = () => {
    console.log('Setup complete, closing connection');
    setTimeout(() => testClient.peerConnection.close(), 1000);
    testHandler.onSetup = () => {
        console.log('Setup complete');
    };     
};

const testClient = new ClientSocketInterface(testHandler);



testClient.setupConnection();

