import { createReadStream, stat } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const NOT_FOUND_PATH   = '/404.html';
const NOT_ALLOWED_PATH = '/405.html';
const SERVER_ERROR     = '/500.html';

const STATIC_HEADERS = {
  'Cache-Control': 'no-cache',
};

const host = 'localhost';
const port = 8080;
const staticDir = join(process.cwd(), 'static');
const origin = `http://${host}:${port}`;
const notFoundFile = join(staticDir, NOT_FOUND_PATH);
const notAllowedFile = join(staticDir, NOT_ALLOWED_PATH);
const serverErrorFile = join(staticDir, SERVER_ERROR);

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
    }) + "\n");
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
    serveStaticFile(req, res, path);
    break;
  }
});

server.listen(port, host, () => {
  console.log(`Serving on ${origin}...`);
});

function search(req, res) {
  // Router: TODO!!!!
  res.writeHead(200);
  res.end();
}

function serveStaticFile(req, res, path) {
  switch (req.method) {
  case 'GET':
  case 'HEAD':
    const file = join(
      staticDir,
      path.endsWith('/') ?
      decodeURIComponent(path) + 'index.html' :
      decodeURIComponent(path)
    );
    stat(file, (err, stats) => {
      if (err && err.code === 'ENOENT') {
        handleNotFound(req, res, path);
      } else if (err) {
        handleFileError(res, err);
      } else if (stats.isDirectory()) {
        handleDirectory(req, res, path, file);
      } else if (path === NOT_FOUND_PATH) {
        handleFile(req, res, 404, stats, file);
      } else {
        handleFile(req, res, 200, stats, file);
      }
    });
    break;
  default:
    handleNotAllowed(req, res);
    break;
  }
}

function handleNotAllowed(req, res) {
  // If the '/405.html' file exists, return it as a fallback page.
  stat(notAllowedFile, (err, stats) => {
    if (err) {
      res.writeHead(405);
      res.end();
    } else {
      handleFile(req, res, 405, stats, notAllowedFile);
    }
  });
}

function handleNotFound(req, res, path) {
  // If it was already detected that the '/404.html' does not exist,
  // do not try to find the fallback.
  if (path === NOT_FOUND_PATH) {
    res.writeHead(404);
    res.end();
    return;
  }

  // If the '/404.html' file exists, return it as a fallback page.
  stat(notFoundFile, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end();
    } else {
      handleFile(req, res, 404, stats, notFoundFile);
    }
  });
}

function handleFileError(res, err) {
  console.error(err);

  // If the '/500.html' file exists, return it as a fallback page.
  stat(serverErrorFile, (err, stats) => {
    if (err) {
      res.writeHead(500);
      res.end();
    } else {
      handleFile(req, res, 500, stats, serverErrorFile);
    }
  });
}

function handleDirectory(req, res, path, file) {
  file = join(file, 'index.html');
  stat(file, (err) => {
    if (err && err.code === 'ENOENT') {
      handleNotFound(req, res, path);
    } else if (err) {
      handleFileError(res, err);
    } else {
      res.writeHead(301, {
        'Location': path + '/',
      });
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
