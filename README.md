# 🏠 Real Estate Listing Management SaaS

**부동산 매물관리 SaaS**는 공인중개사 또는 내부 직원이 **매물을 효율적으로 등록·관리·공유**할 수 있도록 설계된 클라우드 기반 플랫폼입니다.  
웹 브라우저만 있으면 어디서든 접속 가능하며, 모바일 친화적인 UI를 제공합니다.

---

## 🚀 주요 기능

### 📋 매물 관리
- 매물 등록 / 수정 / 삭제 / 조회
- 주소 자동 완성 (카카오맵 또는 네이버 지도 API 연동)
- 매물 상태 관리 (거래중 / 계약완료 / 보류)
- 사진 및 문서 업로드 기능 (S3 또는 Cloudinary 연동)

### 👥 고객 / 문의 관리
- 고객정보 CRUD
- 매물 문의내역 조회 및 상태 변경
- 관심고객 리스트 관리

### 📈 통계 및 리포트
- 월별 등록 매물 수, 계약 수, 매출 통계
- 브로커별 실적 리포트
- 기간별 매출 비교 그래프

### 🧑‍💼 관리자 기능
- 사용자 계정 및 권한 설정
- 로그 / 활동 이력 확인
- 시스템 환경변수 및 공지사항 관리

### 🔐 인증 및 보안
- JWT 기반 로그인 / 로그아웃
- Refresh Token 관리
- Role 기반 접근 제어 (Admin, Agent, Staff)
- HTTPS + CORS 정책 적용

---

## 🏗️ 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, React Query, Axios |
| **Backend** | NestJS, TypeORM, PostgreSQL |
| **Auth** | JWT (RS256), bcrypt |
| **Infra / DevOps** | Railway / AWS / Vercel (선택), Docker |
| **Storage** | AWS S3 (이미지, 문서 저장) |
| **CI/CD** | GitHub Actions |
| **Docs** | Swagger UI (`/api-docs`) |

---

## 📁 프로젝트 구조

