const http = require('http');
const fetch = require('node-fetch');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encodeData } = require('./tools');

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
    default:
  }
}

function httpFetch(opts, socket, sessionid, params, payload) {
  params.method = 'res_fetch';

  fetch(`http://localhost:${opts.port}${params.url}`, JSON.parse(payload.toString('utf8')))
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


module.exports = proxyData;


