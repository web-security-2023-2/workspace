<?php
if ($isAuthorized) {
  $authLink = '/apache/logout.php';
  $authLabel = '로그아웃';
} else {
  $authLink = '/apache/login.php';
  $authLabel = '로그인';
}
