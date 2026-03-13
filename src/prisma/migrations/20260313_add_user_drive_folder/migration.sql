-- AddColumn: users.driveFolderId, users.driveFolderName
-- Google Drive 개인 폴더 연동 필드 추가

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "driveFolderName" TEXT;

-- 알려진 직원-폴더 매핑 주석 (seed 스크립트에서 처리)
-- 김남용 → 1NyFdEfenaIzmVKKNDUa8e88Wqmp2QMJF
-- 노희길 → 12I1k7S_K_6S2jGmZqdaGX2AoA9gJJbVe
-- 송상현 → 1SiiheAx4YeTjw2OY8AKj4lEJYOZbVXzo
-- 정희창 → 1A1esjJbYa5NevMj93Bp7_WacqZknDTEf
-- 조현섭 → 1l5HbYWs4TjNAw63GkAgZl0GKOEJwoAT4
-- 최봉   → 1-2HWn0BFCS4VpX0gHJFP73kBwjvnY-ci
-- 최혜인 → 1XcbqhSCLAgitkMXxfV0OiswuNN21HjdQ
