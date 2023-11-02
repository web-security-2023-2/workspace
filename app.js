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
    handleSearch(req, res, pathname, searchParams);
    break;
  default:
    handleStatic(req, res, pathname);
    break;
  }
}).listen(port, () => {
  console.log(`Serving on ${origin}...`);
});

function handleSearch(req, res, path, params) {
  // GET, HEAD가 아닌 HTTP Method의 요청은 허용하지 않는다.
  // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/405
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    handleError(req, res, 405);
    return;
  }

  // 'id', 즉, 운송장 번호가 요청 값에 존재하지 않으면 400 응답.
  // (요청 형식이 올바르지 않음을 고지한다.)
  // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/400
  const id = params.get('id');
  if (!id) {
    handleError(req, res, 400, 'search-400.html');
    return;
  }

  readFile(dbFile, 'utf8', (err, db) => {
    // 데이터베이스를 읽는 과정에서 문제가 생기면 500 응답
    // (서버에 문제가 생겼다고 사용자에게 고지한다.)
    // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/500
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

    // 데이터가 없으면 (이런 운송장 번호가 데이터베이스에 존재하지 않으면)
    // 404를 리턴 (아무것도 없다고 사용자에게 고지한다.)
    // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/404
    if (!data) {
      handleError(req, res, 404, 'search-404.html');
      return;
    }

    // **중요**
    // /biz/ 디렉토리로 들어온 요청은 프록시가 이미 권한을 검증했다고 가정,
    // 어떤 검증 절차도 없이 무조건적으로 인증된 것으로 간주한다.
    // (보안 결함)
    const isAuthorized = path.startsWith('/biz/');
    let body;
    try {
      // 동적으로 페이지 생성
      body = eta.render('search', { id, data, isAuthorized });
    } catch (err) {
      // 템플릿 엔진에서 오류 발생 시 500 응답
      // (서버에 문제가 생겼다고 사용자에게 고지한다.)
      // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/500
      handleError(req, res, 500, 'search-500.html', err);
      return;
    }

    const length = Buffer.byteLength(body);
    const headers = {
      'Content-Length': length,
      'Content-Type': 'text/html; charset=utf-8',
    };

    // 설계상 인증된 것으로 간주된 경우, 본문에는 개인정보가 포함되어 있다.
    // 이런 경우 보안 (모범) 관행은 브라우저의 캐시를 완전히 금지하도록 한다.
    if (isAuthorized) {
      res.writeHead(200, {
        'Cache-Control': 'no-store',
        ...headers,
      });

      // 요청 메소드가 HEAD인 경우 응답에 본문을 포함해서는 안 된다.
      // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(body);
      }
      return;
    }

    res.setHeader('Cache-Control', 'no-cache');

    // 가능하면 사용자의 브라우저 캐시를 사용하게 한다.
    // 서버에서 동적으로 생성한 페이지를 한꺼번에 전송하기 때문에,
    // 본문의 해시를 그 고유성을 판단하는 값으로서 제공할 수 있다.
    // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Headers/ETag
    const etag = createEtag(body, length);
    if (etag === req.headers['if-none-match']) {
      res.writeHead(304);
      res.end();
    } else {
      res.writeHead(200, {
        ...headers,
        'Etag': etag,
      });

      // 요청 메소드가 HEAD인 경우 응답에 본문을 포함해서는 안 된다.
      // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(body);
      }
    }
  });
}

function handleStatic(req, res, path) {
  // GET, HEAD가 아닌 HTTP Method의 요청은 허용하지 않는다.
  // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/405
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
      // 파일이 없으면 404 응답. (아무것도 없다고 사용자에게 고지한다.)
      // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/404
      handleError(req, res, 404);
    } else if (err) {
      // 다른 오류는 서버에 문제가 생긴 것으로 간주, 505 응답.
      // (서버에 문제가 생겼다고 사용자에게 고지한다.)
      // 참고: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/500
      handleError(req, res, 500, undefined, err);
    } else if (stats.isDirectory()) {
      // 파일이 존재하더라도 디렉토리일 수 있으므로 따로 처리해야 한다.
      handleDirectory(req, res, path, file);
    } else {
      handleFile(req, res, 200, stats, file);
    }
  });
}

function handleError(req, res, status, path, err) {
  if (err) console.error(err);
  
  // 미리 만들어진 오류 페이지가 존재한다면 그것을 보여준다.
  // 없으면 빈 본문으로 응답.
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
  // 가능하면 사용자의 브라우저 캐시를 사용하게 한다.
  // 정적 파일의 응답은 스트림 파이프로 전송되므로,
  // 전체 본문의 해시(etag)를 미리 생성할 수 없다.
  // 따라서 OS가 제공하는 파일 메타데이터의 수정 시각을
  // 본문의 고유성을 판단하는 값으로서 대신 제공한다.
  // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified
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

  // 요청 메소드가 HEAD인 경우 응답에 본문을 포함해서는 안 된다.
  // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
  if (req.method === 'HEAD') {
    res.end();
  } else {
    const stream = createReadStream(file);
    stream.pipe(res);
  }
}

function createEtag(body, length) {
  // 간단하게 파일 크기와 MD5 해시의 조합으로 구현했다.
  // (Etag에는 구체적인 형식이 없다. 서버 사정에 따라 알아서 구현하면 된다.)
  const size = length.toString(36);
  const hash = createHash('md5').update(body).digest('base64url');
  return `"${size} ${hash}"`;
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
