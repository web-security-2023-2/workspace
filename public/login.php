<?php
?>
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>우편물 조회</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/assets/default.css">
  <link rel="icon" href="/favicon.ico">
</head>
<body>
  <div class="wrapper">
    <header>
      <p><a href="/">홈</a></p>
    </header>
    <form id="login" action="/login.php" method="post">
      <h1>로그인</h1>
      <p>
        <p><label>사용자명:<br>
        <input type="text" name="username" required=""></label></p>
        <p><label>암호:<br>
        <input type="password" name="password" required=""></label></p>
        <button type="submit">조회</button>
      </p>
    </form>
  </div>
</body>
</html>
