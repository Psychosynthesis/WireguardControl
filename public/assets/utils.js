function makeRequest(makeRequestArguments) {
  var requestContentType = (typeof(makeRequestArguments.contentType) !== 'undefined') ? makeRequestArguments.contentType : 'application/json';
  var httpRequest = null;

  if (window.XMLHttpRequest) { // Mozilla, Safari, etc...
    httpRequest = new XMLHttpRequest();
  } else if (window.ActiveXObject) { // IE
    try { httpRequest = new ActiveXObject("Msxml2.XMLHTTP"); }
    catch (e) {
      try { httpRequest = new ActiveXObject("Microsoft.XMLHTTP"); }
      catch (e) { console.error(e); }
    }
  }
  if (!httpRequest) {
    console.error('Cannot create an XMLHTTP instance');
    return false;
  }

  if (makeRequestArguments.processHandlers) {
    var incorrectProcessInit =
      (typeof(makeRequestArguments.processHandlers.onprogress) !== 'function') ||
      (typeof(makeRequestArguments.processHandlers.onload) !== 'function') ||
      (typeof(makeRequestArguments.processHandlers.onerror) !== 'function');
    if (incorrectProcessInit) {
      console.log('Incorrect XMLHttpRequest process initialization');
    } else {
      httpRequest.upload.onprogress = makeRequestArguments.processHandlers.onprogress; // (event) => alert(`Отправлено ${event.loaded} из ${event.total} байт`)
      httpRequest.upload.onload = makeRequestArguments.processHandlers.onload;
      httpRequest.upload.onerror = makeRequestArguments.processHandlers.onerror; // () => alert(`Произошла ошибка во время отправки: ${httpRequest.status}`);
    }
  }

  function serveContent(){
    if (httpRequest.readyState === 4) {
      var responseStatus = parseInt(httpRequest.status, 10);
      if (responseStatus < 200 && responseStatus >= 400) {
				// Все штатные (через PHP) ответы сервера, даже с ошибкой, имеют код 200
				// Пробуем распарсить текст ошибки
				Toast('Server return error: ' + responseStatus);
				try {
					JSON.parse(httpRequest.responseText);
				} catch (parseErr) {
					console.error('Problem with the request. Request: ', httpRequest);
					console.log('MakeRequest arguments: ', makeRequestArguments);
					return;
				} // Если ошибка распарсилась, можно возвращать в штатный обработчик
      }

			if (typeof(makeRequestArguments.callback) === 'function') {
        var contentType = httpRequest.getResponseHeader('Content-Type');
        if (contentType && contentType.includes('application/json')) {
          makeRequestArguments.callback.call(makeRequestArguments.context, httpRequest.responseText);
        } else {
          makeRequestArguments.callback.call(makeRequestArguments.context, httpRequest);
        }
			} else {
				console.log('Request parse success, there is no callback in params. Received data: ', httpRequest);
			}
    }
  }

  httpRequest.onreadystatechange = serveContent;
  httpRequest.open(makeRequestArguments.type, makeRequestArguments.url, true);
  httpRequest.setRequestHeader('X-verification-code', 'HGJGRGSADF12342kjSJF3riuhfkds3');
	if (makeRequestArguments.token) { httpRequest.setRequestHeader('X-CSRF-TOKEN', makeRequestArguments.token); }
  if (!makeRequestArguments.setContentTypeByBrowser) { httpRequest.setRequestHeader('Content-Type', requestContentType); }
  if (makeRequestArguments.type === 'GET') { httpRequest.send(); }
  else { httpRequest.send(makeRequestArguments.data); }
}

function responseHandler(response) {
  var result = { success: false, data: null };
  var convertedResponse;
  if (typeof(response) === "string") {
		if (!response.length) {
			console.log('Response is empty.');
			return result;
		}
    try { convertedResponse = JSON.parse(response); }
    catch (parseErr) {
      console.log('Error in responseHandler on JSON.parse(response): ', parseErr);
      console.log('Response is: ', response);
    }
  } else if (response.hasOwnProperty('success')) {
    console.log('Seems like response is already encoded: ', response);
    convertedResponse = response;
  } else {
    console.log("Unknown type of response: ", response);
  }

  result.success = (typeof(convertedResponse) !== "string") && convertedResponse && !convertedResponse.errors;
  result.data = !result.success ? convertedResponse.errors : convertedResponse.data;
  return result;
}

function errorsHandler(errors) { // Используется для обработки ошибок приходящих на post-запросы
	var errorsInner = document.createElement('div');
	if (!errors) {
		console.error('В errorsHandler передана пустая ошибка.');
		errorsInner.innerText = 'Неизвестная ошибка';
		return errorsInner;
	}
	if (Array.isArray(errors)) {
		forEach(errors, function(oneErr){
			var newError = document.createElement('div');
			newError.innerText = oneErr;
			errorsInner.appendChild(newError);
		});
	} else {
		var errorsKeys = Object.keys(errors);
		forEach(errorsKeys, function(key){
			var newError = document.createElement('div');
			if (key === 'url') {
				var new_link = document.createElement('a');
				new_link.href = errors[key];
				new_link.innerText = errors[key];
				newError.innerText = key + ": ";
				newError.appendChild(new_link);
			} else {
				newError.innerText = key + ': ' + errors[key];
			}
			errorsInner.appendChild(newError);
		});
	}
	return errorsInner;
}

// Очень большой секрет
const secretPass = '\u0050\u0073\u0073\u0077\u006f\u0072\u0064';

const checkPass = () => {
  const getPass = prompt('Для управления Wireguard требуется ввести пароль', '');
  return obfusPa(getPass) === obfusPa(secretPass);
}

function jsonToHTML (json, level = 0) {
    let html = '';

    if (typeof json === 'object' && json !== null) {
        for (const key in json) {
            if (json.hasOwnProperty(key)) {
              let value = json[key];
              let valueHTML = '';

              if (typeof value === 'object' && value !== null) {
                valueHTML = jsonToHTML(value, level + 1);
              } else {
                valueHTML = String(value);
              }
                html += `<div style="margin-left: ${level * 20}px;"><strong>${key}:</strong> ${valueHTML}</div>`;
            }
        }
    } else {
       html += String(json);
    }

    return html;
}

function renderPeerBlocks (peersData = []) {
  let html = '<h3>Peers</h3>';
  peersData.map((peer) => {
    html += `<div class="peerblock"><h4>${peer.name || ' '} <i>[edit]</i></h4><div class="pubkeyblock">${peer['public key'] || peer.PublicKey}</div>`;
    html += '<div>';
    if (peer.PresharedKey) { html += `<b>Preshared Key: </b>${peer.PresharedKey} <br />` };
    if (peer.endpoint) { html += `<b>Peer public IP: </b>${peer.endpoint} <br />` };
    if (peer['allowed ips'] || peer.AllowedIPs) { html += `<b>Allowed IPs: </b>${peer['allowed ips'] || peer.AllowedIPs} <br />` };
    if (peer['latest handshake']) { html += `<b>Last connect: </b>${peer['latest handshake']} <br />` };
    if (peer.transfer) {html += `<b>Traffic: </b>${peer.transfer} <br />` };
    html += '</div></div>';
  });
  return html;
}

const obfusPa = (str) => str.split('').map((char, i) => "\\u" + (str.charCodeAt(i)).toString(16).padStart(4, '0')).join('');
const deobfusPa = (str) => {
  try {
    return str.replace(/\\u([\dA-F]{4})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16)));
  } catch (e) {
    console.error('Error during decoding', e);
    return null;
  }
}
