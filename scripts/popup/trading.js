let btn_stop_trading = document.getElementById('btn_stop_trading');
let btn_show_controls_trading = document.getElementById('btn_show_controls_trading');

btn_stop_trading.onclick = () => {
	chrome.storage.sync.get(["trading_is_running"], (data) => {
		if(data.trading_is_running){
			chrome.extension.getBackgroundPage().stopTrading(() => {
				chrome.extension.getBackgroundPage().alert('La sesiòn de trading ha sido cerrada con éxito.');
				//showView();
				window.close();
			})
		}
	})
}

btn_show_controls_trading.onclick = () => {
	chrome.extension.getBackgroundPage().showControlsTrading();
}