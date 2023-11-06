<?php
session_start();
unset($_SESSION['authorized']);
header('Location: /', true, 303);
