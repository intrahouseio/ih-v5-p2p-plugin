const Peer = require('simple-peer')
const wrtc = require('wrtc')

const EventEmitter = require('events')

const proxy = require('./proxy')
const { tunnel, transferData, encodeData } = require('./tools')

const REQ_START = 1
const REQ_START_P = 2
const REQ_MID = 3
const REQ_END = 4


const transport = new EventEmitter()
const store = { buffer: {}, sessions: {}, opts: {}};
const config = { 
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
    {
      urls: 'turn:turn.ih-systems.com:47000',
      username: 'ihv5',
      credential: '136d2723b0ac',
    },
  ]
}

transport.on('start', (sessionid) => {
  methodA(sessionid);
  methodB(sessionid);   
})


function trimBuffer(data) {
  const index = data.indexOf(0x00);

  if (index !== -1) {
    return data.slice(0, index);
  }

  return data;
}

function methodA(sessionid) {
  const type = 'serverA'; 
  const clientA = new Peer({ config, wrtc })


  clientA.on('signal', data => {
    transferData(sessionid, type, data)
  })

  clientA.on('connect', () => {
    transport.emit('debug', 'p2p start: method A - ' + sessionid)
  })

  clientA.on('data', data => {
    if (store.sessions[sessionid] === undefined) {
      store.sessions[sessionid] = type;
    }
    messageSocket(clientA, sessionid, data);
  })

  clientA.on('error', e => {
    // console.log(e)
  })

  clientA.on('close', e => {
    if (store.sessions[sessionid] && store.sessions[sessionid] === type) {
      proxy.destroy(sessionid);
    }
    transport.emit('debug', 'p2p close: method A - ' + sessionid)
    clientA.destroy();
    global.gc();
  })

  tunnel(sessionid, type, (data) => {
    if (clientA.readable) {
      clientA.signal(data);
    }
  });
}

function methodB(sessionid) {
  const type = 'serverB'; 
  const clientB = new Peer({ config, wrtc, initiator: true })

  clientB.on('signal', data => {
    transferData(sessionid, type, data)
  })

  clientB.on('connect', () => {
    transport.emit('debug', 'p2p start: method B - ' + sessionid)
  })

  clientB.on('data', data => {
    if (store.sessions[sessionid] === undefined) {
      store.sessions[sessionid] = type;
    }
    messageSocket(clientB, sessionid, data);
  })

  clientB.on('error', e => {
    // console.log(e)
  })

  clientB.on('close', e => {
    if (store.sessions[sessionid] && store.sessions[sessionid] === type) {
      proxy.destroy(sessionid);
    }
    transport.emit('debug', 'p2p close: method B - ' + sessionid)
    clientB.destroy();
    global.gc();
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
    
    const session = trimBuffer(data.slice(1, 15)).toString('utf8');
    const uuid = trimBuffer(data.slice(15, 29)).toString('utf8');
    if (data[0] === REQ_START) {
      const params = JSON.parse(data.slice(29).toString('utf8'));
      proxy.proxyData(store.opts, socket, session, params);
    } else if (data[0] === REQ_START_P) {
      const params = JSON.parse(data.slice(29).toString('utf8'));
      store.buffer[session + uuid] = { session, uuid, params, payload: [], lastActivity: Date.now() }
    } else if (data[0] === REQ_MID) {
      if (store.buffer[session + uuid].params.method === 'xhr' && store.buffer[session + uuid].params.req.method === 'POST') {
        if (store.buffer[session + uuid].params.loaded == undefined) {
          store.buffer[session + uuid].params.loaded = 0;
        }
        store.buffer[session + uuid].params.loaded = store.buffer[session + uuid].params.loaded + (data.length - 29);
        progress(socket, session, store.buffer[session + uuid].params)
      }
      store.buffer[session + uuid].lastActivity = Date.now();
      store.buffer[session + uuid].payload.push(data.slice(29));
    } else if (data[0] === REQ_END) {
      if (store.buffer[session + uuid]) {
        proxy.proxyData(store.opts, socket, session, store.buffer[session + uuid].params, Buffer.concat(store.buffer[session + uuid].payload));
        delete store.buffer[session + uuid];
      }
    }
  }
}

function progress(socket, sessionid, params) {
  const data = encodeData(10000, sessionid, { ...params, method: 'res_progress'});

  data.forEach(i => {
    if (socket && socket.readable) {
      socket.write(i);
    }
  })
}


function start(options) {
  store.opts = options
  return transport;
}


module.exports = start;