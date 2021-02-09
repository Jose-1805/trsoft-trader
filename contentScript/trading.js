let asset_information = false;
let asset_selected = false;
let div_content = document.createElement('div');
div_content.id = 'content_trading_view';

document.body.append(div_content);

$(div_content).draggable();

let start_my_account = null;
let practice_account = null;
let amount = null;
let range_increase = null;
let text_increase = null;
let range_expiration = null;
let text_expiration = null;

let text_amount_min = null;
let text_expiration_min = null;
let text_increase_min = null;
let text_open_options_min = null;

let btn_higher = null;
let btn_lower = null;
let btn_higher_minimized = null;
let btn_lower_minimized = null;
let btn_minimize = null;
let btn_maximize = null;

//let text_number_options = null;
//let text_number_successful_options = null;
//let text_number_failed_options = null;
//let text_success_rate = null;
let text_open_options = null;

let div_actives = null;
let div_action_buttons = null;
let div_action_buttons_minimized = null;
let div_waiting_actives = null;
let div_waiting_actives_minimized = null;
let div_controls_trading = null;
let div_info_minimize = null;
let content_maximize = null;
let content_minimize = null;

let expiration_last_operation = null;
let img_last_operation = null;
let direction_last_operation_up = null;
let direction_last_operation_down = null;
let win_last_operation = null;
let lose_last_operation = null;
let equal_last_operation = null;

var port = chrome.runtime.connect();

//port.postMessage({joke: "Knock knock"});
port.onMessage.addListener(function(msg) {
	switch (msg.name) {
		case "sync_data_trading":
			setDataTrading(msg.data);
		break;
		case "start_view_controls_trading":
			startViewControlsTrading();
		break;
		case "stop_view_controls_trading":
			stopViewControlsTrading();
		break;
		default:
		break;
	}
});

function startViewControlsTrading(){
	fetch(chrome.runtime.getURL('trading.html')).then((res) => {
		res.text().then((data) => {
			div_content.innerHTML = data;

			start_my_account = document.getElementById('start_my_account');
			practice_account = document.getElementById('practice_account');
			amount = document.getElementById('amount');
			range_increase = document.getElementById('range_increase');
			text_increase = document.getElementById('text_increase');
			range_expiration = document.getElementById('range_expiration');
			text_expiration = document.getElementById('text_expiration');

			text_amount_min = document.getElementById('text_amount_min');
			text_expiration_min = document.getElementById('text_expiration_min');
			text_increase_min = document.getElementById('text_increase_min');
			text_open_options_min = document.getElementById('text_open_options_min');

			expiration_last_operation = document.getElementById('expiration_last_operation');
			img_last_operation = document.getElementById('img_last_operation');
			direction_last_operation_up = document.getElementById('direction_last_operation_up');
			direction_last_operation_down = document.getElementById('direction_last_operation_down');
			win_last_operation = document.getElementById('win_last_operation');
			lose_last_operation = document.getElementById('lose_last_operation');
			equal_last_operation = document.getElementById('equal_last_operation');

			//text_number_options = document.getElementById('text_number_options');
			//text_number_successful_options = document.getElementById('text_number_successful_options');
			//text_number_failed_options = document.getElementById('text_number_failed_options');
			//text_success_rate = document.getElementById('text_success_rate');
			text_open_options = document.getElementById('text_open_options');

			btn_higher = document.getElementById('btn_higher');
			btn_lower = document.getElementById('btn_lower');

			btn_higher_minimized = document.getElementById('btn_higher_minimized');
			btn_lower_minimized = document.getElementById('btn_lower_minimized');

			btn_maximize = document.getElementById('btn_maximize');
			btn_minimize = document.getElementById('btn_minimize');

			div_actives = document.getElementById('actives_list');

			div_waiting_actives = document.getElementById('waiting_actives_info');
			div_waiting_actives_minimized = document.getElementById('waiting_actives_info_minimized');
			div_action_buttons = document.getElementById('action_buttons');
			div_action_buttons_minimized = document.getElementById('action_buttons_minimized');
			content_maximize = document.getElementById('content_maximize');
			content_minimize = document.getElementById('content_minimize');
			div_controls_trading = document.getElementById('controls_trading');
			div_info_minimize = document.getElementById('info_minimize');

			setEvents();
			requestSyncDataTrading();
		});
	});
}

function stopViewControlsTrading(){
	div_content.innerHTML = "";
}

function setEvents() {
	document.body.onkeydown = (e) => {
		evaluateKeyDownBody(e);
	}

	start_my_account.onchange = () => {
		if(port){
			port.postMessage({name:"update_trading_params", data:{start_my_account:start_my_account.checked}});
		}
	}

	practice_account.onchange = () => {
		if(port){
			port.postMessage({name:"update_trading_params", data:{practice_account:practice_account.checked}});
		}
	}

	amount.onchange = (e) => {
		changeAmount(e);
	}

	amount.onkeyup = (e) => {
		changeAmount(e);
	}

	range_increase.onchange = () => {
		if(port){
			port.postMessage({name:"update_trading_params", data:{range_increase:range_increase.value}});
			text_increase.innerHTML = range_increase.value;
			text_increase_min.innerHTML = range_increase.value;
		}
	}

	range_expiration.onchange = () => {
		if(port){
			port.postMessage({name:"update_trading_params", data:{range_expiration:range_expiration.value}});
			text_expiration.innerHTML = range_expiration.value;
			text_expiration_min.innerHTML = range_expiration.value;
		}
	}

	btn_higher.onclick = () => {
		startOption('call');
	}

	btn_lower.onclick = () => {
		startOption('put');
	}

	btn_higher_minimized.onclick = () => {
		startOption('call');
	}

	btn_lower_minimized.onclick = () => {
		startOption('put');
	}

	btn_maximize.onclick = () => {
		div_controls_trading.style = "z-index: 1; position: absolute;width: 460px; min-width: 460px; padding: 10px;";
		content_minimize.classList.add('d-none');
		content_maximize.classList.remove('d-none');
	}

	btn_minimize.onclick = () => {
		div_controls_trading.style = "z-index: 1; position: absolute;width: 320px; min-width: 320px; padding: 10px;";
		content_maximize.classList.add('d-none');
		content_minimize.classList.remove('d-none');
	}
}

function startOption(direction){
	if(asset_selected && asset_information){
		port.postMessage({name:"start_option", data:{direction:direction}});	
	}
}

function changeAmount(e){
	let val = parseFloat(e.target.value);
	if(Number.isNaN(val))val = 1;

	//SI el numero es decimal
	if(!Number.isInteger(val)){
		let decimals = (val - Math.trunc(val)).toString().split('0.')[1];
		//Si tiene más de un decimal
		if(decimals.length > 1){
			if(decimals[1] != 0){
				val = parseFloat(val.toFixed(2));
			}else{
				val = parseFloat(val.toFixed(1));
			}
		}

	}

	amount.value = val;
	text_amount_min.innerHTML = val;
	
	if(port){
		port.postMessage({name:"update_trading_params", data:{amount:val}});
	}
}

function requestSyncDataTrading(){
	port.postMessage({name:"request_sync_data_trading"});
}

function setDataTrading(data){
	let sync_data = {};
	if(!('start_my_account' in data))
		sync_data.start_my_account = false;

	start_my_account.checked = data.start_my_account?true:false;

	if(!('practice_account' in data))
		sync_data.practice_account = true;

	practice_account.checked = data.practice_account?true:false;

	if(!('amount' in data))
		sync_data.amount = 1;

	amount.value = data.amount?data.amount:1;
	text_amount_min.innerHTML = amount.value;

	if(!('range_increase' in data))
		sync_data.range_increase = 1;

	range_increase.value = data.range_increase?data.range_increase:1;
	text_increase.innerHTML = range_increase.value;
	text_increase_min.innerHTML = range_increase.value;

	if(!('range_expiration' in data))
		sync_data.range_expiration = 1;

	range_expiration.value = data.range_expiration?data.range_expiration:1;
	text_expiration.innerHTML = range_expiration.value;
	text_expiration_min.innerHTML = range_expiration.value;

	/*if(!('number_successful_options' in data))
		sync_data.number_successful_options = 0;

	number_successful_options = data.number_successful_options?data.number_successful_options:0;

	if(!('number_failed_options' in data))
		sync_data.number_failed_options = 0;*/

	if(!('open_options' in data))
		sync_data.open_options = 0;

	port.postMessage({name:"update_trading_params", data:sync_data});

	//number_failed_options = data.number_failed_options?data.number_failed_options:0;
	//success_rate = ((number_successful_options + number_failed_options) > 0)?((number_successful_options * 100)/(number_successful_options + number_failed_options)):0;

	//text_number_options.innerHTML = number_successful_options + number_failed_options;
	//text_number_successful_options.innerHTML = number_successful_options;
	//text_number_failed_options.innerHTML = number_failed_options;
	//text_success_rate.innerHTML = success_rate+"%";
	//
	text_open_options.innerHTML = data.open_options?data.open_options:0;
	text_open_options_min.innerHTML = data.open_options?data.open_options:0;

	if(data.actives){
		div_actives.innerHTML = "";
		let data_actives = [];
		//Se convierte en un array
		for(let i in data.actives){
			data_actives.push(data.actives[i]);
		}

		//Se ordena alfbeticamente
	   	data_actives = data_actives.sort(function (a, b) {
	        var x = a['description'],
	        y = b['description'];

	        //if (orden === 'asc') {
	            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
	        //}

	        /*if (orden === 'desc') {
	            return ((x > y) ? -1 : ((x < y) ? 1 : 0));
	        }*/
	    });

		for(let index = 0; index < data_actives.length; index++){
			let div_active = document.createElement('li');
			div_active.setAttribute('data-active', data_actives[index].id);
			div_active.setAttribute('data-index', index);
			div_active.classList.add('item-active');

			if(data.current_active && data.current_active == data_actives[index].id){
				div_active.classList.add('bg-warning');
				asset_selected = true;

				let div_aux = document.createElement('div');
				let img_active_min = document.createElement('img');
				img_active_min.src = "https://static.cdnpub.info/files"+data_actives[index].image;
				img_active_min.height = "30";
				img_active_min.style = "display: inline";

				let p_min = document.createElement('p');
				p_min.style = "display: inline; font-size: small; margin-left: 10px; font-weight: 700;";
				p_min.innerHTML = data_actives[index].description.split('.')[1];

				div_aux.append(img_active_min);
				div_aux.append(p_min);
				div_info_minimize.innerHTML = div_aux.innerHTML;
			}

			div_active.style = "border-bottom: 1px solid #ededed; padding: 12px 5px; cursor: pointer;";

			let img_active = document.createElement('img');
			img_active.src = "https://static.cdnpub.info/files"+data_actives[index].image;
			img_active.height = "40";
			img_active.style = "display: inline";

			let p = document.createElement('p');
			p.style = "display: inline; font-size: small; margin-left: 10px; font-weight: 700;";
			p.innerHTML = data_actives[index].description.split('.')[1];

			div_active.append(img_active);
			div_active.append(p);

			div_active.addEventListener('click', (e) => {
				if(e.target.tagName != "LI"){
					e.target.parentElement.click();
				}else{
					selectActiveForIndex(e.target.getAttribute('data-index'));
				}
			});

			div_actives.append(div_active);
		}

		div_waiting_actives.classList.add('d-none')
		div_waiting_actives_minimized.classList.add('d-none')
		div_action_buttons.classList.remove('d-none')
		div_action_buttons_minimized.classList.remove('d-none')

		asset_information = true;

		if(asset_selected){
			btn_higher.disabled = false;
			btn_higher_minimized.disabled = false;
			btn_lower.disabled = false;
			btn_lower_minimized.disabled = false;

			btn_higher.classList.remove('disabled');
			btn_higher_minimized.classList.remove('disabled');
			btn_lower.classList.remove('disabled');
			btn_lower_minimized.classList.remove('disabled');
		}else{
			port.postMessage({name:"update_trading_params", data:{current_active:null}});
		}
	}

	if(data.last_operation){
		setDataLastOperation(data.last_operation);
	}
}

function setDataLastOperation(data){

	let date_utc = new Date(parseInt(data.expiration_time+"000"));

	const year = date_utc.getFullYear();
	const montn = date_utc.getMonth();
	const day = date_utc.getDate();
	const hour = date_utc.getHours();
	const minute = date_utc.getMinutes();
	const second = date_utc.getSeconds();

	expiration = new Date(Date.UTC(year, montn, day, hour, minute, second));

	expiration_last_operation.innerHTML = expiration.getHours()+':'+expiration.getMinutes();
	img_last_operation.src = data.image;
	//La ultima operación fue al alza
	if(data.direction == 1){
		direction_last_operation_down.classList.add('d-none');
		direction_last_operation_up.classList.remove('d-none');
	}else{
		direction_last_operation_up.classList.add('d-none');
		direction_last_operation_down.classList.remove('d-none');
	}

	win_last_operation.innerHTML = data.win;
	lose_last_operation.innerHTML = data.lose;
	equal_last_operation.innerHTML = data.equal;
}

/**
 * Selecciona un activo de acuerdo al indice enviado
 */
function selectActiveForIndex(index){
	let elm = document.getElementsByClassName('item-active')[index];

	if(elm){
		//Identificador del activo
		let id_active = elm.getAttribute('data-active');

		//Se actualiza el activo
		port.postMessage({name:"update_trading_params", data:{current_active:id_active}});

		asset_selected = true;
		btn_higher.disabled = false;
		btn_higher_minimized.disabled = false;
		btn_lower.disabled = false;
		btn_lower_minimized.disabled = false;

		btn_higher.classList.remove('disabled');
		btn_higher_minimized.classList.remove('disabled');
		btn_lower.classList.remove('disabled');
		btn_lower_minimized.classList.remove('disabled');

		//Todos los activos de la pantalla
		elm_actives = document.getElementsByClassName('item-active');

		for(let i = 0; i < elm_actives.length; i++){
			elm_actives[i].classList.remove('bg-warning');
		}

		elm.classList.add('bg-warning');

		requestSyncDataTrading();
	}
}

function evaluateKeyDownBody(e){
	//Ctrl
	if(!e.altKey && e.ctrlKey && !e.shiftKey){
		//Start option up
		if(e.key == "ArrowUp"){
			btn_higher.click();
		}else if(e.key == "ArrowDown"){
			btn_lower.click();
		}
		amount.blur();
	//Ctrl + Shift
	}else if(!e.altKey && e.ctrlKey && e.shiftKey){
		amount.blur();
		//Start on my acount
		if(e.key == "ArrowUp" || e.key == "ArrowRight"){
			start_my_account.checked = true;
			port.postMessage({name:"update_trading_params", data:{start_my_account:true}});
		}else if(e.key == "ArrowDown" || e.key == "ArrowLeft"){
			start_my_account.checked = false;
			port.postMessage({name:"update_trading_params", data:{start_my_account:false}});
		}

	//Shift
	}else if(!e.altKey && !e.ctrlKey && e.shiftKey){
		let value = parseFloat(amount.value);
		if(e.key == "A"){
			amount.focus();
		}else{
			amount.blur();
			if(e.key == "ArrowUp"){
				value += 1;
			}else if(e.key == "ArrowRight"){
				value += 0.5;
			}else if(e.key == "ArrowDown"){
				value -= 1;
			}else if(e.key == "ArrowLeft"){
				value -= 0.5;
			}
		}

		if(value >= 1){
			if(!Number.isInteger(value)){
				let decimals = (value - Math.trunc(value)).toString().split('0.')[1];
				//Si tiene más de un decimal
				if(decimals.length > 1){
					if(decimals[1] != 0){
						value = parseFloat(value.toFixed(2));
					}else{
						value = parseFloat(value.toFixed(1));
					}
				}

			}

			amount.value = value;
			text_amount_min.innerHTML = value;
			port.postMessage({name:"update_trading_params", data:{amount:value}});
		}
	//alt_shift
	}else if(e.altKey && !e.ctrlKey && e.shiftKey){
		amount.blur();
		e.preventDefault();
		let value = parseFloat(range_expiration.value);
		if(e.key == "ArrowUp" || e.key == "ArrowRight"){
			value += 1;
		}else if(e.key == "ArrowDown" || e.key == "ArrowLeft"){
			value -= 1;
		}

		if(value >= 1 && value <= 5){
			range_expiration.value = value;
			port.postMessage({name:"update_trading_params", data:{range_expiration:value}});
			text_expiration.innerHTML = value;
			text_expiration_min.innerHTML = value;
		}
	//alt
	}else if(e.altKey && !e.ctrlKey && !e.shiftKey){
		amount.blur();
		e.preventDefault();
		let value = parseFloat(range_increase.value);
		if(e.key == "ArrowUp"){
			value += 1;
		}else if(e.key == "ArrowRight"){
			value += 0.5;
		}else if(e.key == "ArrowDown"){
			value -= 1;
		}else if(e.key == "ArrowLeft"){
			value -= 0.5;
		}

		if(value >= 1 && value <= 5){
			range_increase.value = value;
			port.postMessage({name:"update_trading_params", data:{range_increase:value}});
			text_increase.innerHTML = value;
			text_increase_min.innerHTML = value;
		}
	}
}