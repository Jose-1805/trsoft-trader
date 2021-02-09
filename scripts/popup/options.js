let btn_start_trading = document.getElementById('btn_start_trading');
let btn_connect_clients = document.getElementById('btn_connect_clients');
let btn_disconnect_clients = document.getElementById('btn_disconnect_clients');
let id_interval_print_percentage = null;

btn_start_trading.onclick = function(element) {
	chrome.storage.sync.get('trading_is_running', function(data) {
		//Si trading no está corriendo se intenta iniciar
		if(!data.trading_is_running){
			showLoading();
			chrome.extension.getBackgroundPage().startTrading(() => {
				showView();
			}, () => {
				alert('Ocurrio un error iniciando la sesión de trading. Recuerde que para iniciar una sesiòn de trading debe tener una sesiòn iniciada en el broker. (#trading1)');
				showView();
			});
		}
	});
}

btn_connect_clients.onclick = function(element) {
	chrome.storage.sync.get('connected_clients', function(data) {
		//Si los cleintes aùn no están conectados
		if(!data.connected_clients){
			showLoading();
			chrome.extension.getBackgroundPage().startSessionTrading(() => {
				showView();

				id_interval_print_percentage = setInterval(function(){
					chrome.storage.sync.get('percentage_clients_connected', function(data) {
						showView();

						if(data.percentage_clients_connected == 100){
							clearInterval(id_interval_print_percentage);
						}						
					})
				}, 500)
			});
		}
	});
}

btn_disconnect_clients.onclick = function(element) {
	chrome.storage.sync.get('connected_clients', function(data) {
		//Si los cleintes están conectados
		if(data.connected_clients){
			showLoading();
			chrome.extension.getBackgroundPage().endSessionTrading(() => {
				showView();

				id_interval_print_percentage = setInterval(function(){
					chrome.storage.sync.get('percentage_clients_connected', function(data) {
						showView();
						
						if(data.percentage_clients_connected == 0){
							clearInterval(id_interval_print_percentage);
						}						
					})
				}, 500)
			});
		}
	});
}