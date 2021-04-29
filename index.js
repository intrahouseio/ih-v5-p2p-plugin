const Peer = require('simple-peer')
const wrtc = require('wrtc')

const http2 = require('http2');

const udp = require('dgram')
const notifyClient = udp.createSocket('udp4')

const SERVER_HOST = 'localhost';
const SERVER_PORT = 49000;

const NOT_REGISTRED = 0;
const REGISTRED = 1;

const REGESTARTION = '1';
const STATUS = '2';
const SESSION = '3';

const REGESTARTION_OK = '4';
const REGESTARTION_ERROR = '0';

const NOTIFY_WOERKER_INTERVAl = 1000 * 10;

const store = { status: NOT_REGISTRED, session: {} };

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
    console.log('status: ok')
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
    clientA.send(data);
  })

  clientA.on('error', e => {
    console.log(e)
  })

  clientA.on('close', e => {
    console.log('close: ' + sessionid)
    clientA.destroy();
  })

  tunnel(sessionid, type, (data) => {
    clientA.signal(data);
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
    clientB.send(data);
  })

  clientB.on('error', e => {
    console.log(e)
  })

  clientB.on('close', e => {
    console.log('close: ' + sessionid)
    clientB.destroy();
  })

  tunnel(sessionid, type, (data) => {
    clientB.signal(data);
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
    console.log('!');
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


notifyClient.on('message', messageNotify);
notifyClient.bind(() => {
  console.log('notify client start!')
  notifyWorkerStart();
});



/*
var peer1 = new Peer({ initiator: true, wrtc: wrtc })
var peer2 = new Peer({ wrtc: wrtc })


peer1.on('signal', data => {
  console.log(`${JSON.stringify(data)}\n\n`)
})

peer1.on('connect', () => {
  console.log('connect: p1')
})

*/