#!/usr/bin/env bash
# Script kiểm tra tuân thủ Code Convention cho toàn bộ dự án EventChat trên Linux / CI
set -e

echo "=========================================="
echo " EventChat - Code Convention Verification "
echo "=========================================="

echo -e "\n[1/3] Kiểm tra Frontend (Lint & Build)..."
cd frontend
npm run lint
npm run build
cd ..
echo "-> Frontend kiểm tra hoàn tất: PASS"

echo -e "\n[2/3] Kiểm tra Backend (Maven Compile)..."
cd backend
mvn test-compile -q
cd ..
echo "-> Backend kiểm tra hoàn tất: PASS"

echo -e "\n[3/3] Quét kiểm tra bảo mật (Secrets & Tokens)..."
if git ls-files | grep -E "(application-secrets\.properties\.local|BEGIN PRIVATE KEY)"; then
    echo "LỖI: Phát hiện file nhạy cảm trong Git tracking!"
    exit 1
fi
echo "-> Quét bảo mật Git tracking: SẠCH"

echo -e "\n=========================================="
echo " TẤT CẢ KIỂM TRA ĐÃ QUA THÀNH CÔNG! (PASS) "
echo "=========================================="
