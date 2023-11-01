import { createReadStream, stat } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const STATIC_DIR = join(process.cwd(), 'static');
const STATUS_DIR = join(process.cwd(), 'status');
const STATIC_HEADERS = {
  'Cache-Control': 'no-cache',
};

const port = parseInt(process.argv[2]);
const origin = `http://localhost:${port}`;
if (isNaN(port)) {
  console.error('Invalid port number.');
  process.exit(1);
}

const server = createServer((req, res) => {
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
  return;

  const { url } = req;
  const path = new URL(url, origin).pathname;
  switch (path) {
  case '/search':
  case '/biz/search':
    search(req, res);
    break;
  default:
    serveStatic(req, res, path);
    break;
  }
});

server.listen(port, () => {
  console.log(`Serving on ${origin}...`);
});

function search(req, res) {
  // Router: TODO!!!!
  res.writeHead(200);
  res.end();
}

function serveStatic(req, res, path) {
  switch (req.method) {
  case 'GET':
  case 'HEAD':
    const file = join(
      STATIC_DIR,
      path.endsWith('/') ?
      decodeURIComponent(path) + 'index.html' :
      decodeURIComponent(path)
    );
    stat(file, (err, stats) => {
      if (err && err.code === 'ENOENT') {
        handleErrorStatus(req, res, 404);
      } else if (err) {
        handleFileError(res, err);
      } else if (stats.isDirectory()) {
        handleDirectory(req, res, path, file);
      } else {
        handleFile(req, res, 200, stats, file);
      }
    });
    break;
  default:
    handleErrorStatus(req, res, 405);
    break;
  }
}

function handleErrorStatus(req, res, status) {
  // If the fallback page exists, return it.
  const file = join(STATUS_DIR, `${status}.html`);
  stat(file, (err, stats) => {
    if (err) {
      res.writeHead(status);
      res.end();
    } else {
      handleFile(req, res, status, stats, file);
    }
  });
}

function handleFileError(res, err) {
  console.error(err);
  handleErrorStatus(req, res, 500);
}

function handleDirectory(req, res, path, file) {
  file = join(file, 'index.html');
  stat(file, (err) => {
    if (err && err.code === 'ENOENT') {
      handleErrorStatus(req, res, 404);
    } else if (err) {
      handleFileError(res, err);
    } else {
      res.writeHead(301, { 'Location': path + '/' });
      res.end();
    }
  });
}

function handleFile(req, res, status, stats, file) {
  // Use cache if the file did not modified since the last request.
  const modified = stats.mtime.toUTCString();
  const since = req.headers['if-modified-since'];
  if (since && (new Date(modified) <= new Date(since))) {
    res.writeHead(304, STATIC_HEADERS);
    res.end();
    return;
  }

  res.writeHead(status, {
    ...STATIC_HEADERS,
    'Content-Length': stats.size,
    'Content-Type': guessType(file),
    'Last-Modified': modified,
  });

  // Do not send a body if the request method is HEAD.
  if (req.method === 'HEAD') {
    res.end();
  } else {
    const stream = createReadStream(file);
    stream.pipe(res);
  }
}

function guessType(file) {
  switch(extname(file)) {
  case '.html':
  case '.htm':
    return 'text/html; charset=utf-8';
  case '.css':
    return 'text/css; charset=utf-8';
  case '.js':
    return 'application/javascript; charset=utf-8';
  case '.json':
    return 'application/json';
  case '.ico':
    return 'image/x-icon';
  case '.png':
    return 'image/png';
  case '.jpg':
  case '.jpeg':
    return 'image/jpeg';
  case '.svg':
    return 'image/svg+xml';
  case '.txt':
    return 'text/plain; charset=utf-8';
  default:
    return 'application/octet-stream';
  }
}
