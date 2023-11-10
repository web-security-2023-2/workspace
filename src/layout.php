<?php
if ($isAuthorized) {
  $authLink = '/nginx/logout.php';
  $authLabel = '로그아웃';
} else {
  $authLink = '/nginx/login.php';
  $authLabel = '로그인';
}
