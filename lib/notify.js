const udp = require('dgram')
const notifyClient = udp.createSocket('udp4')

const EventEmitter = require('events')

const transport = new EventEmitter()

const SERVER_HOST =   'p2p.ih-systems.com';
const SERVER_PORT = 49000;

const NOTIFY_WOERKER_INTERVAl = 1000 * 10;

const NOT_REGISTRED = 0;
const REGISTRED = 1;

const REGESTARTION = '1';
const STATUS = '2';
const SESSION = '3';

const REGESTARTION_OK = '4';
const REGESTARTION_ERROR = '0';

const store = { status: NOT_REGISTRED, session: {}, hwid: null };

function notifyWorker() {
  if (store.status === NOT_REGISTRED) {
    transport.emit('state', { id: '-', status: 'Подключение' })
    transport.emit('debug', 'regestration: ...')
    sendNotify(REGESTARTION, store.hwid);
    sendNotify(REGESTARTION, store.hwid);
  }

  if (store.status === REGISTRED) {
    sendNotify(STATUS, store.hwid);
  }
}

function sendNotify(type, data) {
  notifyClient.send(`${type}${data}`, SERVER_PORT, SERVER_HOST);
}

function messageNotify(data, info) {
  const msg = data.toString();

  if (msg[0] === REGESTARTION_OK) {
    store.status = REGISTRED;
    const id = msg.slice(1);

    transport.emit('state', { id: `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6, 9)}`, status: 'Подключенно' })
    transport.emit('debug', 'regestration: ok')
  }

  if (msg[0] === STATUS) {
    // transport.emit('debug', 'status: ok')
  }

  if (msg[0] === SESSION) {
    const sessionid = msg.slice(1);

    if (store.session[sessionid] === undefined) {
      transport.emit('debug', 'session: ' + sessionid)
      store.session[sessionid] = {};
      transport.emit('session', sessionid)
    }
  }

  if (msg[0] === REGESTARTION_ERROR) {
    
  }
}

function notifyWorkerStart() {
  setInterval(notifyWorker, NOTIFY_WOERKER_INTERVAl);
  notifyWorker();
}

function start(options) {
  store.hwid = options.hwid;

  notifyClient.on('message', messageNotify);
  notifyClient.bind(() => {
    transport.emit('debug', 'notify client start!')
    notifyWorkerStart();
  });
  return transport;
}




module.exports = start;