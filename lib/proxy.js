const http = require('http');
const fetch = require('node-fetch');
const FormData = require('form-data');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { encodeData } = require('./tools');

const WebSocket = require('ws');

const store = { ws: null, sessions: {} };

function proxyData(opts, socket, sessionid, params, payload) {
  switch(params.method) {
    case 'check_hash':
      checkHash(opts.syspath, socket, sessionid, params);
      break;
    case 'client_files':
      clientFiles2(opts.syspath, socket, sessionid, params);
      break;
    case 'fetch':
      httpFetch(opts, socket, sessionid, params, payload);
      break;
    case 'xhr':
      httpXHR(opts, socket, sessionid, params, payload);
      break;
    case 'image':
      httpImage(opts, socket, sessionid, params, payload);
      break;
    case 'ws':
      socketWS(opts, socket, sessionid, params, payload);
      break;
    default:
      break;
  }
}

function socketWS(opts, socket, sessionid, params, payload) {
  const data = JSON.parse(payload.toString('utf8'));
  if (store.ws.readyState === 1) {
    store.sessions[sessionid] = { socket };
    data.sid = sessionid;
    store.ws.send(JSON.stringify(data));
  }
}

function httpImage(opts, socket, sessionid, params, payload) {
  params.method = 'res_image';

  fetch(encodeURI(`http://localhost:${opts.port}/images/${params.name}`))
  .then(res => {
    return res.buffer();
  })
  .then(data => {
    proxySend(socket, sessionid, params, data)
  })
  .catch(e => console.log(e.message));
}

function httpFetch(opts, socket, sessionid, params, payload) {
  params.method = 'res_fetch';

  fetch(encodeURI(`http://localhost:${opts.port}${params.url}`), JSON.parse(payload.toString('utf8')))
  .then(res => {
    if (res.ok) {
      return res.text();
    } else {
      params.ok = 0;
      params.statusText = res.statusText;
      proxySend(socket, sessionid, params)
    }
  })
  .then(text => {
    params.ok = 1;
    proxySend(socket, sessionid, params, text)
  })
  .catch(e => {
    params.error = 1;
    params.message = e.message;
    proxySend(socket, sessionid, params, text)
  });
}

function httpXHR(opts, socket, sessionid, params, payload) {
  params.method = 'res_xhr';
  
  if (params.req.method === 'POST') {
    const form = new FormData();

    Object
      .keys(params.formdata)
      .forEach(key => {
        if (key !== 'files') {
          form.append(key, params.formdata[key]);
        }
      })
  
    form.append('files', payload, { contentType: params.formdata.files.type, filename: params.formdata.files.name });

    const options = {
      method: 'POST', 
      body: form,
      headers: {
        token: params.req.token,
      },
    }

    fetch(encodeURI(`http://localhost:${opts.port}${params.req.url}`), options)
      .then(res => {
        if (res.ok) {
          return res.text();
        } else {
          params.ok = 0;
          params.statusText = res.statusText;
          proxySend(socket, sessionid, params)
        }
      })
      .then(text => {
        params.ok = 1;
        proxySend(socket, sessionid, params, text)
      })
      .catch(e => {
        params.error = 1;
        params.message = e.message;
      })
  } else {
    const options = {
      method: 'GET', 
      headers: {
        token: params.req.token,
      },
    }

    fetch(encodeURI(`http://localhost:${opts.port}${params.req.url}`), options)
      .then(res => {
        if (res.ok) {
          return res.buffer();
        } else {
          params.ok = 0;
          params.statusText = res.statusText;
          proxySend(socket, sessionid, params)
        }
      })
      .then(buffer => {
        params.ok = 1;
        proxySend(socket, sessionid, params, buffer)
      })
      .catch(e => {
        params.error = 1;
        params.message = e.message;
      })
  }
}

function proxySend(socket, sessionid, params, payload) {
  const size = 10000;
  const data = encodeData(size, sessionid, params, payload);

  data.forEach(i => {
    if (socket && socket.readable) {
      socket.write(i);
    }
  })
}


function checkHash(syspath, socket, sessionid, params) {
  const target = params.target;

  const index = path.join(syspath, 'frontend', target, 'index.html');
  const indexFile = fs.readFileSync(index, 'utf8');
  const hash = crypto.createHash('md5').update(indexFile).digest('hex');
  
  proxySend(socket, sessionid, { type: 'files', method: 'res_hash', hash })
}

function clientFiles(syspath, socket, sessionid, params) {
  const target = params.target;

  const jsPath = path.join(syspath, 'frontend', target, 'static', 'js');
  const cssPath =  path.join(syspath, 'frontend', target, 'static', 'css');
  
  const jsFiles = fs.readdirSync(jsPath);
  const cssFiles = fs.readdirSync(cssPath);

  jsFiles.forEach(f => {
    if (f.slice(-3) === '.js' && f.indexOf('runtime') === -1) {
      const data = fs.readFileSync(path.join(jsPath, f));
      proxySend(socket, sessionid, { 
        type: 'file', 
        method: 'res_file', 
        fileName: f, 
        fileType: 'js' 
      }, data)
    }
  });

  cssFiles.forEach(f => {
    if (f.slice(-4) === '.css') {
      const data = fs.readFileSync(path.join(cssPath, f));
      proxySend(socket, sessionid, { 
        type: 'file', 
        method: 'res_file', 
        fileName: f, 
        fileType: 'css' 
      }, data)
    }
  });

  proxySend(socket, sessionid, { type: 'files', method: 'res_files_end' })
}

function clientFiles2(syspath, socket, sessionid, params) {

  reqFile('/index.html')
    .then(data => {
      const items = data.split('<script src="').slice(1);
      const temp = [];

      items.forEach(i => {
        const name = i.split('"></script>')[0];
        temp.push(name);
      })

      Promise.all(temp.map(reqFile))
        .then(data => {
          data.forEach(i => {
            proxySend(socket, sessionid, { 
              type: 'file', 
              method: 'res_file', 
              fileName: '', 
              fileType: 'js' 
            }, i)
          });
          proxySend(socket, sessionid, { type: 'files', method: 'res_files_end' })
        })
    })

}

function reqFile(name) {
  return new Promise(resolve => {
    const options = {
      host: 'localhost',
      port: 3001,
      path: name,
    };
    http.request(options, (response) => {
        var str = '';
        response.on('data', function (chunk) {
          str += chunk;
        });
      
        response.on('end', function () {
          resolve(str);
        });
      }
    ).end();
  });
}

function wsmessage(e) {
  const data = JSON.parse(e.data);
  if (store.sessions[data.sid]) {
    proxySend(store.sessions[data.sid].socket, data.sid, { type: 'socket', method: 'res_ws' }, e.data)
  }
}

function wsonerror(e) {
  console.log(e.message);
}

function wsclose() {
  console.log('ws close');
}

function startProxy(opts, cb) {
  store.ws = new WebSocket(`ws://v5.ih-systems.com:${opts.port}`);
  store.ws.onopen = cb;
  store.ws.onmessage = wsmessage;
  store.ws.onerror = wsonerror;
  store.ws.onclose = wsclose;
}


module.exports = {
  proxyData,
  startProxy,
};


