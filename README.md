# Backend README

프로젝트 구조는 [Standard PHP package skeleton](https://github.com/php-pds/skeleton)을 따랐다.

## 세션

`Cookie: PHPSESSID=f86891ceb5d70b2e601b997617905ff9`

접속하면 기본적으로 이런 식으로 쿠키에 세션 ID가 세팅된다.

스머글링으로 쿠키 값을, 정확히는 거기에 있는 세션 아이디를 탈취하여 권한을 얻을 수 있다.

## 로그인 방법

[resources/users.json](resources/users.json)가 사용자 테이블 역할을 한다. 키 - 사용자명, 값 - 암호.

즉, 사용자명: `user`, 암호: `pass1234`로 로그인 가능하다.

(원래는 해싱이 필요하지만 편의상 생략. 사용자 정보도 모두 생략.)

## 운송장 번호 조회 방법

[resources/shipments.json](resources/shipments.json)가 운송장 번호 테이블 역할을 한다. 키 - 운송장 번호.

`1111-1111-1111` 등을 테스트용 값으로 사용할 수 있다.
