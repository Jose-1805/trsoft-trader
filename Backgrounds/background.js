//Puerto para coneción con scripts_content
let port = null;
let id_interval_logout = null;
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({trading_is_running: false, connected_clients:false, percentage_clients_connected:0});

    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
      chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {hostEquals: 'iqoption.com'},
        })
        ],
            actions: [new chrome.declarativeContent.ShowPageAction()]
      }]);
    });
});

chrome.runtime.onConnect.addListener(function(port_) {
    port = port_;
    port.onMessage.addListener(function(msg) {
        switch (msg.name) {
            case "start_option":
                requestStartOption(msg.data.direction);
                break;
            case "update_trading_params":
                chrome.storage.sync.set(msg.data);
                break;
            case "request_sync_data_trading":
                chrome.storage.sync.get(null, (data) => {
                    port.postMessage({name:'sync_data_trading', data})
                });
                break;
            default:
                break;
        }
    });
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
        if(request.data.name == 'start_option'){
            requestStartOptionExternal(request.data.params);
        }
    }
);

/**
 * Solicitud para iniciar una entrada
 * @param  {String} direction [Dirección de entrada]
 */
function requestStartOptionExternal(params){
    chrome.storage.sync.get(null, (data) => {
        if(data.actives && data.user_broker && data.user_server){
            let active = data.actives[params.active];
            //Existe el activo seleccionado
            if(active && active.enabled){
                var date = new Date();
                date.setTime(params.expiration);

                params.expiration = params.expiration.toString().substr(0,10);

                let date_utc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());

                let expiration_time_utc = date_utc.getTime().toString().substr(0,10);

                //Se envian las operaciones de los clientes
                startOperation({
                    active_id:active.id,
                    direction:params.direction,
                    expiration:params.expiration,
                    expiration_utc:expiration_time_utc,
                    increase:1,
                    trader:data.user_server.id
                })

                //Usuario en null para no peritir mas entradas con los datos actules
                chrome.storage.sync.set({user_server:null, open_options:data.open_options?(data.open_options + 1):1}, () => {
                    let params_server = {
                        active_id: active.id,
                        active_name: active.description.split('.')[1],
                        active_image: "https://static.cdnpub.info/files"+active.image,
                        expiration_time: expiration_time_utc,
                        direction:params.direction == 'call'?1:-1
                    }

                    //Se envían los datos al servidor
                    fetch(domain_server+"/api/option-trader", {
                        method: 'POST',
                        body: JSON.stringify(params_server),
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                    })

                    //Se actualiza la información en la vista de trading
                    if(port)
                        chrome.storage.sync.get(null, (new_data) => {
                            port.postMessage({name:'sync_data_trading', data:new_data})
                        });


                    //Si se han alacenado datos de cierre de opción con la fecha de la opción actual
                    if('times_close' in data && ('_'+params.expiration_time) in data.times_close){
                        let times_close = data.times_close;
                        times_close['_'+params.expiration_time] = times_close['_'+params.expiration_time] + 1;

                        chrome.storage.sync.set({times_close});
                    }else{//No hay datos de cierre de opción y se crean
                        let times_close = 'times_close' in data?data.times_close:{};
                        times_close['_'+params.expiration_time] = 1;
                        chrome.storage.sync.set({times_close});
                        
                        let close_options = (seconds_to_close_, times_close_key) => {
                            //Al cerrar la opción se disminuye la cantidad de opciones que cierran en un segundo dado
                            setTimeout(() => {
                                chrome.storage.sync.get(null, (data_) => {
                                    if(data_.times_close && data_.times_close[times_close_key]){
                                        let new_open_options = data_.open_options - data_.times_close[times_close_key];
                                        //let new_times_close = data_.times_close;
                                        //new_times_close[times_close_key] = null;

                                        chrome.storage.sync.set({open_options:new_open_options}, () => {
                                            //Se actualiza la ifnromación en la vista de trading
                                            if(port)
                                                chrome.storage.sync.get(null, (new_data_) => {
                                                    port.postMessage({name:'sync_data_trading', data:new_data_})
                                                });
                                        });
                                    }
                                })

                                //Dos segundos despuès se solicita la actualizaciòn de datos
                                //de usuario por si se ha llegado a stop loss nuevos
                                //Y también se actualiza la ultima operación
                                setTimeout(() => {
                                    syncUsersForCopyBinary();
                                    setLastOperation();
                                }, 2000)

                            }, (seconds_to_close_ * 1000))
                        }


                        let seconds_to_close = Math.abs((params.expiration - new Date().getTime())/1000);

                        close_options(seconds_to_close, '_'+params.expiration)
                    }

                    //Se actualizan datos de usuario
                    setUserServer(); 
                });
            }
        }
    })
}

function getSSID(callback){
	return chrome.cookies.get({
        url: "https://iqoption.com",
        name: "ssid"
    }, callback)
}

function stopTrading(callback){
	chrome.storage.sync.set({trading_is_running: false, actives: null, current_active: null}, function() {
      	closeBrokerConnection();
        endSessionTrading();

        id_interval_logout = setInterval(function(){
            chrome.storage.sync.get('percentage_clients_connected', function(data){
                if(data.percentage_clients_connected == 0){
                    clearInterval(id_interval_logout);
                    logout();

                    if(typeof callback == 'function')
                        callback();
                }
            })
        }, 500)
        
        port.postMessage({name:'stop_view_controls_trading'})
    });			
}

/**
 * Inicia trading en el sistema
 */
function startTrading(callbackSuccess, callbackFail){

	chrome.storage.sync.get(["trading_is_running", "connected_clients"], (data) => {
        //SI port es null se deber recargar la página
        if(!port){
            alert('Error de conexión entre componentes. Recargue la página del navegador (#port1)');
            if(typeof callbackFail == 'function')
                callbackFail();
        }else{
            //Si aun no está corriendo trading y los cleintes ya están conectados
            if(!data.trading_is_running && data.connected_clients){
                setUserBroker((data) => {
                    if(data.status == 401){
                        callbackFail();
                    }else{
                        //Se establece la conexion con el broker
                        openBrokerConnection(() => {
                                //Si la conexion se establece                        
                                chrome.storage.sync.set({trading_is_running:true, open_options:0, times_close: {}}, () => {
                                    port.postMessage({name:'start_view_controls_trading'})
                                    if(typeof callbackSuccess == 'function')
                                        callbackSuccess();
                                })
                            }, (e) => {
                                //Error al esablecer la conexión con el broker
                                if(typeof callbackFail == 'function')
                                    callbackFail(e);
                            }
                        );
                    }
                })
            }
        }
    });
}

/**
 * Envia mensaje al content script para que muestre la vista de controles de trading
 * @return {[type]} [description]
 */
function showControlsTrading(){
    chrome.storage.sync.get(["trading_is_running"], (data) => {
        if(data.trading_is_running && port){
            port.postMessage({name:'start_view_controls_trading'});
        }
    })
}

/**
 * Solicitud para iniciar una entrada
 * @param  {String} direction [Dirección de entrada]
 */
function requestStartOption(direction){
    chrome.storage.sync.get(null, (data) => {
        if(data.current_active && data.amount && data.actives && data.range_increase && data.user_broker && data.user_server && data.range_expiration){
            let active = data.actives[data.current_active];
            //Existe el activo seleccionado
            if(active && active.enabled){
                let expiration_data = getNextExpirationTime(data.range_expiration);
                let expiration_time = expiration_data.time;
                let expiration_time_utc = expiration_data.time_utc;

                //Si se establece realizar entradas en la cuenta del trader
                if(data.start_my_account){
                    let profit_percent = 100 - active.option.profit.commission;
                    ws.send('{"name":"sendMessage","msg":{"name":"binary-options.open-option","version":"1.0","body":{"user_balance_id":'+data.user_broker[data.practice_account?'balance_practice_id':'balance_real_id']+',"active_id":'+active.id+',"option_type_id":3,"direction":"'+direction+'","expired":'+expiration_time+',"refund_value":0,"price":'+data.amount+',"value":0,"profit_percent":'+profit_percent+'}}}');
                }
                
                //Se envian las operaciones de los clientes
                startOperation({
                    active_id:active.id,
                    direction,
                    expiration:expiration_time,
                    expiration_utc:expiration_time_utc,
                    increase:data.range_increase,
                    trader:data.user_server.id
                })

                //Usuario en null para no peritir mas entradas con los datos actules
                chrome.storage.sync.set({user_server:null, open_options:data.open_options?(data.open_options + 1):1}, () => {
                    let params_server = {
                        active_id: active.id,
                        active_name: active.description.split('.')[1],
                        active_image: "https://static.cdnpub.info/files"+active.image,
                        expiration_time: expiration_time_utc,
                        direction:direction == 'call'?1:-1
                    }

                    //Se envían los datos al servidor
                    fetch(domain_server+"/api/option-trader", {
                        method: 'POST',
                        body: JSON.stringify(params_server),
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                    })

                    //Se actualiza la información en la vista de trading
                    if(port)
                        chrome.storage.sync.get(null, (new_data) => {
                            port.postMessage({name:'sync_data_trading', data:new_data})
                        });


                    //Si se han alacenado datos de cierre de opción con la fecha de la opción actual
                    if('times_close' in data && ('_'+expiration_time) in data.times_close){
                        let times_close = data.times_close;
                        times_close['_'+expiration_time] = times_close['_'+expiration_time] + 1;

                        chrome.storage.sync.set({times_close});
                    }else{//No hay datos de cierre de opción y se crean
                        let times_close = 'times_close' in data?data.times_close:{};
                        times_close['_'+expiration_time] = 1;
                        chrome.storage.sync.set({times_close});
                        
                        let close_options = (seconds_to_close_, times_close_key) => {
                            //Al cerrar la opción se disminuye la cantidad de opciones que cierran en un segundo dado
                            setTimeout(() => {
                                chrome.storage.sync.get(null, (data_) => {
                                    if(data_.times_close && data_.times_close[times_close_key]){
                                        let new_open_options = data_.open_options - data_.times_close[times_close_key];
                                        //let new_times_close = data_.times_close;
                                        //new_times_close[times_close_key] = null;

                                        chrome.storage.sync.set({open_options:new_open_options}, () => {
                                            //Se actualiza la ifnromación en la vista de trading
                                            if(port)
                                                chrome.storage.sync.get(null, (new_data_) => {
                                                    port.postMessage({name:'sync_data_trading', data:new_data_})
                                                });
                                        });
                                    }
                                })

                                //Dos segundos despuès se solicita la actualizaciòn de datos
                                //de usuario por si se ha llegado a stop loss nuevos
                                //Y también se actualiza la ultima operación
                                setTimeout(() => {
                                    syncUsersForCopyBinary();
                                    setLastOperation();
                                }, 2000)

                            }, (seconds_to_close_ * 1000))
                        }


                        let seconds_to_close = Math.abs((expiration_data.date.getTime() - new Date().getTime())/1000);

                        close_options(seconds_to_close, '_'+expiration_time)
                    }

                    //Se actualizan datos de usuario
                    setUserServer(); 
                });
            }
        }
    })
}

/**
 * Retorna el time de espiración para los minutos recibidos como parametro
 * @param  {Integer} expiration [Cantidad de minutos]
 */
function getNextExpirationTime(expiration){
    var date = new Date();
    var add_minutes = parseInt(expiration) + 1;
    
    if(date.getSeconds() < 30){
        add_minutes -= 1;
    }

    date.setSeconds(0);
    date.setMinutes(date.getMinutes() + add_minutes);

    let date_utc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());

    return {
        date,
        time: date.getTime().toString().substr(0,10),
        time_utc: date_utc.getTime().toString().substr(0,10)
    }
}