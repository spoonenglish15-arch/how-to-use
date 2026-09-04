# Firebase 연결 방법

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트를 만듭니다.
2. **프로젝트 설정 → 내 앱 → 웹 앱 추가**를 선택합니다.
3. 화면에 표시되는 `firebaseConfig` 값을 `firebase-config.js`에 붙여 넣습니다.
4. **Firestore Database → 데이터베이스 만들기**를 선택합니다.
5. Firestore의 **규칙** 탭에 `firestore.rules` 내용을 붙여 넣고 게시합니다.
6. **Storage → 시작하기**를 선택합니다.
7. Storage의 **Rules** 탭에 `storage.rules` 내용을 붙여 넣고 게시합니다.
8. 웹 호스팅에 `index.html`, `app.js`, `firebase-config.js`와 기존 이미지·음원 파일을 함께 업로드합니다.

PC 화면 너비(769px 이상)에서는 편집 버튼이 나타나며, 모바일(768px 이하)에서는 조회만 가능합니다.

> 현재 방식은 로그인 없이 PC 화면에서 수정할 수 있도록 만든 간단한 방식입니다. 따라서 주소와 Firebase 설정을 아는 사용자가 직접 요청을 보내는 것까지 보안 규칙으로 차단하지는 않습니다.
