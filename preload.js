const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
	loadBlueprint: (cb) => {
		ipcRenderer.on('load-blueprint', (_event, value) => cb(value))
	},
	editorInput: (value) => {
		ipcRenderer.send('editor-input', value)
	},

	blueprintEvent: (event) => {
		ipcRenderer.send('blueprint-event', event)
	}
})