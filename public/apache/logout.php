<?php
session_start();
unset($_SESSION['authorized']);
header('Location: /apache/', true, 303);
