# HTML · PDF · PPTX 발표

2026-09-10

- HTML: 기존 스크립트, 방향키, 사용자 지정 버튼 및 스크롤 지원.
- PDF: 브라우저에서 현재 페이지를 렌더링. 이전·다음·처음, 페이지 표시 지원.
- PPTX: 브라우저에서 정적인 슬라이드 미리보기. 이전·다음·처음, 원본 슬라이드 비율 지원.
- 모든 형식에서 QR 리모컨, 전체화면, 화면 가리기, 포인터, 발표 타이머를 공유.
- 파일 내용은 서버에 저장하지 않음. Firebase에는 제어 명령과 연결 상태만 기록.

## 사용

‘발표 파일 열기’를 누르거나 HTML, PDF, PPTX 파일을 드래그해 놓으세요. 화면이 준비되면 ‘연결 시작’을 누르고 휴대폰으로 QR을 스캔하세요.

PPTX 애니메이션·전환 효과·매크로는 재생하지 않습니다. 일부 글꼴·차트·SmartArt·도형·미디어는 PowerPoint와 다르게 표시될 수 있습니다. 원본 모양을 우선할 때는 PowerPoint에서 PDF로 내보낸 파일을 사용하세요. 구형 `.ppt` 및 암호화된 문서는 지원하지 않습니다.

## Vercel 배포

저장소의 기존 `SlideLink-Pretendard-UI` 폴더에 덮어써 주세요. 폴더 이름을 바꾸지 않습니다.

- Root Directory: `SlideLink-Pretendard-UI`
- Framework: Vite
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`

`package.json`, `package-lock.json`, `scripts/` 폴더도 반드시 함께 올립니다. 빌드 시 PDF.js 문자 매핑·표준 글꼴·WASM 파일을 public/pdfjs에 복사합니다. 유료 서버나 Firebase Blaze 전환은 필요하지 않습니다.

## 검증 기록

- TypeScript 검사 통과.
- 실제 브라우저에서 프로덕션 문서 어댑터·브리지 코드를 불러오는 로컬 통합 테스트 수행.
- 50페이지 PDF 첫 페이지 표시, 41회 연속 명령 후 42페이지 표시 확인.
- PDF 42페이지 전체화면 및 포인터 표시 확인.
- 4:3 PPTX 첫 페이지, 마지막 페이지 범위 제한, 처음으로 이동 확인.
- PPTX 전체화면 진입 후 화면 가리기 명령 적용 확인.
- 손상된 PPTX 거절, 정상 HTML 파일로 전환 및 다음 슬라이드 이동 확인.

Vercel 프로덕션 빌드 및 실제 휴대폰 재연결 검증은 업로드 후 필요합니다. 로컬 Vite 네이티브 빌드는 PC의 기존 실행 제한 때문에 수행하지 않았습니다. 브라우저 통합 테스트는 별도의 테스트 서버에서 TypeScript로 변환한 동일 문서 모듈을 사용했습니다.

## 라이브러리

- PDF.js: https://mozilla.github.io/pdf.js/
- pptx-preview: https://github.com/501351981/pptx-preview
- JSZip: https://stuk.github.io/jszip/
