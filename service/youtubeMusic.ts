import {Client, Presence} from 'discord-rpc';
import {Server} from "socket.io";
import {DEFAULT} from "../shared/constants";


type Transport = 'ipc' | 'websocket'

export class YouTubeDiscordRPCService {
	rpcClient: Client
	wsServer: Server
	transport: Transport
	port: number
	loginStatus: boolean
	private clientId: string
	constructor(clientId: string, transport: Transport, port: number){
		this.clientId = clientId
		this.transport = transport
		this.rpcClient = new Client({transport: transport})
		this.port = port
		this.wsServer = new Server({transports: ["websocket"]})
		this.loginStatus = false
	}

	restart(){
		this.rpcClient.destroy()
		this.rpcClient = new Client({transport: this.transport})
	}

	connect(){
		this.rpcClient.login({clientId: this.clientId})
		this.loginStatus = true
	}

	update(p:Presence){
		this.rpcClient.setActivity(p)
	}

	run(){
		this.wsServer.listen(this.port)

		while (!this.loginStatus) {
			try {
				this.connect()
			} catch (error) {
				this.connect()
			}
		}

		this.rpcClient.on('ready', () => {
			this.rpcClient.setActivity(DEFAULT)
		})

		this.wsServer.on('connection', (socket) => {
			console.log('socket connected to YoutubeMusicDiscordRPC', socket.id)

			socket.on("update", (data: Presence)=>{
				this.update(data)
			})
		})

		this.wsServer.on('error', function (socket) {
			console.log("error",socket.data);
		})

		this.wsServer.on('disconnect', function (socket) {
			console.log("disconnect",socket.id);
		})
	}
}
