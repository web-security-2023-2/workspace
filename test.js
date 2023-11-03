import { createServer } from 'node:http';

// 실행 시 첫 번째 인수로 포트 번호를 받는다.
// 실행 예: `node test.js 3000`
const port = parseInt(process.argv[2]);
if (isNaN(port)) {
  console.error('Invalid port number.');
  process.exit(1);
}

const origin = `http://localhost:${port}`;

createServer((req, res) => {
  let body = [];
  req.on('error', (err) => {
    res.end("error while reading body: " + err)
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    res.on('error', (err) => {
      res.end("error while sending response: " + err)
    });
   res.end(JSON.stringify({
      "URL": req.url,
      "Headers": req.headers,
      "Length": body.length,
      "Body": body,
    }, undefined, 2) + "\n");
  });
}).listen(port, () => {
  console.log(`Serving on ${origin}...`);
});
