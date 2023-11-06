<?php
if ($isAuthorized) {
  $authLink = '/logout.php';
  $authLabel = '로그아웃';
} else {
  $authLink = '/login.php';
  $authLabel = '로그인';
}
