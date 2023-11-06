<?php
session_start();
$isAuthorized = empty($_SESSION['authorized']) ? false : $_SESSION['authorized'];
