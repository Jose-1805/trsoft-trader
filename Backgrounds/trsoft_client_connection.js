//Servidor de TrSoft
let server_url = 'https://www.trsoft-company.com/api/';
//let server_url = 'https://trsoft-company.uc.r.appspot.com/api/';
//Usuarios con los que se realizan las operaciones
let users_copy_binary = {};
//Cantidad de usuarios que han logrado establecer una conexión web socket con IqOption
let users_connected = 0;
//Información de los usuarios consultada en el broker
let broker_users_data = {};
//Información de los activos disponibles para cada ususario
let broker_actives_data = {};
//Conexiones websocket de cada usuario al broker
let websockets = {};
//Identificadores de intervalo encargado de la sincronización de
//la información de los activos
//let ids_interval = {};
let id_interval_sync = null;
//Operaciones realizadas por cada usuario. Se almacena cada entrada 
//cuando se envía y se elimina cuando se confirma que se ejecutó
let operations = {};
//Operaciones abiertas para casa usuario
let current_operations = {};
let users_expirations = {};

/**
 * Obtiene los usuarios que pueden conectarse para el producto copy binary
 */
function getUsersForCopyBinary(callback = null) {
    //console.log('Obteniendo usuarios...');
	fetch(server_url+'clients-for-start-copy-binary', {method:'POST'}).then((res) => {
		if(res.status == 200){
			res.json().then((data) => {
				users_copy_binary = data;

                if(typeof callback == 'function')
                    callback();
			});
		}
	})
}

/**
 * Actualiza los usuarios que deben estar conectados al sistema
 */
function syncUsersForCopyBinary() {
    fetch(server_url+'clients-for-start-copy-binary', {method:'POST'}).then((res) => {
        if(res.status == 200){
            res.json().then((data) => {
                //Los usuarios antiguos que no esten en
                //la nueva lsita son desconectados
                for(key in users_copy_binary){
                    if(!data[key]){
                        disconnectUserConnectedToIqoption(key);
                    }
                }

                new_users = false;

                //Si se encuentran nuevos usuarios disponibles 
                //se le informa al trader para que reinicie la conexión
                counter = 0;
                for(key in data){
                    if(!users_copy_binary[key]){
                        new_users = true;
                        counter++;
                    }
                }

                users_copy_binary = data;

                if(new_users){
                    alert(counter+' nuevo(s) cliente(s) disponible(s) para conectarse a la sesión de trading. Para añadirlo(s) debe cerrar la sesiòn de trading actual e iniciar una nueva.');
                }
                //No se conectan los nuevos usuarios a la sesiòn de trading
                //porque el sistema no lo permite
                //connectUsersToIqOption();
            });
        }
    })
}

/**
 * Conecta los usuarios al websocket de IqOption
 */
function connectUsersToIqOption(callback = null) {
    //console.log('Conectando usuarios a IqOption...');
	for(key in users_copy_binary){
		connectUserToIqOption(key);
	}	

    if(typeof callback == 'function')
        callback();
}

/**
 * Conecta un usuario al websocket de IqOption
 */
function connectUserToIqOption(key) {
	//Si no se encuentra conectado
	if(!websockets[key]){
		websockets[key] = null;

		(websockets[key] = new WebSocket("wss://iqoption.com/echo/websocket")).onopen = function(e) {
	        websockets[e.target.user_id].send('{"name":"ssid","msg":"'+users_copy_binary[e.target.user_id].ssid+'"}');
	        fetch(server_url+"start-trading/"+e.target.user_id);
            users_connected++;
            
            //Actualiza el porcentaje de clientes conectados
            chrome.storage.sync.set({
                percentage_clients_connected: parseFloat((users_connected * 100)/Object.keys(users_copy_binary).length).toFixed(2)
            })

	        //Cada 15 segundos se sincronizan los datos 
	        //de los activos disponibles para el usuario
        	/*ids_interval[e.target.user_id] = setInterval(() => {
        		if(websockets[e.target.user_id]){
	        		requestSyncDataBrokerForUser(e.target.user_id);
	        	}else{
	        		//Si no existe el websocket pero 
	        		//si hay un identificador de intervalo
	        		if(ids_interval[e.target.user_id]){
	        			clearInterval(ids_interval[e.target.user_id]);
	        			delete ids_interval[e.target.user_id];
	        		}
	        	}
        	}, 15000);*/
	    }

        //Se relaciona el websocket con el usuario
        websockets[key].user_id = key;
		    
	    websockets[key].onmessage = function(e) {
        	if(e.data){
                let data = JSON.parse(e.data);
                //Se reciben datos de los activos
                if(data.name == 'api_option_init_all_result'){
                    if(data.msg.isSuccessful){
                        let actives = {};
                        //Se recorren todos los activos turbo
                        for(var i in data.msg.result.turbo.actives){
                            //Si el activo esta habilitado
                            if(data.msg.result.turbo.actives[i].enabled){
                                //Se agrega el activo
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

                       	broker_actives_data[e.target.user_id] = actives;
                    }
                }else if(data.name == "profile"){//Se obtienen datos del usuario desde el broker
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
                    broker_users_data[e.target.user_id] = data_user;
                }else if(data.name == "socket-option-opened"){//Una operación se inició
                    //Si existen operaciones registradas para el usuario
                    if(operations[e.target.user_id]){
                        let data_server = null;
                        let index_data = null;
                        let data_operation = null;

                        //Se recorren todas las operaciones registradas para el usuario
                        for(var i = 0; i < operations[e.target.user_id].length; i++){
                            //Si la operación del indice actual corresponde
                            //a la operación de los datos de evento enviados
                            if(
                                //Mismo activo
                                operations[e.target.user_id][i].active_id == data.msg.active_id
                                //Misma fecha de expiración
                                && operations[e.target.user_id][i].expiration_time == data.msg.expired
                                //Misma dirección
                                && (
                                    (
                                        operations[e.target.user_id][i].direction == 1
                                        && data.msg.dir == 'call'
                                    )
                                    || (
                                        operations[e.target.user_id][i].direction == -1
                                        && data.msg.dir == 'put'
                                    )
                                )
                            ){
                                data_server = operations[e.target.user_id][i];
                                data_operation = {
                                    amount: operations[e.target.user_id][i].amount,
                                    profit_percentage: operations[e.target.user_id][i].profit_percentage,
                                };
                                //Se almcena el indice para eliminar el elemento más adelante
                                index_data = i;
                                break;
                            }
                        }

                        //Si se encontró la operación en el la lista de operaciones del usuario
                        if(data_server){
                            data_server.user_id = e.target.user_id;
                            data_server.option_broker_id = data.msg.id;
                            data_operation.option_broker_id = data.msg.id;
                            data_server.expiration_time = data_server.expiration_time_utc;
                            //Nivel donde abrió la operación
                            data_server.level = data.msg.value;

                            //Se envían los datos al servidor
                            fetch(server_url+"option-client", {
                                method: 'POST',
                                body: JSON.stringify(data_server),
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json'
                                },
                            })

                            if(!current_operations[e.target.user_id]){
                            	current_operations[e.target.user_id] = [];
                            }
                   			//Se agrega la operación a la lista de operaciones actuales
                            current_operations[e.target.user_id].push(data_operation);

                            /*if(!(e.target.user_id in users_expirations))
                                users_expirations[e.target.user_id] = {};

                            if(!(data.msg.active_id in users_expirations[e.target.user_id]))
                                users_expirations[e.target.user_id][data.msg.active_id] = {};

                            users_expirations[e.target.user_id][data.msg.active_id][data.msg.expired] = true;*/

                            //Se borra el registro de operations debido a que solo se utiliza
                            //para identificar cuando una nueva operación ha sido realizada enviada
                            //desde el computador actual. Así si llega una nueva operación identica
                            //a la actual no se tiene en cuenta porque ya ha sido eliminada del registro
                            operations[e.target.user_id].splice(index_data,1);
                        }
                    }
                }else if(data.name == "socket-option-closed"){//Una operación ha cerrado
                    //Datos para enviar al servidor
                    let params_server = {
                        user_id: e.target.user_id,
                        option_broker_id: data.msg.id,
                        result: data.msg.win == 'loose'?-1:(data.msg.win == 'win'?1:0),
                        is_demo:data.msg.is_demo?1:-1
                    }

                    //Se envían los datos al servidor
                    fetch(server_url+"update-option-client", {
                        method: 'POST',
                        body: JSON.stringify(params_server),
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                    });   

                    //Se busca la operación en las operaciones actuales
                    if(current_operations[e.target.user_id]){
                        //Se recorren todas las operaciones actuales
                        for(var i = 0; i < current_operations[e.target.user_id].length; i++){
                            if(current_operations[e.target.user_id][i].option_broker_id == data.msg.id){

                                if(
                                    e.target.user_id in users_expirations
                                    && data.msg.active_id in users_expirations[e.target.user_id]
                                    && current_operations[e.target.user_id][i].expiration_time in users_expirations[e.target.user_id][data.msg.active_id]
                                    //&& current_operations[e.target.user_id][i].expiration_time in users_expirations[e.target.user_id]
                                ){
                                    delete users_expirations[e.target.user_id][data.msg.active_id][current_operations[e.target.user_id][i].expiration_time];
                                    //delete users_expirations[e.target.user_id][current_operations[e.target.user_id][i].expiration_time];
                                }

                                if(e.target.user_id in users_copy_binary){
                                    //Se debe adicionar la ganancias
                                    users_copy_binary[e.target.user_id].current_balance += parseFloat(data.msg.profit_amount);
                                }
                                //users_copy_binary[key].current_balance -= data.msg;
                                current_operations[e.target.user_id].splice(i,1);
                                break;
                            }
                        }

                    }         
                }else if(data.name == "option-rejected" && data.msg.reason == "no_money"){
                    //console.log('Session closed due to insufficient balance in your account --- '+e.target.user_id);
                }else if(data.name == "history-positions"){
                    if(data.msg.positions.length && data.msg.positions[0].instrument_type == "turbo-option"){
                        if(broker_users_data[e.target.user_id])
                            broker_users_data[e.target.user_id].history_operations = data.msg.positions;
                    }
                }else if(data.name != "timeSync" && data.name != "heartbeat"){
                    //console.log(data.name, data);
                }
            }
	    }

	    websockets[key].onerror = function(e) {
	        //console.log("ERROR CONECTANDO USUARIO: "+ e.target.user_id)
	    }
	}
}

/**
 * Desconecta a un usuario del websocket
 */
function disconnectUserConnectedToIqoption(user_id, callback = null) {
	//Si se encuentra conectado
	if(websockets[user_id]){
        //Si el usuario no tiene una operaciones abiertas
        if(!current_operations[user_id] || (current_operations[user_id] && current_operations[user_id].length == 0)){
    		websockets[user_id].close();

            setTimeout(function(){
                users_connected--;
                delete websockets[user_id];
                delete broker_users_data[user_id];
                delete broker_actives_data[user_id];
                delete users_copy_binary[user_id];
                fetch(server_url+"stop-trading/"+user_id);  

                if(typeof callback == 'function')
                    callback();
            }, 1000);
        }
	}
}

/**
 * Desconecta a todos los usuarios conectados al websocket de iq option
 */
function disconnectUsersConnectedToIqoption() {
    let total_data = Object.keys(users_copy_binary).length;
	for(key in websockets){
		disconnectUserConnectedToIqoption(key, () => {            
            //Actualiza el porcentaje de clientes conectados
            chrome.storage.sync.set({
                percentage_clients_connected: parseFloat((users_connected * 100)/total_data).toFixed(2)
            })
        });
	}	
}

/**
 * Solicita información de los activos para cada usuario 
 */
function requestSyncDataBrokerForUsers(){
    for(key in users_copy_binary){
        requestSyncDataBrokerForUser(key);
    }
}

/**
 * Solicita información de los activos para sincronizarlos 
 * con los datos almacenados localmente
 */
function requestSyncDataBrokerForUser(user_id){
    if(websockets[user_id]){
        //console.log('SOLICITANDO ACTUALIZACION');
        websockets[user_id].send('{"msg":"","name":"api_option_init_all"}');
    }
}

function startOperation(data) {
	for(key in websockets){
		if(broker_actives_data[key]){
			let active = broker_actives_data[key][data.active_id];
			//Existe el activo seleccionado por el trader
			if(active && active.enabled && key in users_copy_binary){
                if(
                    //SI el usuario no tiene operaciones abiertas 
                    !current_operations[key] 
                    || (
                        //O si tiene menos de 5 operaciones abiertas
                        (current_operations[key] && current_operations[key].length < 5)
                        //Y ningúna de las operaciones abiertas de la divisa actual
                        //tiene la misma expiración
                        && (
                            !(key in users_expirations)//No hay registros de expiraciones
                            || !(data.active_id in users_expirations[key])//No hay expiraciones para la divisa
                            || !(data.expiration in users_expirations[key][data.active_id])//No hay expiraciones iguales en la divisa
                            //|| !(data.expiration in users_expirations[key])//No hay expiraciones iguales
                        )
                    )

                ){


    			    let profit_percent = 100 - active.option.profit.commission;
    			    let amount_send = parseFloat(users_copy_binary[key].amount);
    			    //Si permite el incremento del importe
    			    if(users_copy_binary[key].allow_increment == 1){
    			        amount_send *= parseFloat(data.increase);
    			    }

                    stop_loss_reached = false;
                    if(users_copy_binary[key].stop_loss == 1){
                        //Limite de perdida, inicialmente se es (stop_loss_value * -1)
                        //para establecer el limite de un stop loss no dinamico
                        limit_balance = (users_copy_binary[key].stop_loss_value?users_copy_binary[key].stop_loss_value:0) * -1;

                        //Si el stop loss es dinamico se corre el limite actual
                        //hasta estar al limite del valor más alto alcanzado en el saldo
                        if(users_copy_binary[key].dynamic_stop_loss == 1)
                            limit_balance += users_copy_binary[key].higher_balance;


                        //El stop loss es sobrepasado con la operación actual
                        if((users_copy_binary[key].current_balance - amount_send) < limit_balance)
                            stop_loss_reached = true;

                        //Si el stop loss es sobrepasado con la operación actual pero el valor
                        //de la operación se puede reducir 
                        if(stop_loss_reached && data.increase > 1){
                            amount_send = parseFloat(users_copy_binary[key].amount);
                            //El stop loss NO sobrepasado con la operación minima
                            if((users_copy_binary[key].current_balance - amount_send) >= limit_balance)
                                stop_loss_reached = false;
                        }
                    }

                    if(!stop_loss_reached){    			  	
    			        websockets[key].send('{"name":"sendMessage","msg":{"name":"binary-options.open-option","version":"1.0","body":{"user_balance_id":'+broker_users_data[key][users_copy_binary[key].use_practice_account == 1?'balance_practice_id':'balance_real_id']+',"active_id":'+active.id+',"option_type_id":3,"direction":"'+data.direction+'","expired":'+data.expiration+',"refund_value":0,"price":'+amount_send+',"value":0,"profit_percent":'+profit_percent+'}}}');
                        if(!(key in users_expirations))
                            users_expirations[key] = {};

                        if(!(data.active_id in users_expirations[key]))
                            users_expirations[key][data.active_id] = {};

                        users_expirations[key][data.active_id][data.expiration] = true;
                        //users_expirations[key][data.expiration] = true;

                        //Se actualiza el saldo
                        users_copy_binary[key].current_balance -= amount_send;

    			        let params_server = {
    			            active_id: active.id,
    			            active_name: active.description.split('.')[1],
    			            active_image: "https://static.cdnpub.info/files"+active.image,
    			            expiration_time: data.expiration,
    			            expiration_time_utc: data.expiration_utc,
    			            direction:data.direction == 'call'?1:-1,
    			            amount:amount_send,
    			            profit_percentage:profit_percent,
    			            trader:data.trader
    			        }

    			        if(!operations[key]){
    			        	operations[key] = [];
    			        }

    			        operations[key].push(params_server);
                    }else{
                        //Si se alcanza el stop loss, la conexión se cierra para el usuario
                        //Si el usuario no tiene una operaciones abiertas
                        if(!current_operations[key] || (current_operations[key] && current_operations[key].length == 0)){
                            disconnectUserConnectedToIqoption(key);
                        }
                        //console.log('Stop loss alcanzado para: '+key);
                    }
                }
			} 
		}
	}

    //Dos segundos despuès se solicita la actualizaciòn de datos
    //de usuario para tener los datos de cada uno actualizados
    setTimeout(() => {
        syncUsersForCopyBinary();
    }, 2000);
}

function startSessionTrading(callback){
    //console.log('Iniciando la sesión de trading...');
    getUsersForCopyBinary(() => {
        connectUsersToIqOption(() => {
            users_connected = 0;
            //console.log('Sesión de trading iniciada')
            
            //Cada 15 segundos se solicita la actualizan de datos 
            //de activos para cada usuario
            id_interval_sync = setInterval(() => {
                requestSyncDataBrokerForUsers();
                syncUsersForCopyBinary();
            }, 15000);

            chrome.storage.sync.set({connected_clients:true}, () => {
                if(typeof callback == 'function')
                    callback();
            })            
        })
    })   
}

function endSessionTrading(callback) {
    //console.log('Finalizando la sesión de trading...');
    disconnectUsersConnectedToIqoption();
    //console.log('Sesión de trading finalizada')
    
    if(id_interval_sync){
        clearInterval(id_interval_sync);
    }

    chrome.storage.sync.set({connected_clients:false}, () => {
        if(typeof callback == 'function')
            callback();
    }) 
}

function getHistoryOperations(limit = 10){
    for(key in websockets){
        websockets[key].send('{"name":"sendMessage","msg":{"name":"portfolio.get-history-positions","version":"1.0","body":{"user_id":'+broker_users_data[key].id+',"user_balance_id":'+broker_users_data[key][users_copy_binary[key].use_practice_account == 1?'balance_practice_id':'balance_real_id']+',"instrument_types":["turbo-option","binary-option"],"offset":0,"limit":'+limit+'}}}')
    }
}

function printHistoryOperations(){
    for(key in broker_users_data){
        console.log(key, broker_users_data[key].history_operations);
    }   
}

//b45873b64a1a6d138514002e979e1229
//b8f6e45bed908e7725fea6790dde4c7b
//9dbd0960a4cfb4786e4c3d1b881e12ce
let ws = null;
function connectUser(ssid) {

    (ws = new WebSocket("wss://iqoption.com/echo/websocket")).onopen = function(e) {
        ws.send('{"name":"ssid","msg":"'+ssid+'"}');
    }
        
    ws.onmessage = function(e) {
        if(e.data){
            let data = JSON.parse(e.data);
            //Se reciben datos de los activos
            if(data.name == 'api_option_init_all_result'){
                if(data.msg.isSuccessful){
                    let actives = {};
                    //Se recorren todos los activos turbo
                    for(var i in data.msg.result.turbo.actives){
                        //Si el activo esta habilitado
                        if(data.msg.result.turbo.actives[i].enabled){
                            //Se agrega el activo
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

                    console.log('Activos cargados', actives);
                }
            }else if(data.name == "profile"){//Se obtienen datos del usuario desde el broker
                let data_user = data.msg;
                for(key in data_user.balances){
                    //Cuenta real
                    if(data_user.balances[key].type == 1){
                        data_user.balance_real_id = data_user.balances[key].id;
                    }
                    else if(data_user.balances[key].type == 4){
                        data_user.balance_practice_id = data_user.balances[key].id;
                    }
                }
                console.log('Datos del usuario', data_user);
            }else if(data.name == "socket-option-opened"){//Una operación se inició
                console.log('Nueva operación abierta', data.msg);
            }else if(data.name == "socket-option-closed"){//Una operación ha cerrado
                console.log('Operación cerrada', data.msg);
            }else if(data.name == "option-rejected"){
                console.log('Operación rechazada', data.msg);
            }else if(data.name == "history-positions"){
                console.log('Operaciones realizadas', data.msg);
            }else if(data.name != "timeSync" && data.name != "heartbeat"){
                console.log(data.name, data);
            }
        }
    }

    ws.onerror = function(e) {
        console.log("ERROR CONECTANDO AL USUARIO")
    }
}

function disconnectUser(){
    if(ws)ws.close();
}