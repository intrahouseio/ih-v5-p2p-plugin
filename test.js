const { fork } = require('child_process');


const params = {
  port :8088,
  syspath: '/opt/ih-v5',
  hwid: '23a2cab6b81b02d18668fa676e8f3c4eb68577cb33f02be50774b4bfa742ae09-1110',
  logfile: '/opt/ih-v5/log/ih_p2p.log',
}


const forked = fork('index.js', [JSON.stringify(params), 'debug']);

forked.on('message', (msg) => {
  console.log(msg);
});

