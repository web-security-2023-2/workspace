<?php
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', '..', 'src', 'isAuthorized.php'));
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', '..', 'src', 'layout.php'));
?>
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>우편물 조회</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/nginx/assets/default.css">
  <link rel="icon" href="/nginx/favicon.ico">
</head>
<body>
  <div class="wrapper">
    <header>
      <p><a href="/nginx/">홈</a></p>
      <nav>
        <p><a href="<?= $authLink ?>"><?= $authLabel ?></a></p>
      </nav>
    </header>
    <form id="search" action="/nginx/search.php" method="get">
      <h1>우편물 조회</h1>
      <p>
        <label>운송장 번호:<br>
        <input type="search" name="id" value="" required=""></label>
        <button type="submit">조회</button>
      </p>
    </form>
  </div>
</body>
</html>
