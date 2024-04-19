const { fork } = require('child_process');


const params = {
  port :9999,
  syspath: '/opt/ih-v5',
  hwid: '23a2cab6b81b02d18668fa676e8f3c4eb68577cb33f02be50774b4bfa742ae09-1110',
  logfile: '/opt/ih-v5/log/ih_p2p.log',
}


const forked = fork('index.js', [JSON.stringify(params), 'debug'], {
  execArgv: ['--expose-gc'],
});

forked.on('message', (msg) => {
  console.log(msg);
});

forked.on('close', (code) => {
  console.log(`child process close all stdio with code ${code}`);
});

forked.on('exit', (code) => {
  console.log(`child process exited with code ${code}`);
});
