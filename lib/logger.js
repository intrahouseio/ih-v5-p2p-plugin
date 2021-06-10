/*
 *  logger.js
 */

const util = require('util');
const fs = require('fs');


module.exports = {
  fd: 0,
  loglevel: 0,

  start(logfileName, level) {
    // this.fd = fs.openSync(logfileName, 'a'); // добавляет
    this.fd = fs.openSync(logfileName, 'w'); // перезаписывает
    this.setLoglevel(level || 0);
  },

  // level: 0 - низкий уровень (пишется всегда), 1 -средний уровень, 2 - высокий уровень
  log(msg, level) {
    if (!this.fd) return;
    if (level && this.loglevel < level) return;

    const str = typeof msg == 'object' ? 'ERROR: ' + getShortErrStr(msg) : msg;
    if (process.argv[3] === 'debug') {
      console.log(getDateStr() + ' ' + str + '\n')
    }
    fs.write(this.fd, getDateStr() + ' ' + str + '\n', err => {
      if (err) console.log('Log error:' + str + util.inspect(err));
    });
  },

  setLoglevel(level) {
    this.loglevel = level;
    this.log('Log level: '+level);
  }
    
};
    
function getShortErrStr(e) {
  if (typeof e == 'object') return e.message ? getErrTail(e.message) : JSON.stringify(e);
  if (typeof e == 'string') return e.indexOf('\n') ? e.split('\n').shift() : e;
  return String(e);

  function getErrTail(str) {
    let idx = str.lastIndexOf('error:');
    return idx > 0 ? str.substr(idx + 6) : str;
  }
}

function getDateStr() {
  const dt = new Date();
  return (
    pad(dt.getDate()) +
    '.' +
    pad(dt.getMonth() + 1) +
    ' ' +
    pad(dt.getHours()) +
    ':' +
    pad(dt.getMinutes()) +
    ':' +
    pad(dt.getSeconds()) +
    '.' +
    pad(dt.getMilliseconds(), 3)
  );
}

function pad(str, len = 2) {
  return String(str).padStart(len, '0');
}