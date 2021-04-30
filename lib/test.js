const Peer = require('simple-peer')
const wrtc = require('wrtc')

const dev = process.env.DEV === undefined ? false : true;

const http2 = require('http2');

const udp = require('dgram')
const notifyClient = udp.createSocket('udp4')

const SERVER_HOST = 'localhost' ||  'p2p.ih-systems.com';
const SERVER_PORT = 49000;

const NOT_REGISTRED = 0;
const REGISTRED = 1;

const REGESTARTION = '1';
const STATUS = '2';
const SESSION = '3';

const REGESTARTION_OK = '4';
const REGESTARTION_ERROR = '0';

const NOTIFY_WOERKER_INTERVAl = 1000 * 10;

const store = { status: NOT_REGISTRED, session: {}, buffer: {} };

const hwid = '13582c8df904a9beaa3635b48333ed5ae2e07b7624f69e65b87dfc1f94078d7d-0110'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

function notifyWorkerStart() {
  setInterval(notifyWorker, NOTIFY_WOERKER_INTERVAl);
  notifyWorker();
}

function notifyWorker() {
  if (store.status === NOT_REGISTRED) {
    console.log('regestration: ...')
    sendNotify(REGESTARTION, hwid);
    sendNotify(REGESTARTION, hwid);
  }

  if (store.status === REGISTRED) {
    sendNotify(STATUS, hwid);
  }
}

function sendNotify(type, data) {
  notifyClient.send(`${type}${data}`, SERVER_PORT, SERVER_HOST);
}

function messageNotify(data, info) {
  const msg = data.toString();

  if (msg[0] === REGESTARTION_OK) {
    store.status = REGISTRED;
    console.log('regestration: ok')
  }

  if (msg[0] === STATUS) {
    // console.log('status: ok')
  }

  if (msg[0] === SESSION) {
    const sessionid = msg.slice(1);

    if (store.session[sessionid] === undefined) {
      store.session[sessionid] = {};
      methodA(sessionid);
      methodB(sessionid);   
    }
  }

  if (msg[0] === REGESTARTION_ERROR) {
    
  }
}

function methodA(sessionid) {
  const type = 'serverA'; 
  const clientA = new Peer({ wrtc })


  clientA.on('signal', data => {
    transferData(sessionid, type, data)
  })

  clientA.on('connect', () => {
    console.log('open: ' + sessionid + ' ' + type)
  })

  clientA.on('data', data => {
    messageSocket(clientA, sessionid, data);
  })

  clientA.on('error', e => {
    console.log(e)
  })

  clientA.on('close', e => {
    close = null;
    console.log('close: ' + sessionid, type)
    clientA.destroy();
  })

  tunnel(sessionid, type, (data) => {
    if (clientA.readable) {
      clientA.signal(data);
    }
  });
}

function methodB(sessionid) {
  const type = 'serverB'; 
  const clientB = new Peer({ wrtc, initiator: true })

  clientB.on('signal', data => {
    transferData(sessionid, type, data)
  })

  clientB.on('connect', () => {
    console.log('open: ' + sessionid + ' ' + type)
  })

  clientB.on('data', data => {
    messageSocket(clientB, sessionid, data);
  })

  clientB.on('error', e => {
    console.log(e)
  })

  clientB.on('close', e => {
    console.log('close: ' + sessionid, type)
    clientB.destroy();
  })

  tunnel(sessionid, type, (data) => {
    if (clientB.readable) {
      clientB.signal(data);
    }
  });
}

transferData = (sessionid, type, data) => {
  const buffer = Buffer.from(JSON.stringify(data) + '\n\n', 'utf8');
  
  const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`);
  client.on('error', (err) => console.error(err));

  const req = client.request({ 
    ':method': 'POST',
    ':path': `/transfer?sessionid=${sessionid}&type=${type}`,
    'Content-Type': 'application/json',
    'Content-Length': buffer.length,
  });

  req.setEncoding('utf8');
  req.write(buffer);
  req.end();
}

function tunnel(sessionid, type, cb) {
  
  const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`);
  
  client.on('error', (err) => console.error(err));
  client.on('stream', (stream) => {

  });

  const req = client.request({ ':path': `/tunnel?sessionid=${sessionid}&type=${type}` });
  
  req.setEncoding('utf8');

  req.on('data', (chunk) => { 
    const data = chunk.split('\n\n');

    data.forEach(i => {
      if (i) {
        cb(JSON.parse(i))
      }
    });
   });
  req.on('end', () => {
    client.close();
  });
  req.end();
}

function messageSocket(socket, sessionid, data) {
  if (data[0] === 0 && data[1] === 255) {
    socket.destroy();
  } else {
    const session = data.slice(1, 10).toString('utf8');
    const uuid = data.slice(10, 19).toString('utf8');

    if (data[0] === 1) {
      const params = JSON.parse(data.slice(19).toString('utf8'));
      messageP2P(params);
    } else if (data[0] === 2) {
      const params = JSON.parse(data.slice(19).toString('utf8'));
      store.buffer[session + uuid] = { session, uuid, params, payload: [], lastActivity: Date.now() }
    } else if (data[0] === 3) {
      store.buffer[session + uuid].lastActivity = Date.now();
      store.buffer[session + uuid].payload.push(data.slice(19));
    } else if (data[0] === 4) {
      if (store.buffer[session + uuid]) {
        messageP2P(store.buffer[session + uuid].params, Buffer.concat(store.buffer[session + uuid].payload));
        delete store.buffer[session + uuid];
      }
    }
  }
}

function messageP2P(params, payload) {
  console.log(params, payload.toString('utf8'))
}


notifyClient.on('message', messageNotify);
notifyClient.bind(() => {
  console.log('notify client start!')
  notifyWorkerStart();
});
