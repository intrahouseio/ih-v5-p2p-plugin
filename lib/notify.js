const udp = require('dgram')
const EventEmitter = require('events')

const transport = new EventEmitter()

const SERVER_HOST =   'p2p.ih-systems.com';
const SERVER_PORT = 49000;

const NOTIFY_WOERKER_INTERVAl = 1000 * 2;
const NOTIFY_FAIL_PONG = 3;


const NOT_REGISTRED = 0;
const REGISTRED = 1;

const REGESTARTION = '1';
const STATUS = '2';
const SESSION = '3';

const REGESTARTION_OK = '4';
const REGESTARTION_ERROR = '0';

const store = { client: null, timer: null, status: NOT_REGISTRED, session: {}, hwid: null, fail: 0 };

function notifyWorker() {
  if (store.fail) {
    if (store.fail > NOTIFY_FAIL_PONG) {
      store.status = REGESTARTION_ERROR;
      restart();
    } else {
      transport.emit('debug', 'connection failed: ' + store.fail);
    }
  }

  if (store.status === NOT_REGISTRED) {
    if (store.fail === 0) {
      transport.emit('state', { key: '-', status: 'Подключение' })
      transport.emit('debug', 'regestration: ...')
    }
    sendNotify(REGESTARTION, store.hwid);
    sendNotify(REGESTARTION, store.hwid);
  }

  if (store.status === REGISTRED) {
    sendNotify(STATUS, store.hwid);
  }

  ++store.fail;
}

function sendNotify(type, data) {
  store.client.send(`${type}${data}`, SERVER_PORT, SERVER_HOST);
}

function messageNotify(data, info) {
  if (store.fail > 1) {
    transport.emit('debug', 'connection status: ok');
  }
  store.fail = 0;
  const msg = data.toString();

  if (msg[0] === REGESTARTION_OK) {
    store.status = REGISTRED;
    const id = msg.slice(1);

    transport.emit('state', { key: `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6, 9)}`, status: 'Подключенно' })
    transport.emit('debug', 'regestration: ok')
  }

  if (msg[0] === STATUS) {
    // transport.emit('debug', 'status: ok')
  }

  if (msg[0] === SESSION) {
    const sessionid = msg.slice(1);

    if (store.session[sessionid] === undefined) {
      sendNotify(SESSION, sessionid);
      sendNotify(SESSION, sessionid);

      transport.emit('debug', 'session: ' + sessionid)
      store.session[sessionid] = {};
      transport.emit('session', sessionid)
    }
  }

  if (msg[0] === REGESTARTION_ERROR) {
    
  }
}

function notifyWorkerStart() {
  store.timer = setInterval(notifyWorker, NOTIFY_WOERKER_INTERVAl);
  notifyWorker();
}

function restart(options) {
  transport.emit('debug', '--------restart connection--------');
  clearInterval(store.timer);

  store.client.close(() => {
    store.client = null;
    store.timer = null;
    store.session = {};
    store.status = NOT_REGISTRED;
    store.fail = 0;

    store.client = udp.createSocket('udp4');
    store.client.on('message', messageNotify);
    store.client.bind(notifyWorkerStart);
  });
}

function start(options) {
  store.hwid = options.hwid;

  store.client = udp.createSocket('udp4');
  store.client.on('message', messageNotify);
  store.client.bind(() => {
    transport.emit('debug', 'notify client start!')
    notifyWorkerStart();
  });
  return transport;
}




module.exports = start;