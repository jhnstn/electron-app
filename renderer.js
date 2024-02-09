

(() => {
	console.log("let's go!");

	const editor = document.getElementById('editor');

	window.electronAPI.loadBlueprint((value) => {
		editor.value = value.blueprintJson;
	});

	editor.addEventListener('input', (e) => {
		window.electronAPI.editorInput(e.target.value);
	});

	document.getElementById('save').addEventListener('click', () => {
		window.electronAPI.blueprintEvent('save');
	});

	document.getElementById('open').addEventListener('click', () => {
		window.electronAPI.blueprintEvent('open');
	});

	document.getElementById('import').addEventListener('click', () => {
		window.electronAPI.blueprintEvent('import');
	});

	document.getElementById('new').addEventListener('click', () => {
		window.electronAPI.blueprintEvent('new');
	});

})();
