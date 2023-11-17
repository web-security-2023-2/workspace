<?php
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', 'src', 'isAuthorized.php'));
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', 'src', 'layout.php'));
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
      <nav>
        <p><a href="<?= $authLink ?>"><?= $authLabel ?></a></p>
      </nav>
    </header>
    <form id="search" action="/search.php" method="get">
      <h1>우편물 조회</h1>
      <p>
        <label>운송장 번호:<br>
        <input type="search" name="id" value="" required=""></label>
        <button type="submit">조회</button>
      </p>
    </form>
    <form id="post" action="/post.php" method="post">
      <h1>POST FORM</h1>
      <p>
        <label>Text:<br>
        <input type="test" name="test" value="" required=""></label>
        <button type="submit">Submit</button>
      </p>
    </form>
  </div>
</body>
</html>
