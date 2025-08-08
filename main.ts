import {app, Menu, Tray, nativeImage} from 'electron'
import {YouTubeDiscordRPCService} from "./service/youtubeMusic";
import {CLIENT_ID} from "./shared/constants";
import * as path from "node:path";



let tray: null | Tray = null
const service = new YouTubeDiscordRPCService(CLIENT_ID,  5432)
service.run()

// app.whenReady().then(() => {
//     // This is a bad selection pathing changing, fix it later
//     const imagePath = path.join(__dirname, 'tray', 'tray.png');
//     console.log("imagePath:",imagePath)
//     let image = nativeImage.createFromPath(imagePath)
//
//     image.setTemplateImage(true)
//     tray = new Tray(image)
//
//     tray.setToolTip('Youtube Music Service');
//     const contextMenu = Menu.buildFromTemplate([
//         {label: 'Quit', click: () => app.quit()},
//         {label: 'Restart', click: () => service.restart()},
//     ])
//     tray.setContextMenu(contextMenu)
//
//     service.run()
//
// })
