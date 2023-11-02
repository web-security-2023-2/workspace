import { createHash } from 'node:crypto';
import { createReadStream, readFile, stat } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Eta } from 'eta';

const port = parseInt(process.argv[2]);
if (isNaN(port)) {
  console.error('Invalid port number.');
  process.exit(1);
}

const origin = `http://localhost:${port}`;
const root = fileURLToPath(new URL('.', import.meta.url));
const dbFile = join(root, 'database.json');
const staticDir = join(root, 'static');
const statusDir = join(root, 'status');
const templateDir = join(root, 'templates');
const eta = new Eta({ views: templateDir });
const cacheHeader = {
  'Cache-Control': 'no-cache',
};

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
  return;

  const { pathname, searchParams } = new URL(req.url, origin);
  switch (pathname) {
  case '/search':
  case '/biz/search':
    search(req, res, pathname, searchParams);
    break;
  default:
    serveStatic(req, res, pathname);
    break;
  }
}).listen(port, () => {
  console.log(`Serving on ${origin}...`);
});

function search(req, res, path, params) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    handleError(req, res, 405);
    return;
  }
  
  const id = params.get('id');
  if (!id) {
    handleError(req, res, 400, 'search-400.html');
    return;
  }

  readFile(dbFile, 'utf8', (err, db) => {
    if (err) {
      handleError(req, res, 500, 'search-500.html', err);
      return;
    }
    
    let data;
    try {
      data = JSON.parse(db)[id];
    } catch (err) {
      handleError(req, res, 500, 'search-500.html', err);
      return;
    }
    if (!data) {
      handleError(req, res, 404, 'search-404.html');
      return;
    }

    const isAuthorized = path.startsWith('/biz/');
    let body;
    try {
      body = eta.render('search', { id, data, isAuthorized });
    } catch (err) {
      handleError(req, res, 500, 'search-500.html', err);
      return;
    }

    const length = Buffer.byteLength(body);
    const headers = {
      'Content-Length': length,
      'Content-Type': 'text/html; charset=utf-8',
    };

    if (isAuthorized) {
      res.writeHead(200, {
        'Cache-Control': 'no-store',
        ...headers,
      });
      res.end(body);
      return;
    }

    res.setHeader('Cache-Control', 'no-cache');

    // Use cache if the etag matched.
    const etag = createEtag(body, length);
    if (etag === req.headers['if-none-match']) {
      res.writeHead(304);
      res.end();
    } else {
      res.writeHead(200, {
        ...headers,
        'Etag': etag,
      });
      res.end(body);
    }
  });
}

function serveStatic(req, res, path) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    handleError(req, res, 405);
    return;
  }

  const file = join(
    staticDir,
    path.endsWith('/') ?
    decodeURIComponent(path) + 'index.html' :
    decodeURIComponent(path)
  );
  stat(file, (err, stats) => {
    if (err && err.code === 'ENOENT') {
      handleError(req, res, 404);
    } else if (err) {
      handleError(req, res, 500, undefined, err);
    } else if (stats.isDirectory()) {
      handleDirectory(req, res, path, file);
    } else {
      handleFile(req, res, 200, stats, file);
    }
  });
}

function handleError(req, res, status, path, err) {
  if (err) console.error(err);
  
  // If the fallback page exists, return it.
  const file = join(statusDir, path || `${status}.html`);
  stat(file, (err, stats) => {
    if (err) {
      res.writeHead(status);
      res.end();
    } else {
      handleFile(req, res, status, stats, file);
    }
  });
}

function handleDirectory(req, res, path, file) {
  file = join(file, 'index.html');
  stat(file, (err) => {
    if (err && err.code === 'ENOENT') {
      handleError(req, res, 404);
    } else if (err) {
      handleError(req, res, 500, undefined, err);
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
    res.writeHead(304, cacheHeader);
    res.end();
    return;
  }

  res.writeHead(status, {
    ...cacheHeader,
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

function createEtag(body, length) {
  return `"${length.toString(36)} ${createHash('md5').update(body).digest('base64url')}"`;
}

function guessType(file) {
  switch(extname(file)) {
  case '.html':
    return 'text/html; charset=utf-8';
  case '.css':
    return 'text/css; charset=utf-8';
  case '.js':
    return 'application/javascript; charset=utf-8';
  case '.json':
    return 'application/json';
  case '.ico':
  case '.png':
    return 'image/png';
  case '.jpg':
    return 'image/jpeg';
  case '.svg':
    return 'image/svg+xml';
  case '.txt':
    return 'text/plain; charset=utf-8';
  default:
    return 'application/octet-stream';
  }
}
