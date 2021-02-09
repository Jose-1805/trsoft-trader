//Websocket de conección a broker
let ws = null;
//Dominio de conección a broker
const domain = "iqoption.com";

let ssid = null;

let id_interval = null;

/**
 * Establece una conexón websocket con el broker
 */
function openBrokerConnection(callbackSuccess, callbackFail) {
    (ws = new WebSocket("wss://" + domain + "/echo/websocket")).onopen = function() {

        ws.send('{"name":"ssid","msg":"'+ssid+'"}');
        if(typeof callbackSuccess == 'function')
        	callbackSuccess()

        let current_second = new Date().getSeconds();
        let seconds_to_start = 40;
    	let seconds_to_minute = 60 - current_second;
    	let start_in = 5;

    	if(seconds_to_minute < (60 - seconds_to_start))start_in = (seconds_to_minute + seconds_to_start)
    	else start_in = (seconds_to_minute - (60 - seconds_to_start));

    	start_in = (start_in >= 5)?start_in:(start_in + 60);

    	if(id_interval){
    		clearInterval(id_interval);
    	}

        setTimeout(() => {
        	id_interval = setInterval(() => {
        		if(ws){
	        		requestSyncDataBroker();
	        	}
        	}, 15000);
    	}, start_in * 1000);
    }
    
    ws.onclose = function(e) {
    	chrome.storage.sync.set({trading_is_running:false}, () => {
    		ws = null;
        })

    }
    
    ws.onmessage = function(e) {
        if(e.data){
            let data = JSON.parse(e.data);
        	if(data.name == 'api_option_init_all_result'){
                if(data.msg.isSuccessful){
                    //console.log('api_option_init_all_result', data.msg);
                    let actives = {};
                    for(var i in data.msg.result.turbo.actives){
                        if(data.msg.result.turbo.actives[i].enabled){

                            actives[data.msg.result.turbo.actives[i].id] = {
                                id: data.msg.result.turbo.actives[i].id,
                                image: data.msg.result.turbo.actives[i].image,
                                description: data.msg.result.turbo.actives[i].description,
                                enabled: data.msg.result.turbo.actives[i].enabled,
                                option:{
                                    profit:data.msg.result.turbo.actives[i].option.profit
                                    //bet_close_time:data.msg.result.turbo.actives[i].option.bet_close_time,
                                }
                            }
                        }
                    }

                    chrome.storage.sync.set({actives:actives}, () => {
                        chrome.storage.sync.get(null, (data) => {
                            if(port)
                                port.postMessage({name:'sync_data_trading', data})
                        })
                    });
                }
            }else if(data.name == "profile"){
                data_user = data.msg;
                for(key in data_user.balances){
                    //Cuenta real
                    if(data_user.balances[key].type == 1){
                        data_user.balance_real_id = data_user.balances[key].id;
                    }
                    else if(data_user.balances[key].type == 4){
                        data_user.balance_practice_id = data_user.balances[key].id;
                    }
                }

                chrome.storage.sync.set({user_broker:data_user});
            }else if(data.name = "option-rejected" && data.msg.reason == "no_money"){
                alert('Saldo insuficiente en su cuenta.');
            }else if(data.name != "timeSync" && data.name != "heartbeat"){
                //console.log(data.name, data);
            }
        }
    }
    
    ws.onerror = function(e) {
        console.log("ERROR EN WEBSOCKET: ", e)
    	if(typeof callbackFail == 'function')
        	callbackFail(e)
    }
}

/**
 * Cierra la conexión websocket con broker
 */
function closeBrokerConnection(){
	if(ws)
		ws.close();
}

/**
 * Solicita al broker los datos de las divisas
 */
function requestSyncDataBroker(){
    if(ws){
        ws.send('{"msg":"","name":"api_option_init_all"}');
    }
}

/**
 * Consulta los datos del cliente y los almacena en el storage
 */
function setUserBroker(callback){
    return fetch("https://"+domain+"/api/register/getregdata", {
        method: 'GET'
    }).then(function (res){
        //Usuario ya inició sesion en el broker
        if(res.status == 200){
            res.json().then((data) => {
                chrome.storage.sync.set({user_broker:data.result.profile}, () => {
	                chrome.extension.getBackgroundPage().getSSID(function(e){
				    	ssid = e.value;
	                    if(typeof callback == "function")
	                        callback(res);
				    });
                });
            })
        }else{
            if(typeof callback == "function")
                callback(res);
        }
    });
}

/**
 * Consulta si el usuario tiene una sesiòn activa en el broker
 */
function userLoginBroker(callback){
    return fetch("https://"+domain+"/api/register/getregdata", {
        method: 'GET'
    }).then(function (res){
        //Usuario ya inició sesion en el broker
        if(res.status == 200){
            callback(true);
        }else{
            callback(false);
        }
    });
}