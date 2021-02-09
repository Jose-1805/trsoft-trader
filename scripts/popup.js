let div_login = document.getElementById('form_login');
let div_trading = document.getElementById('trading');
let div_options = document.getElementById('options');
let div_user_logout = document.getElementById('div_user_logout');
let div_loading = document.getElementById('div_loading');
let text_loading = document.getElementById('text-loading');

if(!chrome.extension.getBackgroundPage()){
	alert('Ocurrio un error inesperado. Actualice o reinstale la extención.');
	window.close();
}else{
	validUserBrokerConnection();
}

/**
 * Determina el estado de la aplicación dependiendo 
 * de si el usuario está conectado al broker
 */
function validUserBrokerConnection(){
	//Si el usuario ha iniciado sesión en el broker
	chrome.extension.getBackgroundPage().userLoginBroker((user_connected) => {
		
		chrome.storage.sync.get(['connected_clients'], (data) => {
			//Si se ha iniciado una sesión de trading
			if(data.connected_clients){
				showView()
				/*//Usuario ha iniciado sesión
				if(user_connected){
				}else {
					//La sesion del broker no está iniciada
					chrome.extension.getBackgroundPage().logout();
				}*/
			}else{
				//Usuario ha iniciado sesión
				if(user_connected){
					div_user_logout.classList.remove('d-none');
					div_loading.classList.add('d-none');
					chrome.extension.getBackgroundPage().logout();
				//La sesion del broker no está iniciada
				}else {
					showView();
				}
			}
		})
	});
}

//Determina que mostrar en el Popup de acuerdo a la autenticación del usuario
function showView(){
	chrome.storage.sync.get(['c_trading_authenticated', 'trading_is_running', 'connected_clients', 'percentage_clients_connected'], function(data) {
		//Si el usuario ya está autenticado con CTrading
		if(data.c_trading_authenticated){
			//Trading activo
			if(data.trading_is_running){
				showTrading();
			}else{
				//Si no esta trading activo se muestra la vista de opciones
				showOptions(data.connected_clients, data.percentage_clients_connected);
			}
		}else{
			showLogin();
		}
	});
}

/**
* Muestra la vista de opciones y oculta lo demás
*/
function showOptions(connected_clients = false, percentage_clients_connected = 0){
	div_options.classList.remove('d-none');
	div_login.classList.add('d-none');
	div_loading.classList.add('d-none');
	div_trading.classList.add('d-none');

	//Si los clientes no están conectados se oculta el 
	//botón de iniciar trading
	if(!connected_clients && percentage_clients_connected == 0){
		document.getElementById('msg_start_trading').classList.add('d-none');
		document.getElementById('btn_start_trading').classList.add('d-none');
		document.getElementById('btn_disconnect_clients').classList.add('d-none');
		document.getElementById('btn_connect_clients').classList.remove('d-none');		
		document.getElementById('btn_logout').classList.remove('d-none');		
	}else{
		if(!connected_clients){
			showLoading(100 - percentage_clients_connected+" %");
		}else{
			if(percentage_clients_connected == 100){
				//Si los clientes ya están conectados se oculta el 
				//botón de conectar clientes
				document.getElementById('msg_start_trading').classList.remove('d-none');
				document.getElementById('btn_start_trading').classList.remove('d-none');
				document.getElementById('btn_disconnect_clients').classList.remove('d-none');
				document.getElementById('btn_connect_clients').classList.add('d-none');		
				document.getElementById('btn_logout').classList.add('d-none');		
			}else{
				showLoading(percentage_clients_connected+" %");
			}
		}
	}
}

/**
* Muestra el formulario de autenticación y oculta lo demás
*/
function showLogin(){
	div_login.classList.remove('d-none');
	div_options.classList.add('d-none');
	div_loading.classList.add('d-none');
	div_trading.classList.add('d-none');
}

/**
* Muestra la vista de trading 
*/
function showTrading(){
	div_trading.classList.remove('d-none');
	div_login.classList.add('d-none');
	div_options.classList.add('d-none');
	div_loading.classList.add('d-none');
}

/**
* Muestra la vista de carga
*/
function showLoading(text = 'Cargando'){
	text_loading.innerHTML = text;
	div_loading.classList.remove('d-none');
	div_trading.classList.add('d-none');
	div_login.classList.add('d-none');
	div_options.classList.add('d-none');
}