import { Client, Presence } from "discord-rpc";
import { Server } from "socket.io";
import { DEFAULT } from "../shared/constants.js";
import * as net from "node:net"

import * as winston from "winston";
import * as fs from "node:fs";

const LOGPATH = `${process.env.HOME}/.youtube-music-service`;


function CreateLogger() {
  if (!fs.existsSync(LOGPATH)) {
    fs.mkdirSync(LOGPATH);
  }
  const currentTime = new Date(Date.now()).toISOString();

    return winston.createLogger({
      level: "info",
      format: winston.format.json(),
      defaultMeta: { service: "youtube-music" },
      transports: [
        new winston.transports.File({
          filename: `${LOGPATH}/youtube-mp3-error-${currentTime}.log`,
          level: "error",
          options: { flags: "w" },
        }),
        new winston.transports.File({
          filename: `${LOGPATH}/youtube-mp3-${currentTime}.log`,
          options: { flags: "w" },
        }),
      ],
  });
}




const LOGGER: winston.Logger = CreateLogger();

// websocket of discord-rpc doesn't work, or is not supported

export class YouTubeDiscordRPCService {
  private _rpcClient: Client | null = null;
  private _wsServer: Server;
  private _port: number;
  private _clientId: string;
  private _jobs: NodeJS.Timeout[];

  constructor(clientId: string, port: number) {

    this._clientId = clientId;
    this._port = port;
    this._wsServer = new Server({ transports: ["websocket"] });
    this._jobs = [];

  }

  start_discordRPC_client() {
    // Starting a new Client
    this._rpcClient = new Client({ transport: "ipc" });




    // Client events
    this._rpcClient.on("ready", () => {

      if (this._rpcClient == null) {
        LOGGER.warn("Client is not start up correctly.");
        return
      }
      this._rpcClient.setActivity(DEFAULT);
    });

    this._rpcClient.on("disconnected", () => {
      LOGGER.info("Discord disconnected");
      this._rpcClient = null;

      const id = setInterval(() => {
        this.discover();
      }, 3000);
      this._jobs.push(id);
    });

    this._rpcClient.login({ clientId: this._clientId });
  }

  reconnect() {
    LOGGER.info("Reconnecting...");
    this._jobs.forEach((job) => {
      clearInterval(job);
    });
    this._jobs = [];

    this.start_discordRPC_client();
    LOGGER.info("Reconnected to Discord");
  }

  update(p: Presence) {
    LOGGER.info("Updating...");
    // Quick bug fix
    if (p.details === "") {
      p.details = "--";
    }


    if (this._rpcClient == null) {
      LOGGER.warn("Client is not start up correctly.");
      return
    }

    this._rpcClient.setActivity(p);
    LOGGER.info("Updated Discord RPC");
    LOGGER.info(p);
  }

  discover() {
    LOGGER.info("Discovering...");
    const {
      env: { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP },
    } = process;
    const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || "/tmp";

    const path: string =
      process.platform == "win32"
        ? `\\.\pipe\discord-ipc`
        : `${prefix.replace(/\/$/, "")}/discord-ipc`;
    for (let i = 0; i <= 9; i++) {
      const fullPath: string = `${path}-${i}`;
      const client = net.createConnection({ path: fullPath });
      client.on("error", () => {
        LOGGER.error(`Failed to reconnect to ${fullPath}`);
      });

      client.on("connect", () => {
        LOGGER.info(`Discovered that ${fullPath} is up`);
        client.end();
        this.reconnect();
      });

      client.on("close", () => {
        LOGGER.info(`${fullPath} is closed`);
      });
    }
    LOGGER.info("Finish discovering");
  }

  run() {
    this._wsServer.listen(this._port);

    this.start_discordRPC_client();



    this._wsServer.on("connection", (socket) => {
      LOGGER.info("Connected to YouTube Music Browser Plugin");

      socket.on("update", (data: Presence) => {
        if (this._rpcClient != null) {
          this.update(data);
        }
      });
    });

    this._wsServer.on("error", function (socket) {
      LOGGER.error(`Failed to connect to YouTube Music Browser Plugin`);
      LOGGER.error(socket.data);
    });

    this._wsServer.on("disconnect", function (socket) {
      LOGGER.info(
        `Disconnected from YouTube Music Browser Plugin`,
        socket.id,
      );
    });
  }
}
