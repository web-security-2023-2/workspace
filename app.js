import { createHash } from 'node:crypto';
import { createReadStream, readFile, stat } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Eta } from 'eta';

// 실행 시 첫 번째 인수로 포트 번호를 받는다.
// 실행 예: `node app.js 3000`
const port = parseInt(process.argv[2]);
if (isNaN(port)) {
  console.error('Invalid port number.');
  process.exit(1);
}

const MIME_TYPE = {
  HTML: 'text/html; charset=utf-8',
  CSS: 'text/css; charset=utf-8',
  JAVASCRIPT: 'text/javascript; charset=utf-8',
  JSON: 'application/json',
  ICO: 'image/x-icon',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  SVG: 'image/svg+xml',
  TEXT: 'text/plain; charset=utf-8',
};

const origin = `http://localhost:${port}`;
const root = fileURLToPath(new URL('.', import.meta.url));
const dbFile = join(root, 'database.json');
const staticDir = join(root, 'static');
const statusDir = join(root, 'status');
const eta = new Eta({ views: join(root, 'templates') });

createServer((req, res) => {
  req.on('end', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${JSON.stringify(req.headers)}`);
  });

  // URL 객체 참조: https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
  const { pathname, searchParams } = new URL(req.url, origin);

  // 패스별 핸들러 할당
  switch (pathname) {
  case '/search':
  case '/biz/search':
    handleSearch(req, res, pathname, searchParams);
    break;
  case '/favicon.ico':
    handleFavicon(req, res, pathname);
    break;
  default:
    handleStatic(req, res, pathname);
    break;
  }
}).listen(port, () => {
  console.log(`Serving on ${origin}...`);
});

function handleSearch(req, res, path, params) {
  // // GET, HEAD가 아닌 HTTP Method의 요청은 허용하지 않는다.
  // // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
  // if (req.method !== 'GET' && req.method !== 'HEAD') {
  //   handleError(req, res, 405);
  //   return;
  // }

  // 'id', 즉, 운송장 번호가 요청 값에 존재하지 않으면 400 응답.
  // (요청 형식이 올바르지 않음을 고지한다.)
  // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400
  const id = params.get('id');
  if (!id) {
    handleError(req, res, 400);
    return;
  }

  // 데이터베이스 읽기
  readFile(dbFile, 'utf8', (err, db) => {
    // 데이터베이스를 읽는 과정에서 문제가 생기면 500 응답
    // (서버에 문제가 생겼다고 사용자에게 고지한다.)
    // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500
    if (err) {
      handleError(req, res, 500, err);
      return;
    }
    let data;
    try {
      data = JSON.parse(db)[id];
    } catch (err) {
      handleError(req, res, 500, err);
      return;
    }

    // 요청된 운송장 번호가 데이터베이스에 존재하지 않으면
    // 오류 페이지의 응답 본문을 동적으로 생성
    // (사용자가 틀린 입력을 고쳐야 하기 때문에 동적 생성이 요구됨)
    // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404
    const statusCode = data ? 200 : 404;

    // **중요**
    // '/biz/' 디렉토리로 들어온 요청은 프록시가 이미 권한을 검증했다고 가정,
    // 어떤 검증 절차도 없이 무조건적으로 인증된 것으로 간주한다.
    // (보안 결함)
    const isAuthorized = path.startsWith('/biz/');

    // 동적으로 응답 본문 생성
    let body;
    try {
      body = eta.render('search', { id, data, isAuthorized, statusCode });
    } catch (err) {
      // 템플릿 엔진에서 오류 발생 시 500 응답
      // (서버에 문제가 생겼다고 사용자에게 고지한다.)
      // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500
      handleError(req, res, 500, err);
      return;
    }

    // 설계상 인증된 (것으로 간주된) 경우, 본문에는 개인정보가 포함되어 있다.
    // 이런 경우 보안 (모범) 관행은 브라우저의 캐시를 완전히 금지하도록 한다.
    // 404 응답의 경우에도, 'no-cache'(캐시 사용 전에 서버로부터 검증할 것)를
    // 설정해봤자 404 응답은 서버로부터 검증되지 않으므로
    // 아예 저장하지 않게 한다.
    const allowsCache = (statusCode === 200 && !isAuthorized);
    const length = Buffer.byteLength(body);

    // 캐시를 불허하는 경우 Etag 생성/검증/세팅 생략.
    // 304 응답 시 캐시 설정이 헤더에 포함되어야 하므로,
    // 캐시 검증 전에 설정해야 한다.
    // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304
    res.setHeader('Cache-Control', allowsCache ? 'no-cache' : 'no-store');
    if (allowsCache) {
      // 가능하면 사용자의 브라우저 캐시를 사용하게 한다.
      // 서버에서 동적으로 생성한 페이지를 한꺼번에 전송하기 때문에,
      // 본문의 해시를 그 고유성을 판단하는 값으로서 제공할 수 있다.
      // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
      const etag = createEtag(body, length);
      if (etag === req.headers['if-none-match']) {
        res.writeHead(304);
        res.end();
        return;
      } else {
        res.setHeader('Etag', etag);
      }
    }

    res.writeHead(statusCode, {
      'Content-Length': length,
      'Content-Type': MIME_TYPE.HTML,
    });

    // 요청 메소드가 HEAD인 경우 응답에 본문을 포함해서는 안 된다.
    // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(body);
    }
  });
}

function handleFavicon(req, res, path) {
  // 서버 부하를 줄이기 위해, 내용이 변경되지 않을 파비콘은 캐시를 지시,
  // 또한 디스크/네트워크 용량 절약을 위해 PNG 파일로 설정한다.
  handleStatic(req, res, path, {
    'Cache-Control': 'max-age=604800, immutable',
    'Content-Type': MIME_TYPE.PNG,
  });
}

function handleStatic(req, res, path, headers) {
  // // GET, HEAD가 아닌 HTTP Method의 요청은 허용하지 않는다.
  // // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
  // if (req.method !== 'GET' && req.method !== 'HEAD') {
  //   handleError(req, res, 405);
  //   return;
  // }

  // 웹 서버 관행 - 디렉토리가 요청되었을 시 그 디렉토리의 'index.html'을 응답.
  // 표준은 아님. 어지간해선 'index'가 기본값이나 그 값이 다른 서버도 존재.
  const file = join(
    staticDir,
    path.endsWith('/') ?
    decodeURIComponent(path) + 'index.html' :
    decodeURIComponent(path)
  );

  // OS 파일 시스템으로부터 파일 정보 읽기
  stat(file, (err, stats) => {
    if (err && err.code === 'ENOENT') {
      // 파일이 없으면 404 응답. (아무것도 없다고 사용자에게 고지한다.)
      // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404
      handleError(req, res, 404);
    } else if (err) {
      // 다른 오류는 서버에 문제가 생긴 것으로 간주, 500 응답.
      // (서버에 문제가 생겼다고 사용자에게 고지한다.)
      // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500
      handleError(req, res, 500, err);
    } else if (stats.isDirectory()) {
      // 파일이 존재하더라도 디렉토리일 수 있다.
      // 예: '/biz/' 디렉토리가 존재할 때 '/biz'('/biz/'가 아닌)를 요청한다.
      handleDirectory(req, res, path, file);
    } else {
      handleFile(req, res, 200, stats, file, headers);
    }
  });
}

function handleError(req, res, status, err) {
  if (err) console.error(err);

  // 미리 만들어진 오류 페이지가 존재한다면 그것을 보여준다.
  // 없으면 빈 본문으로 응답.
  const file = join(statusDir, `${status}.html`);

  // OS 파일 시스템으로부터 파일 정보 읽기
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
  // 이 서버의 규칙에 따라 요청된 디렉토리의 'index.html'을 찾는다.
  // 파일이 존재하면, 바로 'index.html' 본문을 응답하지 말고 리다이렉트한다.
  // 없으면 리다이렉션 없이 바로 404 응답.
  // (디렉토리 요청 시의 동작에는 표준이 없으며 서버마다 다르다.
  // 이 동작의 경우 Canonical Link의 일관성을 우선시했다.)
  file = join(file, 'index.html');

  // OS 파일 시스템으로부터 파일 정보 읽기
  stat(file, (err) => {
    if (err && err.code === 'ENOENT') {
      handleError(req, res, 404);
    } else if (err) {
      handleError(req, res, 500, err);
    } else {
      res.writeHead(301, { 'Location': path + '/' });
      res.end();
    }
  });
}

function handleFile(req, res, status, stats, file, headers) {
  // 기본적으로 캐시를 허용하되 사용 전에 서버에 무조건 검증하도록 한다.
  // 304 응답 시 캐시 설정이 헤더에 포함되어야 하므로,
  // 캐시 검증 전에 설정해야 한다.
  // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304
  if (headers && headers['Cache-Control']) {
    res.setHeader('Cache-Control', headers['Cache-Control']);
    delete headers['Cache-Control'];
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }

  // 가능하면 사용자의 브라우저 캐시를 사용하게 한다.
  // 정적 파일은 스트림으로 전송되므로, 본문의 해시(etag)를 생성할 수 없다.
  // 따라서 OS가 제공하는 파일 메타데이터의 수정 시각을 대신 제공한다.
  // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified
  const modified = stats.mtime.toUTCString();
  const since = req.headers['if-modified-since'];
  if (since && (new Date(modified) <= new Date(since))) {
    res.writeHead(304);
    res.end();
    return;
  }

  // 커스텀 헤더 설정
  if (headers) {
    for (const header in headers) {
      res.setHeader(header, headers[header]);
    }
  }
  // 나머지 HTTP 헤더 설정
  if (!res.hasHeader('Content-Type')) {
    res.setHeader('Content-Type', guessType(extname(file)));
  }
  res.writeHead(status, {
    'Content-Length': stats.size,
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
  // 간단하게 파일 크기와 MD5 해시의 조합으로 구현했다. 목표는 최대한 짧을 것.
  // (Etag 생성에는 표준이 없다. 서버 사정에 따라 알아서 구현하면 된다.)
  // 참고: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
  const size = length.toString(36);
  const hash = createHash('md5').update(body).digest('base64url');
  return `"${size} ${hash}"`;
}

function guessType(ext) {
  switch(ext) {
  case '.html':
    return MIME_TYPE.HTML;
  case '.css':
    return MIME_TYPE.CSS;
  case '.js':
    return MIME_TYPE.JAVASCRIPT;
  case '.json':
    return MIME_TYPE.JSON;
  case '.ico':
    return MIME_TYPE.ICO;
  case '.png':
    return MIME_TYPE.PNG;
  case '.jpg':
    return MIME_TYPE.JPEG;
  case '.svg':
    return MIME_TYPE.SVG;
  case '.txt':
    return MIME_TYPE.TEXT;
  default:
    return 'application/octet-stream';
  }
}
