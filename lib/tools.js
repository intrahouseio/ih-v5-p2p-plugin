const http2 = require('http2');
const shortid = require('@rh389/shortid');

const SERVER_HOST =  'p2p.ih-systems.com';
const SERVER_PORT = 49000;

const START = new Uint8Array([1])
const START_P = new Uint8Array([2])
const MID = new Uint8Array([3])
const END = new Uint8Array([4])

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

function encodeData(size = 10000, sessionid, params, payload) {
  const temp = [];

  const sid = Buffer.from(sessionid, 'utf8');
  const uuid = Buffer.from(shortid.generate(), 'utf8');

  const h2 = Buffer.alloc(28);

  h2.set(sid)
  h2.set(uuid, 14)
  
  if (payload) {
    const p = Buffer.from(JSON.stringify({ ...params, size: payload.length }), 'utf8');
    const h = Buffer.alloc(p.length + 29);

    h.set(START_P)
    h.set(h2, START_P.length)
    h.set(p, START_P.length + h2.length)
    temp.push(h)
  } else {
    const p = Buffer.from(JSON.stringify(params), 'utf8');
    const h = Buffer.alloc(p.length + 29);

    h.set(START)
    h.set(h2, START.length)
    h.set(p, START.length + h2.length)
    temp.push(h)
  }

  if (payload) {
    if (typeof payload === 'string') {
      const numChunks = Math.ceil(payload.length / size)
    
      for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        const data = Buffer.from(payload.substr(o, size), 'utf8')
        const temp2 = Buffer.alloc(data.length + 29);

        temp2.set(MID)
        temp2.set(h2, MID.length)
        temp2.set(data, MID.length + h2.length)

        temp.push(temp2);
      }
    } else {
      const numChunks = Math.ceil(payload.length / size)
    
      for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        const data = payload.slice(o, o + size)
        const temp2 = Buffer.alloc(data.length + 29);

        temp2.set(MID)
        temp2.set(h2, MID.length)
        temp2.set(data, MID.length + h2.length)

        temp.push(temp2);
      }
    }
    const e = Buffer.alloc(29);
    e.set(END)
    e.set(h2, END.length)
    temp.push(e);
  }

  return temp;
}

module.exports = {
  tunnel,
  transferData,
  encodeData,
};


