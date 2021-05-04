const { encodeData} = require('./tools')

function proxyData(socket, sessionid, params, payload) {
  proxySend(socket, sessionid, params, 'pong-pong!!!')
}

function proxySend(socket, sessionid, params, payload) {
  const size = 10000;

    const data = encodeData(size, sessionid, params, payload);
    
    data.forEach(i => {
      if (socket && socket.readable) {
        socket.write(i);
      }
    })
}


module.exports = proxyData;
