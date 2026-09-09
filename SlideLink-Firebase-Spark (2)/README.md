# SlideLink — Firebase Spark 무료 요금제 버전

**Blaze·Cloud Functions·Firestore 없이** Firebase Hosting + Realtime Database + 익명 인증으로 동작합니다. 이용자는 회원가입·로그인 화면·비밀번호 입력 없이 HTML을 열고 QR을 스캔합니다. 익명 인증은 권한 구분을 위해 브라우저가 자동으로 처리합니다.

프로젝트는 `.firebaserc`에 **html-remote-65e7d**로 설정되어 있습니다. 이 파일은 배포용 소스이며 실제 배포가 완료된 사이트가 아닙니다.

현재 프로젝트에는 웹 앱 등록, Realtime Database 생성, 익명 인증 활성화, DB 규칙 배포를 완료했습니다. `public/firebase-config.json`에도 실제 설정을 넣었습니다. 아래 최초 콘솔 설정을 다시 할 필요는 없습니다. 남은 단계는 정책이 허용하는 환경에서 `npm run deploy`로 화면을 빌드하고 Hosting에 배포하는 것입니다.

## 먼저 Firebase 콘솔에서 설정할 것

1. [프로젝트 열기](https://console.firebase.google.com/project/html-remote-65e7d/overview). **Spark 요금제를 유지**합니다.
2. **빌드 → Authentication → 시작하기 → 로그인 방법 → 익명 → 사용 설정 → 저장**. Google 로그인이나 전화 인증은 필요 없습니다.
3. **빌드 → Realtime Database → 데이터베이스 만들기**. Firestore가 아닙니다. 원하는 위치를 선택하고 잠금 모드로 시작합니다. 데이터베이스 URL을 복사합니다.
4. **프로젝트 설정 → 일반 → 내 앱 → 웹 앱(</>) 등록**에서 `firebaseConfig` 값을 확인합니다.
5. `public/firebase-config.example.json`을 복사해 **`public/firebase-config.json`**으로 만들고 `apiKey`, `appId`, `databaseURL` 등에 실제 값을 넣습니다. 프로젝트 ID만으로 API 키와 DB URL을 추측하지 마세요.

Firebase 웹 설정의 API 키는 공개 클라이언트 설정입니다. 서비스 계정 비밀 키를 넣는 곳이 아닙니다. 실제 권한은 제공된 Database 규칙으로 제한합니다. Firebase Hosting의 `/__/firebase/init.json`에 완전한 설정이 제공되면 자동으로 읽으므로 별도 설정 파일이 없어도 동작합니다. 명시적인 설정 파일이 있으면 그것을 우선 사용합니다.

## GitHub 파일 교체

기존 Blaze 버전 대신 **이 ZIP의 압축을 푼 내용**을 저장소 루트에 반영하세요. `package.json`, `firebase.json`, `.firebaserc`, `database.rules.json`, `src/`, `lib/` 등이 루트에 있어야 합니다.

예전 `functions/`, `firestore.rules`, `firestore.indexes.json`은 이번 버전에서 쓰지 않습니다. 저장소에서 제거해도 됩니다. 예전 코드가 실제로 배포되어 있다면 이 ZIP을 올리는 것만으로 이미 배포된 Functions나 기존 청구 설정이 자동 삭제·변경되지는 않습니다.

## 최초 배포

Node.js 22.13 이상을 사용할 수 있는, 조직 정책이 허용하는 개발 환경에서 이 폴더를 열고 실행합니다.

```sh
npm ci
npx firebase login
npm run deploy
```

`deploy`는 화면을 빌드하고 **Hosting과 Realtime Database 규칙만** 배포합니다. Functions 배포나 Blaze 업그레이드는 요청하지 않습니다. 데이터베이스 규칙 배포는 이 앱 전용 DB를 기준으로 합니다. 다른 앱의 기존 규칙을 대체하지 않도록 전용 프로젝트에서 사용하세요.

성공하면 출력되는 Hosting URL에서 사용합니다. GitHub에 업로드만 하면 자동 배포되는 것은 아닙니다. GitHub 자동 Hosting 배포를 별도로 연결했다면 `npm ci`와 `npm run build` 후 `dist`를 배포하도록 설정하고, **DB 규칙도 최초 1회 배포해야 합니다.**

## 사용

1. PC에서 사이트를 열고 HTML 또는 이미지·CSS가 포함된 폴더를 열거나 끌어다 놓습니다.
2. **연결 시작**을 누르고 휴대폰으로 QR을 스캔합니다.
3. 이전·다음, 화면 가리기, 포인터, 터치패드, 스크롤, 타이머를 사용합니다. 넘김이 안 되면 발표의 실제 버튼을 지정합니다.
4. 새 QR은 기존 세션을 닫고 새 연결을 만듭니다. 타이머도 초기화됩니다.

PC와 휴대폰은 서로 다른 네트워크여도 됩니다. 원본 HTML 파일은 서버에 업로드하지 않습니다. QR 링크를 아는 한 대가 세션에 연결할 수 있으므로 발표 화면을 공유할 때 QR 노출 범위를 확인하세요.

## 무료 사용 한도 및 연결 유지

Spark에는 동시 연결·저장 용량·다운로드 등 무료 한도가 있습니다. 무제한 서비스가 아니며 한도 초과 시 연결이 제한될 수 있습니다. PC와 휴대폰은 각각 DB 연결을 사용합니다. [현재 Firebase 요금표](https://firebase.google.com/pricing)를 확인하세요.

주기적인 HTTP 서버 호출을 없애고 Realtime Database 구독으로 변경 사항을 받습니다. 별도 유료 서버, Functions, 유료 예약 작업, TTL 기능은 사용하지 않습니다.

PC 네트워크 연결이 끊기면 DB의 연결 해제 처리로 세션을 삭제합니다. 다시 연결할 때는 PC에서 **연결 종료 → 연결 시작**으로 새 QR을 만드세요. 휴대폰은 15초 이상 응답하지 않으면 다른 휴대폰이 QR로 연결할 수 있습니다. 세션은 12시간 후 사용할 수 없으며, 같은 익명 사용자가 다시 연결을 만들 때 남아 있는 만료 세션을 정리합니다.

## 검증과 개발

```sh
npm run typecheck
npm run test:rules
npm run build
```

보안 규칙 테스트는 Java가 설치된 Firebase Database 에뮬레이터 환경에서 실행합니다. 테스트용 프로젝트 `demo-slidelink`를 사용하며 실제 프로젝트 DB를 수정하지 않습니다.

`npm run dev`는 화면 개발용입니다. 이 앱은 기본적으로 설정 파일에 지정한 실제 Firebase에 연결합니다. 이 명령만으로 Firebase 에뮬레이터에 자동 연결되는 것은 아닙니다.

현재 작업 PC의 보안 정책이 Vite의 네이티브 빌드 모듈을 차단한 상태이므로 최종 화면 빌드·실제 배포·휴대폰 테스트는 완료되지 않았습니다. 차단을 우회하지 않았습니다. 허용된 개발 환경에서 위 검사와 배포 후 실제 발표 파일로 확인하세요. 보안 규칙 에뮬레이터 테스트는 작성했으나 이 PC에는 Java가 없어 실행하지 못했습니다.

실제 프로젝트의 DB 규칙 문법 검증·배포 및 임시 테스트 계정을 사용한 REST 통합 테스트는 통과했습니다. 익명 계정 생성, QR 경로의 세션 읽기, 전체 목록 접근 차단, 휴대폰 한 대 연결, 명령 전달, 명령 덮어쓰기·잘못된 좌표·범위 밖 슬롯 차단, 타이머 권한, 명령 확인 삭제, 세션 삭제 후 접근 차단을 확인했습니다. 테스트 데이터와 테스트 계정은 정리했습니다. 이 검사는 브라우저 화면·실제 휴대폰 테스트를 대체하지 않습니다.

## 공식 문서

- [Spark 요금제](https://firebase.google.com/pricing)
- [자동 익명 인증](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Realtime Database 보안 규칙](https://firebase.google.com/docs/database/security)
- [Firebase Hosting 자동 설정 URL](https://firebase.google.com/docs/hosting/reserved-urls)
