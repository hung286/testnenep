@echo off
chcp 65001 >nul
echo ======================================================================
echo   ĐỒNG BỘ DỮ LIỆU BAN NỀN NẾP - TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG
echo ======================================================================
echo Đang kiểm tra và cập nhật dữ liệu mới nhất từ GitHub/Vercel...
git pull origin main
echo.
echo Cập nhật cơ sở dữ liệu thành công!
pause
