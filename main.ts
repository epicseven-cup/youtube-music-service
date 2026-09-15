import {app, Menu, Tray, nativeImage} from 'electron'
import {YouTubeDiscordRPCService} from "./service/youtubeMusic.js";
import {CLIENT_ID} from "./shared/constants.js";
import * as path from "node:path";
import {fileURLToPath} from "node:url";



const dirname = path.dirname(fileURLToPath(import.meta.url));
let tray: null | Tray = null
const service = new YouTubeDiscordRPCService(CLIENT_ID,  5432)

app.whenReady().then(() => {
    const trayDir = app.isPackaged
        ? path.join(process.resourcesPath, 'tray')
        : path.join(dirname, 'tray');
    const iconName = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
    const imagePath = path.join(trayDir, iconName);
    console.log("imagePath:",imagePath)
    let image = nativeImage.createFromPath(imagePath)

    if (process.platform === 'darwin') {
        image.setTemplateImage(true)
    }
    tray = new Tray(image)

    tray.setToolTip('Youtube Music Service');
    const contextMenu = Menu.buildFromTemplate([
        {label: 'Quit', click: () => app.quit()},
    ])
    tray.setContextMenu(contextMenu)

    service.run()

})
