//Dominio para conectarse al servidor
const domain_server = "https://www.trsoft-company.com";
//const domain_server = "https://trsoft-company.uc.r.appspot.com";
//const domain_server = "localhost:8000";

let id_interval_last_operation = null;

/**
 * Autentica al usuario
 */
function auth(username, password, callbackSuccess, callbackFail){
    return fetch(domain_server+"/api/login", {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
            username:username,
            userpassword:password,
            remember:true
        })
    }).then(function (res){
        if(res.status == 200){
            res.json().then((data) => {
                //El  inicio de fue exitoso
                if(data.login == 'success'){
                    chrome.storage.sync.set({"user_server":data.user}, () => {
                        if(data.user.is_trader){
                            if(!data.user.is_active){
                                //El usuario no está activo
                                logout(() => {
                                    if(typeof callbackFail == 'function')
                                        callbackFail({error:"user_inactive"});
                                });
                            }else{
                                if(typeof callbackSuccess == 'function'){
                                    chrome.storage.sync.set({c_trading_authenticated:true}, () => {
                                        setLastOperation();
                                        id_interval_last_operation = setInterval(function(){
                                            setLastOperation();
                                        }, 60000)
                                        callbackSuccess();
                                    });
                                }
                            }
                        }else{
                            //El usuario no es un trader
                            logout(() => {
                                if(typeof callbackFail == 'function')
                                    callbackFail({error:"invalid_user"});
                            });
                        }
                    })
                }else{
                    logout(() => {
                        if(typeof callbackFail == 'function')
                            callbackFail({error:"invalid_credentials"});
                    });
                }
            })    
        }else{
            logout(() => {
                if(typeof callbackFail == 'function')
                    callbackFail({error:"server_error"});
            });
        }
        
        //return res.json();
    });
}

/**
 * Actualiza los datos del usuario desde el servidor
 */
function setUserServer(callback = null){
    return fetch(domain_server+"/api/user", {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
    }).then(function (res){
        //Si se optienen los datos del usuario
        if(res.status == 200){
            res.json().then((data) => {
                chrome.storage.sync.set({user_server:data}, () => {
                    if(typeof callback == "function")
                        callback(res);
                });
            })
        }else{
            if(typeof callback == "function")
                callback(res);
        }
    });  
}

function setLastOperation(){
    return fetch(domain_server+"/api/last-operation", {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
    }).then(function (res){
        //Si se optienen los datos del usuario
        if(res.status == 200){
            res.json().then((data) => {
                chrome.storage.sync.set({last_operation:data}, () => {
                    //Se actualiza la información en la vista de trading
                    if(port){
                        chrome.storage.sync.get(null, (new_data) => {
                            port.postMessage({name:'sync_data_trading', data:new_data})
                        });
                    }
                });
            })
        }
    });  
}

/**
 * Cierra la sesión del usuario
 */
function logout(callback = null){
    echo = null;
    chrome.storage.sync.set({c_trading_authenticated:false, connected_clients:false, user_broker:null, user_server: null, trading_is_running: false, actives: null}, () => {
        clearInterval(id_interval_last_operation);
        endSessionTrading();
        fetch(domain_server+"/api/logout", {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                method: 'POST'
            }).then(() => {
                if(typeof callback == 'function')
                    callback();
            });
    });
}