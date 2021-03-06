import { app, ipcMain, protocol, BrowserWindow, Menu } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import * as minimist from 'minimist';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

const isDevelopment = process.env.NODE_ENV !== 'production';

function usage() {
	console.error('Usage: picachoo [path]');
}

const argv = minimist(process.argv.slice(process.defaultApp ? 2 : 1));

if (argv.help) {
	usage();
	process.exit(0);
}

if (argv._.length > 1) {
	usage();
	process.exit(1);
}

function getArgPath(): string | null | undefined {
	if (!argv._[0]) return;

	const argPath = path.resolve(argv._[0]);
	try {
		if (!fs.statSync(argPath).isDirectory()) {
			return null;
		}
	} catch (e) {
		return null;
	}

	return argPath;
}

const argPath = getArgPath();
if (argPath === null) {
	console.warn(`Could not find directory '${argv._[0]}'`);
}

global.sourcePath = argPath ?? path.resolve();

app.allowRendererProcessReuse = true;

app.whenReady().then(() => {
	protocol.registerFileProtocol('file', (request, callback) => {
		callback(decodeURIComponent(new URL(request.url).pathname));
	});
});

async function installReactDevTools(): Promise<void> {
	const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer');
	const name = await installExtension(REACT_DEVELOPER_TOOLS);
	console.log(`Added Extension: ${name}`);
}

function createWindow(): void {
	const window = new BrowserWindow({
		title: 'PiCaChoo',
		show: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			allowRunningInsecureContent: false,
			enableRemoteModule: true,
			webSecurity: !isDevelopment,
		},
	});

	window.webContents.on('devtools-opened', () => {
		window.webContents.focus();
	});

	if (isDevelopment) {
		window.webContents.openDevTools();
	}

	ipcMain.once('ready-to-show', () => {
		window.show();
	});

	window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

async function initialize(): Promise<void> {
	if (isDevelopment) {
		await installReactDevTools();
	} else {
		Menu.setApplicationMenu(null);
	}

	createWindow();
}

// create main BrowserWindow when electron is ready
app.on('ready', initialize);
