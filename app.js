import { createReadStream, readFile, stat } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { Eta } from 'eta';

const DB_FILE = join(process.cwd(), 'database.json');
const STATIC_DIR = join(process.cwd(), 'static');
const STATUS_DIR = join(process.cwd(), 'status');

// 본래는 헤더 설정파일을 따로 두고 파싱해서 URL별, 확장자별로 설정하거나,
// 최소한 파일 확장자별로 하드코딩해서라도 캐싱 차이를 두는 게 맞지만,
// 여기서 웹앱의 완성도는 안중요하므로 무조건 사용 전에 캐시 검증하게만 둔다.
const DEFAULT_HEADERS = {
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
  const { pathname: path, searchParams } = new URL(url, origin);
  switch (path) {
  case '/biz/search':
    search(req, res, searchParams, true);
  case '/search':
    search(req, res, searchParams);
    break;
  default:
    serveStatic(req, res, path);
    break;
  }
});

server.listen(port, () => {
  console.log(`Serving on ${origin}...`);
});

function search(req, res, searchParams, isAuthorized) {
  const id = searchParams.get('id');
  if (!id) {
    handleErrorStatus(req, res, 400);
    return;
  }

  readFile(DB_FILE, 'utf8', (err, db) => {
    try {
      if (err) throw new Error(err);

      const data = JSON.parse(db)[id];
      if (!data) {
        handleErrorStatus(req, res, 404);
      }

      // TODO: Render template part
      res.writeHead(200);
      res.end();
    } catch (err) {
      handleErrorStatus(req, res, 500);
    }
  });
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
    res.writeHead(304, DEFAULT_HEADERS);
    res.end();
    return;
  }

  res.writeHead(status, {
    ...DEFAULT_HEADERS,
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
