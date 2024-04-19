const http = require('http');
const fetch = require('node-fetch');
const FormData = require('form-data');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');

const { encodeData } = require('./tools');

const WebSocket = require('ws');

const store = { sessions: {}, tcp: {}, udp: {} };

function proxyData(opts, socket, sessionid, params, payload) {
  switch(params.method) {
    case 'auth2':
      auth2(opts, socket, sessionid, params);
      break;
    case 'check_hash':
      checkHash(opts.syspath, socket, sessionid, params);
      break;
    case 'client_files':
      clientFiles(opts.syspath, socket, sessionid, params);
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
    case 'tcp_open':
      tcpOpen(opts, socket, sessionid, params, payload);
      break;
    case 'tcp_data':
      tcpData(opts, socket, sessionid, params, payload);
      break;
    case 'tcp_close':
      tcpClose(opts, socket, sessionid, params, payload);
      break;
    default:
      break;
  }
}

function tcpOpen(opts, socket, sessionid, params, payload) {
  const id = `${sessionid}_${params.uuid}`;
  const client = new net.Socket();
  
  fetch(encodeURI(`http://localhost:${opts.port}/api/engine`), {
    method: 'POST',
    body: JSON.stringify({ 
      method: "auth2",
      password: crypto.createHash('sha256').update(`intrahouse${params.password ? params.password : Date.now()}`).digest('hex'),
      username: params.username,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
    .then(res => {
      return res.json()
    })
    .then(data => {
      if (data.response) {
        client.connect(params.rport, params.rhost, function() {
          proxySend(socket, sessionid, { type: 'trasport', method: 'res_tcp_open', uuid: params.uuid, lport: params.lport })
        });

        client.on('data', function(data) {
          proxySend(socket, sessionid, { type: 'trasport', method: 'res_tcp_data', uuid: params.uuid, lport: params.lport}, data)
        });

        client.on('close', function() {
          proxySend(socket, sessionid, { type: 'trasport', method: 'res_tcp_close', uuid: params.uuid, lport: params.lport })
          client.destroy();
          
          if (store.tcp[id]) {
            delete store.tcp[id];
          }
        });

        client.on('error', function() {});

        store.tcp[id] = { client, sessionid, lport: params.lport };
      } else {
        socket.destroy();
      }
    })
    .catch(e => {
      socket.destroy();
    });
}

function tcpData(opts, socket, sessionid, params, payload) {
  const id = `${sessionid}_${params.uuid}`;
  if (store.tcp[id]) {
    store.tcp[id].client.write(payload);
  }
}

function tcpClose(opts, socket, sessionid, params, payload) {
  const id = `${sessionid}_${params.uuid}`;
  if (store.tcp[id]) {
    store.tcp[id].client.destroy();
    delete store.tcp[id];
  }
}

function socketWS(opts, socket, sessionid, params, payload) {
  if (store.sessions[sessionid] === undefined) {
    const token = payload.toString('utf8');

    store.sessions[sessionid] = { status: false, buffer: [], socketP2P: socket, token }
    store.sessions[sessionid].socketWS = new WebSocket(`ws://localhost:${opts.port}/${token}`)
    store.sessions[sessionid].socketWS.onopen = () => wsopen(store.sessions[sessionid].socketWS, sessionid)
    store.sessions[sessionid].socketWS.onmessage = (e) => wsmessage(store.sessions[sessionid].socketWS, sessionid, e)
    store.sessions[sessionid].socketWS.onerror = (e) => wsonerror(store.sessions[sessionid].socketWS, sessionid, e);
    store.sessions[sessionid].socketWS.onclose = () => wsclose(sessionid);
  } else {
    if (store.sessions[sessionid]) {
      if (store.sessions[sessionid].status) {
        if (store.sessions[sessionid].socketWS.readyState === 1) {
          store.sessions[sessionid].socketWS.send(payload.toString('utf8'));
        }
      } else {
        store.sessions[sessionid].buffer.push(payload.toString('utf8'))
      }
    }
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
    proxySend(socket, sessionid, params, e.message)
  });
}

function httpXHR(opts, socket, sessionid, params, payload) {
  params.method = 'res_xhr';
  
  if (params.req.method === 'POST') {
    let body;

    if (params.req.bodyType === 'string') {
      body = payload.toString('utf8'); 
    } else {
      const form = new FormData();

      Object
        .keys(params.formdata)
        .forEach(key => {
          if (key !== 'files') {
            form.append(key, params.formdata[key]);
          }
        })
    
      form.append('files', payload, { contentType: params.formdata.files.type, filename: params.formdata.files.name });
      body = form;    
    }
   
    const options = {
      method: 'POST', 
      body: body,
      headers: {
        token: params.req.token,
      },
    }
   
    fetch(encodeURI(`http://localhost:${opts.port}${params.req.url}`), options)
      .then(res => {
        if (res.ok) {
          if (params.req.bodyType === 'string') {
            return res.buffer();
          } else {
            return res.text();
          }
        } else {
          params.ok = 0;
          params.statusText = res.statusText;
          proxySend(socket, sessionid, params)
        }
      })
      .then(data => {
        if (params.req.bodyType === 'string') {
          params.ok = 1;
          proxySend(socket, sessionid, params, data)
        } else {
          params.ok = 1;
          proxySend(socket, sessionid, params, data)
        }
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

function auth2(opts, socket, sessionid, params) {
  fetch(encodeURI(`http://localhost:${opts.port}/api/engine`), {
    method: 'POST',
    body: JSON.stringify({ 
      method: "auth2",
      password: crypto.createHash('sha256').update(`intrahouse${params.password ? params.password : Date.now()}`).digest('hex'),
      username: params.username,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
    .then(res => {
      return res.json()
    })
    .then(data => {
      if (data.response) {
        proxySend(socket, sessionid, { type: 'access', method: 'res_auth2', status: true, p2p: data.p2pkey, port: opts.port })
      } else {
        proxySend(socket, sessionid, { type: 'access', method: 'res_auth2', status: false, message: data.message })
      }
    })
    .catch(e => {
      proxySend(socket, sessionid, { type: 'access', method: 'res_auth2', status: false, message: e.message })
    });
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

  let total = 0;

  jsFiles.forEach(f => {
    if (f.slice(-3) === '.js' && f.indexOf('runtime') === -1) {
      const info = fs.lstatSync(path.join(jsPath, f))
      total = total + info.size;
    }
  });

  cssFiles.forEach(f => {
    if (f.slice(-4) === '.css') {
      const info = fs.lstatSync(path.join(cssPath, f))
      total = total + info.size;
    }
  });

  proxySend(socket, sessionid, { type: 'files', method: 'res_files_start', total })

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

function wsopen(socket, sessionid) {
  store.sessions[sessionid].status = true;
  store.sessions[sessionid].buffer.forEach(i => {
    if (socket.readyState === 1) {
      socket.send(i);
    }
  });
}

function wsmessage(socket, sessionid, e) {
  if (store.sessions[sessionid]) {
    proxySend(store.sessions[sessionid].socketP2P, sessionid, { type: 'socket', method: 'res_ws' }, e.data)
  }
}

function wsonerror(socket, sessionid, e) {
  // console.log(e.message);
}

function wsclose(sessionid) {
  // console.log('ws close');
}

function destroy(sessionid) {
  if (store.sessions[sessionid]) {
    store.sessions[sessionid].socketWS.terminate();
    delete store.sessions[sessionid];
  }

  Object
    .keys(store.tcp)
    .forEach(key => {
      if (store.tcp[key].sessionid === sessionid) {
        store.tcp[key].client.destroy();
        delete store.tcp[key];
      }
    });
}


module.exports = {
  proxyData,
  destroy,
};


