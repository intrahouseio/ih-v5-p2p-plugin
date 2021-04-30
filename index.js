process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const notifyClient = require('./lib/notify');
const p2pClient = require('./lib/p2p');

const hwid = '13582c8df904a9beaa3635b48333ed5ae2e07b7624f69e65b87dfc1f94078d7d-0110'


function main(options) {
  console.log('ih-v5-p2p-plugin')

  const p2p = p2pClient({ hwid });
  const notify = notifyClient({ hwid });

  p2p.on('debug', (mes) => console.log(mes))

  notify.on('debug', (mes) => console.log(mes))
  notify.on('session', (sessionid) => p2p.emit('start', sessionid))
}



main();