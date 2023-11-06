<?php
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', 'src', 'isAuthorized.php'));
if (isset($_GET['id'])) {
    $id = $_GET['id'];
    $db = json_decode(file_get_contents(join(DIRECTORY_SEPARATOR, array(__DIR__, '..', 'resources', 'shipments.json'))), true);
    $data = isset($db[$id]) ? $db[$id] : NULL;
    if (is_null($data)) http_response_code(404);
} else {
    $id = NULL;
}
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
<?php
if ($isAuthorized) {
?>
        <p><a href="/logout.php">로그아웃</a></p>
<?php
} else {
?>
        <p><a href="/login.php">로그인</a></p>
<?php
}
?>
      </nav>
    </header>
    <form id="search" action="/search.php" method="get">
      <h1>우편물 조회</h1>
      <p>
        <label>운송장 번호:<br>
        <input type="search" name="id" value="<?= is_null($id) ? '' : $id ?>" required=""></label>
        <button type="submit">조회</button>
      </p>
    </form>
<?php
if (is_null($id)) {
} else if (is_null($data)) {
?>
    <p>입력하신 운송장 번호의 우편물이 없습니다.</p>
<?php
} else {
?>
    <ul>
      <li>물품: <?= $data['parcel'] ?></li>
      <li>상태: <?= $data['state'] ?></li>
      <li>위치: <?= $data['location'] ?></li>
<?php
    if ($isAuthorized) {
?>
      <li>발송인 이름: <?= $data['senderName'] ?></li>
      <li>발송인 주소: <?= $data['senderAddress'] ?></li>
      <li>발송인 번호: <?= $data['senderTel'] ?></li>
      <li>수취인 이름: <?= $data['receiverName'] ?></li>
      <li>수취인 주소: <?= $data['receiverAddress'] ?></li>
      <li>수취인 번호: <?= $data['receiverTel'] ?></li>
<?php
    }
?>
    </ul>
<?php
}
?>
  </div>
</body>
</html>
