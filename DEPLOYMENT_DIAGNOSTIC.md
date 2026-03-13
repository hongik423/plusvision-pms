# Vercel 배포 오류 진단 보고서

## 1. 가설 (Hypotheses)

### 가설 A: Dashboard Root Directory가 rootDirectory로 병합되어 스키마 검증 실패
- **설명**: Vercel Dashboard의 "Root Directory" 설정이 내부적으로 `rootDirectory`로 직렬화되어 vercel.json과 병합된 뒤, 스키마 검증 시 "should NOT have additional property rootDirectory" 오류 발생
- **증거**: vercel.json에는 rootDirectory 없음. 오류 메시지가 정확히 해당 속성 거부
- **확인**: Dashboard에서 Root Directory 비우기

### 가설 B: hongik423 vs hongik423-3087 환경 차이
- **설명**: 두 사용자/계정이 다른 프로젝트 설정 또는 팀 설정 사용
- **증거**: hongik423 푸시 → 실패, hongik423-3087 Redeploy → 성공
- **실제**: 둘 다 동일 프로젝트(`hongik423-3087s-projects/plusvision-pms`) 사용. Redeploy는 **기존 성공 빌드 재사용**이므로 새 빌드/검증을 수행하지 않음. 따라서 "Redeploy 성공"은 새 config 검증을 통과했다는 뜻이 아님.

### 가설 C: outputDirectory "src/.next" 호환 문제
- **설명**: Next.js 프레임워크가 outputDirectory 오버라이드를 제대로 처리하지 못함
- **증거**: Vercel 문서상 outputDirectory는 지원됨. 오류 메시지는 rootDirectory 관련이지 outputDirectory 아님
- **결론**: 2차적 원인일 수 있으나, 현재 오류의 직접 원인은 아님

### 가설 D: vercel.json이 src 기준으로 잘못 읽힘
- **설명**: Root Directory가 src일 때, Vercel이 src/vercel.json을 찾거나 root + src를 잘못 병합
- **증거**: src에 vercel.json 없음. repo에 vercel.json 1개만 존재
- **결론**: 가설 A와 연관. Root Directory 제거 시 해소 가능

### 가설 E: Git 푸시와 Redeploy 트리거 차이
- **설명**: 푸시로 시작된 배포는 전체 빌드+검증을 수행하고, Redeploy는 캐시된 아티팩트만 재사용
- **증거**: 9vUdvEQ9R "Redeploy of 6MFhawkyT"는 예전 성공 빌드 재사용
- **결론**: 새 푸시 배포만 config 검증에 걸림. Redeploy 성공은 config 문제 해결을 의미하지 않음

---

## 2. 결론: 원인

**Vercel Dashboard의 Root Directory = "src" 설정이, 내부적으로 `rootDirectory`로 병합되어 vercel.json 스키마 검증에 실패**하고 있습니다.

- vercel.json 스키마에는 `rootDirectory` 속성이 **없음** (문서/스키마 확인)
- Root Directory는 Dashboard에서만 설정해야 하는 항목
- Dashboard 설정이 config 객체에 `rootDirectory`로 들어가면서, "additional property" 오류 발생

---

## 3. 수정 방안

### 필수 조치: Vercel Dashboard에서 Root Directory 비우기

이미 vercel.json이 **루트에서 빌드**하도록 구성되어 있습니다:

- `installCommand`: `npm install && npm install --prefix src`
- `buildCommand`: `npm run build` (루트의 `npm --prefix src run build` 실행)
- `outputDirectory`: `src/.next`

**따라서 Dashboard의 Root Directory는 비워 두어야 합니다.**

### 단계

1. [Vercel Dashboard](https://vercel.com/hongik423-3087s-projects/plusvision-pms/settings/build-and-deployment) 접속
2. **Root Directory** 섹션으로 스크롤
3. 입력란의 `src`를 **삭제하여 비움** (또는 placeholder `./`만 남김)
4. **Save** 클릭
5. **Deployments** → 최신 실패 배포 → **Redeploy** 실행

---

## 4. hongik423 vs hongik423-3087 차이

| 구분 | hongik423 | hongik423-3087 |
|------|-----------|----------------|
| 역할 | GitHub 푸시로 배포 트리거 | Dashboard에서 Redeploy 실행 |
| 배포 타입 | 새 빌드 (전체 검증) | 기존 빌드 재사용 |
| 결과 | Config 검증 실패 → Error/Initializing | 예전 성공 빌드 사용 → Ready |

**배포 실패의 직접 원인은 계정이 아니라, Root Directory 설정으로 인한 스키마 검증 실패입니다.**
