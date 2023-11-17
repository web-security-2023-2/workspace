<?php
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', '..', 'src', 'isAuthorized.php'));
if ($isAuthorized != true) {
  header('Location: /login.php', true, 303);
  exit;
}
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', '..', 'src', 'layout.php'));
?>
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Admin</title>
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
    <p>로그인된 사용자만 볼 수 있는 페이지입니다.</p>
  </div>
</body>
</html>
