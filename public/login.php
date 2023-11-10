<?php
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', 'src', 'isAuthorized.php'));
if ($isAuthorized) {
  header('Location: /', true, 303);
  exit;
}
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    if (empty($_POST['username']) || empty($_POST['password'])) {
        header('Location: /login.php?error=1', true, 303);
        exit;
    }
    $username = $_POST['username'];
    $password = $_POST['password'];
    $db = json_decode(file_get_contents(join(DIRECTORY_SEPARATOR, array(__DIR__, '..', 'resources', 'users.json'))), true);
    if (isset($db[$username]) && $password == $db[$username]) {
        $_SESSION['authorized'] = true;
        header('Location: /', true, 303);
    } else {
        header('Location: /login.php?error=1', true, 303);
    }
} else {
?>
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>로그인</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/assets/default.css">
  <link rel="icon" href="/favicon.ico">
<?php
    if (isset($_GET['error'])) {
?>
  <script>
    alert('사용자명과 비밀번호가 유효하지 않습니다.');
  </script>
<?php
    }
?>
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
        <button type="submit">로그인</button>
      </p>
    </form>
  </div>
</body>
</html>
<?php
}
?>
