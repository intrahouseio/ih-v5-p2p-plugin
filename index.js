process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const path = require('path');

const logger = require('./lib/logger');
const notifyClient = require('./lib/notify');
const p2pClient = require('./lib/p2p');


function sendProcessInfo() {
  const mu = process.memoryUsage();
  const memrss = Math.floor(mu.rss / 1024);
  const memheap = Math.floor(mu.heapTotal / 1024);
  const memhuse = Math.floor(mu.heapUsed / 1024);

  const data = { memrss, memheap, memhuse };

  process.send({ type: 'procinfo', data });
}

function main(options) {
  let opt;
  try {
    opt = JSON.parse(process.argv[2]);
  } catch (e) {
    opt = {};
  }

  const logfile = opt.logfile || path.join(__dirname, 'ih_p2p.log');
  const loglevel = opt.loglevel || 0;

  logger.start(logfile, loglevel);
  logger.log('Plugin xp2p has started  with args: ' + process.argv[2]);

  setInterval(sendProcessInfo, 10000);

  const p2p = p2pClient(opt);
  const notify = notifyClient(opt);

  p2p.on('debug', mes => logger.log(mes))

  notify.on('state', data => process.send({ type: 'procinfo', data }))
  notify.on('debug', mes => logger.log(mes))
  notify.on('session', sessionid => p2p.emit('start', sessionid))

  sendProcessInfo();
}

main();