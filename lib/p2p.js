const Peer = require('simple-peer')
const wrtc = require('wrtc')

const EventEmitter = require('events')

const proxyData = require('./proxy')
const { tunnel, transferData } = require('./tools')

const REQ_START = 1
const REQ_START_P = 2
const REQ_MID = 3
const REQ_END = 4


const transport = new EventEmitter()
const store = { buffer: {}, hwid: null  };


transport.on('start', (sessionid) => {
  methodA(sessionid);
  methodB(sessionid);   
})


function methodA(sessionid) {
  const type = 'serverA'; 
  const clientA = new Peer({ wrtc })


  clientA.on('signal', data => {
    transferData(sessionid, type, data)
  })

  clientA.on('connect', () => {
    transport.emit('debug', 'p2p start: method A - ' + sessionid)
  })

  clientA.on('data', data => {
    messageSocket(clientA, sessionid, data);
  })

  clientA.on('error', e => {
    console.log(e)
  })

  clientA.on('close', e => {
    close = null;
    transport.emit('debug', 'p2p close: method A - ' + sessionid)
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
    transport.emit('debug', 'p2p start: method B - ' + sessionid)
  })

  clientB.on('data', data => {
    messageSocket(clientB, sessionid, data);
  })

  clientB.on('error', e => {
    console.log(e)
  })

  clientB.on('close', e => {
    transport.emit('debug', 'p2p close: method B - ' + sessionid)
    clientB.destroy();
  })

  tunnel(sessionid, type, (data) => {
    if (clientB.readable) {
      clientB.signal(data);
    }
  });
}

function messageSocket(socket, sessionid, data) {
  if (data[0] === 0 && data[1] === 255) {
    socket.destroy();
  } else {
    const session = data.slice(1, 10).toString('utf8');
    const uuid = data.slice(10, 19).toString('utf8');
    if (data[0] === REQ_START) {
      const params = JSON.parse(data.slice(19).toString('utf8'));
      proxyData(socket, session, params);
    } else if (data[0] === REQ_START_P) {
      const params = JSON.parse(data.slice(19).toString('utf8'));
      store.buffer[session + uuid] = { session, uuid, params, payload: [], lastActivity: Date.now() }
    } else if (data[0] === REQ_MID) {
      store.buffer[session + uuid].lastActivity = Date.now();
      store.buffer[session + uuid].payload.push(data.slice(19));
    } else if (data[0] === REQ_END) {
      if (store.buffer[session + uuid]) {
        proxyData(socket, session, store.buffer[session + uuid].params, Buffer.concat(store.buffer[session + uuid].payload));
        delete store.buffer[session + uuid];
      }
    }
  }
}


function start(options) {
  store.hwid = options.hwid;

  return transport;
}


module.exports = start;