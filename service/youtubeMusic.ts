import {Client, Presence} from 'discord-rpc';
import {Server} from "socket.io";
import {DEFAULT} from "../shared/constants";
import * as net from "node:net";

import * as winston from 'winston'
import * as fs from "node:fs";


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
        this._wsServer = new Server({transports: ["websocket"]})
        this._jobs = []

        const logPath = `${process.env.HOME}/.youtube-music-service`

        if (!fs.existsSync(logPath)) {
            fs.mkdirSync(logPath)
        }
        const currentTime = new Date(Date.now()).toISOString();

        this._logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            defaultMeta: {service: 'youtube-music'},
            transports: [
                new winston.transports.File({filename: `${logPath}/youtube-mp3-error-${currentTime}.log`, level: 'error', options: {flags: 'w'}}),
                new winston.transports.File({filename: `${logPath}/youtube-mp3-${currentTime}.log`, options: {flags: 'w'}}),
            ]
        })
    }

    start_discordRPC_client(){
        this._rpcClient = new Client({transport: 'ipc'})
        this._rpcClient.login({clientId: this._clientId})
        this._rpcClient.on('ready', ()=> {
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

    }

    reconnect() {
        this._logger.info('Reconnecting...')
        this._jobs.forEach((job) => {
            clearInterval(job)
        })
        this._jobs = []

        this.start_discordRPC_client()
        this._logger.info("Reconnected to Discord")
    }

    update(p: Presence) {
        this._logger.info('Updating...')
        this._rpcClient.setActivity(p)
        // Quick bug fix
        if (p.details === ""){
            p.details = "--"
        }
        this._logger.info('Updated Discord RPC')
        this._logger.info(p)
    }

    discover() {
        this._logger.info('Discovering...')
        const {env: {XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP}} = process;
        const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';

        const path: string = process.platform == 'win32' ? `\\.\pipe\discord-ipc` : `${prefix.replace(/\/$/, '')}/discord-ipc`;
        for (let i = 0; i <= 9; i++) {
            const fullPath: string = `${path}-${i}`
            const client = net.createConnection({path: fullPath})
            client.on('error', () => {
                this._logger.error(`Failed to reconnect to ${fullPath}`)
            })

            client.on('connect', () => {
                this._logger.info(`Discovered that ${fullPath} is up`)
                client.end()
                this.reconnect()
            })

            client.on('close', () => {
                this._logger.info(`${fullPath} is closed`)
            })
        }
        this._logger.info('Finish discovering')
    }

    run() {
        this._wsServer.listen(this._port)

        this.start_discordRPC_client()

        this._wsServer.on('connection', (socket) => {
            this._logger.info('Connected to Youtube Music Browser Plugin')

            socket.on("update", (data: Presence) => {
                if (this._rpcClient != null) {
                    this.update(data)
                }
            })
        })

        this._wsServer.on('error', function (socket) {
            this._logger.error(`Failed to connect to Youtube Music Browser Plugin`)
            this._logger.error(socket.data);
        })

        this._wsServer.on('disconnect', function (socket) {
            this._logger.info(`Disconnected from Youtube Music Browser Plugin`, socket.id)
        })
    }
}
