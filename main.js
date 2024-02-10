const fs = require('fs')
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const prompt = require('electron-prompt')

let win, currentBlueprintPath;
let editorDirty = false;

const setEditorDirty = (dirty) => {
	console.log("setting editor dirty to", dirty)
	editorDirty = dirty;
}

/**
 * Prompts the user to save unsaved changes before proceeding
 * @returns {boolean} true if the user should proceed without saving, false otherwise
 */
const shouldProceedWithoutSaving = (nextStep="quit") => {
	if (!editorDirty) {
		return true;
	}

	const choice = dialog.showMessageBoxSync(win, {
		type: 'question',
		buttons: ['Yes', 'No'],
		title: 'Quit with unsaved changes?',
		message: `You have unsaved changes. Are you sure you want to ${nextStep}?`
	})

	return choice === 0;
}

const onExit = (event) => {
	const shouldQuit = shouldProceedWithoutSaving()
	if (!shouldQuit) {
		event.preventDefault(); // Prevents the app from quitting but it's not working ????
	}
}

const createWindow = () => {
	win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true,
			devTools: true,
			contentIsolation: false,
			preload: __dirname + '/preload.js'
		}
	})

	win.loadFile('index.html')
	win.webContents.openDevTools()
}

const enableSaveMenuItems = () => {
	if (currentBlueprintPath) {
		Menu.getApplicationMenu().getMenuItemById('blueprint:save').enabled = true
	}
	Menu.getApplicationMenu().getMenuItemById('blueprint:saveAs').enabled = true
}

const disableSaveMenuItem = () => {
	Menu.getApplicationMenu().getMenuItemById('blueprint:save').enabled = false
}

const loadBlueprint = (path) => {
	if (!shouldProceedWithoutSaving("open a blueprint")) {
		return;
	}
	setEditorDirty(false);
	if (!path) {
		paths = dialog.showOpenDialogSync({ properties: ['openFile'], filters: [{ name: 'Blueprints', extensions: ['json'] }]	})
		if (!paths) {
			console.log("No path selected")
			return;
		}
		path = paths[0]
	}
	currentBlueprintPath = path

	const blueprintJson = fs.readFileSync(currentBlueprintPath, 'utf8')

	app.addRecentDocument(currentBlueprintPath)

	console.log("sending blueprint", blueprintJson)
	win.webContents.send('load-blueprint', { blueprintJson })
	enableSaveMenuItems()
}

const loadBlueprintFromURL = async () => {
	if (!shouldProceedWithoutSaving("import a blueprint from a URL")) {
		return;
	}
	setEditorDirty(false);

	const url = await prompt({
		title: 'Enter URL',
		label: 'URL:',
		value: 'https://playground.wordpress.net/blueprint-schema.json',
		inputAttrs: {
			type: 'url'
		},
		type: 'input'
	})
	if (!url) {
		console.log("No URL entered")
		return;
	}

	const blueprint = await fetch(url)
	const blueprintJson = await blueprint.json()

	if (!blueprintJson) {
		console.log("No blueprint found at", url)
		return;
	}
	currentBlueprintPath = ""
	win.webContents.send('load-blueprint', { blueprintJson: JSON.stringify(blueprintJson, null, 2) })
	enableSaveMenuItems()
}

const blueprintSave =  async() => {
	if (!currentBlueprintPath) {
		console.log("No current blueprint path")
		return;
	}
	blueprintJson = await win.webContents.executeJavaScript('document.getElementById("editor").value')

	fs.writeFileSync(currentBlueprintPath, blueprintJson)

	disableSaveMenuItem()
	setEditorDirty(false);
}

const blueprintSaveAs = () => {
	const defaultPath = currentBlueprintPath || "my-blueprint.json"
	const path = dialog.showSaveDialogSync({ defaultPath, properties: ['openFile', 'openDirectory'] })
	if (!path) {
		console.log("No path selected")
		return;
	}
	currentBlueprintPath = path
	blueprintSave()
}

const handleEditorChange = (_e, _value) => {
	console.log("editor changed")
	enableSaveMenuItems()
	setEditorDirty(true);
}

const handleBlueprintEvent = (_e, event) => {
	switch (event) {
		case 'save':

			currentBlueprintPath ? blueprintSave() : blueprintSaveAs()
			break;
		case 'open':
			loadBlueprint()
			break;
		case 'import':
			loadBlueprintFromURL()
			break;
		case 'new':
			if (shouldProceedWithoutSaving("create a new blueprint")) {
				win.webContents.send('load-blueprint', { blueprintJson: "" })
				currentBlueprintPath = ""
				disableSaveMenuItem()
				editorDirty = false;
			}
			break;
	}
}


const isMac = process.platform === 'darwin'

const template = [
	...(isMac ? [{ role: 'appMenu' }] : []),
	{
		label: 'Blueprints',
		role:'fileMenu',
		submenu: [
			{ label: 'New', accelerator: 'CmdOrCtrl+N', click: () => handleBlueprintEvent(null, 'new') },
			{ label: 'Open', accelerator: 'CmdOrCtrl+O', click: () => loadBlueprint() },

			/*
			app.addRecentDocument(path) seems to be working when left clicking on the app icon in the dock
			but not when right clicking on the app icon in the dock and selecting "Open Recent"
			{
				id: 'blueprint:openRecent',
				label: "Open Recent",
				role: "recentdocuments",
				submenu: [
					{
          "label":"Clear Recent",
          "role":"clearrecent"
        }
				]
			},
			*/
			{ label: 'Import from URL', click: () => loadBlueprintFromURL() },

			{ id: 'blueprint:save', label: 'Save', accelerator: 'CmdOrCtrl+S', click: blueprintSave, enabled: false },
			{ id: 'blueprint:saveAs', label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: blueprintSaveAs, enabled: false },
		]
	}
]

const menu = Menu.buildFromTemplate(template)

app.whenReady().then(() => {
	createWindow()
	//app.on('window-all-closed', onExit)
	app.on('will-quit', onExit)
	ipcMain.on('editor-input', handleEditorChange)
	ipcMain.on('blueprint-event', handleBlueprintEvent)
	Menu.setApplicationMenu(menu);

	app.on('open-file', (event, path) => {
		loadBlueprint(path)
	});
})