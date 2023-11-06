<?php
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', 'src', 'isAuthorized.php'));
include join(DIRECTORY_SEPARATOR, array(__DIR__, '..', 'src', 'layout.php'));
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
        <p><a href="<?= $authLink ?>"><?= $authLabel ?></a></p>
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
    $list = array();
    $list['물품'] = $data['parcel'];
    $list['상태'] = $data['state'];
    $list['위치'] = $data['location'];
    if ($isAuthorized) {
        $list['발송인 이름']= $data['senderName'];
        $list['발송인 주소']= $data['senderAddress'];
        $list['발송인 번호']= $data['senderTel'];
        $list['수취인 이름']= $data['receiverName'];
        $list['수취인 주소']= $data['receiverAddress'];
        $list['수취인 번호']= $data['receiverTel'];
    }
?>
    <ul>
<?php
    foreach($list as $key => $value) {
?>
      <li><?= $key ?>: <?= $value ?></li>
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
