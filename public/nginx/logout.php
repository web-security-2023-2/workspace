<?php
session_start();
unset($_SESSION['authorized']);
header('Location: /nginx/', true, 303);
