# Kiểm tra bản Next.js + MongoDB

## Đã thực hiện

- Giữ giao diện React, hash route hiện tại và dữ liệu nhập chưa lưu.
- API Next.js Node runtime `/api/rpc`; MongoClient pool tái sử dụng, index và truy vấn theo ngày/tài khoản. Chỉ lấy số dư gần nhất mỗi sản phẩm ngoài khoảng xem, không gửi toàn bộ lịch sử lên trình duyệt.
- Mỗi request có engine riêng, không dùng trạng thái mutable chung giữa người dùng. Cookie phiên HttpOnly/SameSite, kiểm tra Origin + JSON header, giới hạn body 300 KB, kiểm tra quyền server.
- Chống lưu trùng bằng receipt gắn tài khoản/request ID; kiểm tra revision. Mutations dùng MongoDB transaction + document khóa chung để ngăn hai lần chuyển cùng tiêu một số dư.
- Throttle login lưu trong MongoDB; mật khẩu mới/upgraded dùng PBKDF2 210.000 vòng + pepper. Giữ tương thích hash Apps Script 20.000 vòng để nhập tài khoản cũ.
- Xuất dữ liệu chỉ đọc; nhập vào DB trống, kiểm tra liên kết/ID và giao dịch nguyên khối.
- Kiểm thử nghiệp vụ gồm chuyển nhiều sản phẩm, chuyển vượt dư, sửa ngày cũ, quyền admin/user, yêu cầu báo cáo cũ, Data ktt, đếm đơn theo ngày/sản phẩm, tách Upsale/chăm, chống trùng và tương thích mật khẩu.
- Kiểm thử HTTP chặn cross-origin, form post, body lớn, JSON lỗi và thiếu cấu hình.

## Giới hạn xác minh

Build Next.js và unit/regression tests chạy trong môi trường phát triển. Kiểm tra `npm audit` không báo lỗ hổng ở thời điểm đóng gói.

Chưa kết nối MongoDB Atlas của chủ web, chưa nhập dữ liệu thật và chưa deploy thay production trên Vercel. Bài kiểm thử MongoDB replica-set thực (`npm run test:integration`) đã chuẩn bị nhưng môi trường phát triển hiện tại chặn tiến trình MongoDB với lỗi `open: Operation not permitted`, nên chưa xác minh tích hợp MongoDB/transaction thực tế ở đây. Browser preview cũng chưa được xác minh vì runner preview hiện tại dùng tham số Vite không tương thích Next.js. Cần chạy bài tích hợp và kiểm tra UI sau khi có môi trường MongoDB/Next.js local hoặc Vercel Preview.

Đã bỏ test/backend Apps Script cũ cùng các file runtime thừa. Bộ test hiện tại kiểm tra Next.js và logic dùng chung. Bổ sung kiểm thử Origin khi Next bind 0.0.0.0 nhưng trình duyệt truy cập localhost, HTTPS Vercel qua URL nội bộ HTTP, và chặn domain/port khác. Test render dùng fileURLToPath để chạy trên Windows.
