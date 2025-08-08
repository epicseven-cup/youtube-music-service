import {Client, Presence} from 'discord-rpc';
import {Server} from "socket.io";
import {DEFAULT} from "../shared/constants";
import * as net from "node:net";

import * as winston from 'winston'


// websocket of discord-rpc doesn't work, or is not supported

export class YouTubeDiscordRPCService {
    private _rpcClient: Client
    private _wsServer: Server
    private _port: number
    private _clientId: string
    private _logger: winston.Logger
    private _jobs: NodeJS.Timeout[]

    constructor(clientId: string, port: number) {
        this._clientId = clientId
        this._port = port
        this._rpcClient = new Client({transport: 'ipc'})
        this._wsServer = new Server({transports: ["websocket"]})
        this._jobs = []
        this._logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            defaultMeta: {service: 'youtube-music'},
            transports: [
                new winston.transports.File({filename: 'youtube-mp3-error.log', level: 'error', options: {flags: 'w'}}),
                new winston.transports.File({filename: 'youtube-mp3.log', options: {flags: 'w'}}),
            ]
        })
    }

    connect() {
        this._rpcClient.login({clientId: this._clientId})
        this._logger.info('Connected to Youtube Music Server')
        this._rpcClient.setActivity(DEFAULT)
    }

    reconnect() {
        // this._rpcClient = new Client({transport: 'ipc'})
        this._jobs.forEach((job) => {
            clearInterval(job)
        })
        this._jobs = []
        this._rpcClient = new Client({transport: 'ipc'})
        this._rpcClient.login({clientId: this._clientId})
        this._rpcClient.on('ready', () => {
            this._rpcClient.setActivity(DEFAULT)
        })
    }

    update(p: Presence) {
        this._rpcClient.setActivity(p)
        this._logger.info('Updated Discord RPC')
    }

    discover() {
        const {env: {XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP}} = process;
        const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';

        const path: string = process.platform == 'win32' ? `\\.\pipe\discord-ipc` : `${prefix.replace(/\/$/, '')}/discord-ipc`;
        for (let i = 0; i <= 9; i++) {
            const fullPath: string = `${path}-${i}`
            const client = net.createConnection({path: fullPath})
            client.on('error', () => {
                this._logger.error('Failed to reconnect to Discord pipe')
            })

            client.on('connect', () => {
                this._logger.info('Discovered that discord pipe is up')
                client.end()
                this.reconnect()
            })

            client.on('close', () => {
                this._logger.info('Discord Status finder closed')
            })
        }
    }

    run() {
        this._wsServer.listen(this._port)

        this._rpcClient.on('ready', () => {
            this._rpcClient.setActivity(DEFAULT)
        })

        this._rpcClient.on('disconnected', () => {
            this._logger.info('Discord disconnected')
            this._rpcClient = null

            const id = setInterval(() => {
                this.discover()
            }, 3000)
            this._jobs.push(id)
        })

        this._wsServer.on('connection', (socket) => {
            this._logger.info('Connected to Youtube Music Browser Plugin')

            socket.on("update", (data: Presence) => {
                if (this._rpcClient != null) {
                    this.update(data)
                }
            })
        })

        this._wsServer.on('error', function (socket) {
            console.log("error", socket.data);
        })

        this._wsServer.on('disconnect', function (socket) {
            console.log("disconnect", socket.id);

        })

        this._rpcClient.login({clientId: this._clientId})
    }
}
