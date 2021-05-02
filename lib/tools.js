const http2 = require('http2');

const SERVER_HOST =  'p2p.ih-systems.com';
const SERVER_PORT = 49000;


function tunnel(sessionid, type, cb) {
  
  const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`);
  
  client.on('error', (err) => console.error(err));
  client.on('stream', (stream) => {});

  const req = client.request({ ':path': `/tunnel?sessionid=${sessionid}&type=${type}` });
  
  req.setEncoding('utf8');

  req.on('data', (chunk) => { 
    const data = chunk.split('\n\n');

    data.forEach(i => {
      if (i) {
        cb(JSON.parse(i))
      }
    });
   });
  req.on('end', () => {
    client.close();
  });
  req.end();
}

transferData = (sessionid, type, data) => {
  const buffer = Buffer.from(JSON.stringify(data) + '\n\n', 'utf8');
  
  const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`);
  client.on('error', (err) => console.error(err));

  const req = client.request({ 
    ':method': 'POST',
    ':path': `/transfer?sessionid=${sessionid}&type=${type}`,
    'Content-Type': 'application/json',
    'Content-Length': buffer.length,
  });

  req.setEncoding('utf8');
  req.write(buffer);
  req.end();
}


module.exports = {
  tunnel,
  transferData
};