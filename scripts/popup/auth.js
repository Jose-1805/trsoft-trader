let btn_submit_login = document.getElementById('btn_submit_login');
let btn_logout = document.getElementById('btn_logout');
let btn_loading = document.getElementById('btn_loading');
let email_field = document.getElementById('email');
let password_field = document.getElementById('password');
let form_login_user = document.getElementById('form_login_user');

let email = "";
let password = "";

form_login_user.onkeyup = function(e){
	if(e.keyCode == 13){
		btn_submit_login.click();
	}
}

email_field.onchange = function(e){
	email = e.target.value;
}

password_field.onchange = function(e){
	password = e.target.value;
}

//Intento de autenticación en CTrading
btn_submit_login.onclick = function(e){
	if(email && password){
		btn_submit_login.classList.add('d-none');
		btn_loading.classList.remove('d-none');

		chrome.extension.getBackgroundPage().auth(email, password, () => {
			showView();
			btn_submit_login.classList.remove('d-none');
			btn_loading.classList.add('d-none');	
		}, (data) => {
			switch (data.error) {
				case "server_error":
					alert('Error del servidor, intente más tarde. (#login1)');
					break;
				case "invalid_credentials":
					alert('La autenticación falló, verifique sus datos de acceso.');
					break;
				case "invalid_user":
					alert('Usuario no permitido.');
					break;
				case "user_inactive":
					alert('Su cuenta de usuario se encuentra incativa.');
					break;
				default:
					// statements_def
					break;

			}
			window.close();
		});
	}else{
		alert('Complete todos los datos de ingreso.');
	}
}

btn_logout.onclick = (e) => {
	chrome.extension.getBackgroundPage().logout(() => window.close());
}