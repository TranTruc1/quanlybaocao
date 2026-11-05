# Rà soát bản chuẩn bị GitHub / Vercel — 05/11/2026

## Phạm vi

Đã đọc frontend React, các component nhập liệu/ngày/số/modal/batch, tính toán domain, API và cơ chế lưu cục bộ cũ, Apps Script, script khởi tạo, dependency/lockfile và cấu hình build. Không thay nghiệp vụ: đơn chia 0,5; upsale/tick chăm thuộc chăm; bùng loại khỏi tổng; ngân sách thực chi sau chuyển dư; admin xem/sửa, user chỉ dữ liệu của mình.

## Thay đổi

| Vấn đề | Cách xử lý |
| --- | --- |
| Trả mọi báo cáo, đơn và audit khi tải/lưu | Protocol 2: snapshot theo khoảng ngày, delta sau ghi, lịch sử mở theo yêu cầu và phân trang |
| Chuyển dư có thể sai khi thiếu lịch sử trước kỳ | Snapshot gửi ngữ cảnh số dư cuối trước kỳ theo account/sản phẩm; dữ liệu ngân sách đã tính tại server không bị tính lại từ 0 ở client |
| Nhiều lần đọc cùng Sheet trong một request | Memo dữ liệu theo request, trả bản sao khi đọc để không sửa nhầm snapshot; quyền/session luôn kiểm tra mới ở request kế tiếp |
| Lưu nhiều dòng / cascade có thể ghi trước khi kiểm tra hết | Stage thay đổi trong bộ nhớ, validate trước, gom dòng liền nhau để ghi; ScriptLock cho ghi |
| Request lưu bị mất phản hồi rồi thử lại tạo trùng | Request ID giữ trong bộ nhớ client; server kiểm tra fingerprint/receipt trong Audit và tạo ID nghiệp vụ ổn định theo request để chống trùng khi phản hồi bị mất hoặc ghi Audit thất bại |
| Hai người ghi đè cùng đơn/mục tiêu/account/sản phẩm | Revision cho bản ghi, phát hiện xung đột; report tiếp tục kiểm tra revision |
| Response cũ quay về sau đăng xuất hoặc đổi kỳ | Epoch phiên và sequence request; bỏ phản hồi đã lỗi thời |
| Fetch treo, lỗi Google trả HTML | Timeout 45 giây, lỗi kết nối/JSON rõ ràng, không tự retry ghi thiếu kiểm soát |
| Chọn nhầm endpoint để gửi token | Frontend chỉ chấp nhận HTTPS Apps Script `/exec`, không gửi cookie trình duyệt |
| Hash password chỉ có salt trong Sheet | HMAC pepper ở Script Properties; tự nâng cấp hash cũ sau đăng nhập thành công, không đổi mật khẩu |
| Dữ liệu tiền quá lớn, mật khẩu dài quá giới hạn đăng nhập | Kiểm tra tổng VNĐ và giới hạn password 200 ký tự khi tạo/sửa |
| CSV chứa tên khách bắt đầu bằng công thức | Escape ký tự mở đầu công thức khi export |
| Sản phẩm ngừng dùng vẫn nằm trong danh sách nhập mới | Lọc active ở danh sách sản phẩm được giao cho nhập mới |
| Biểu đồ khoảng ngày bị cắt còn 31 ngày | Cho hiển thị đủ khoảng tối đa 367 ngày đã chọn |
| Escape lịch bên trong modal làm đóng cả modal | Chặn lan truyền Escape từ lịch |
| Chế độ mẫu / cấu hình thiếu | Đã xóa toàn bộ cơ chế mẫu khỏi frontend; Vercel build fail closed khi thiếu API; config công khai tách khỏi secret |
| Thiếu CI/security headers | Workflow npm ci/test/audit/build; Vercel CSP, chống frame, nosniff, referrer và permissions policy |

## Kiểm chứng

Bộ kiểm thử bao gồm nghiệp vụ tiền/đơn/chăm/chia/bùng, quyền và giả role, lịch sử riêng theo report, retry chống trùng, xung đột revision, cascade không ghi khi validation thất bại, ngữ cảnh chuyển dư khi tải theo kỳ, số lần đọc Sheet, transport API và build Vercel fail closed. Kiểm thử render các màn chính chạy bằng React server rendering, không thay thế kiểm thử tương tác trình duyệt.

`npm audit` chưa ghi nhận advisory tại thời điểm rà soát; kết quả phụ thuộc cơ sở dữ liệu advisory lúc chạy. Cần tiếp tục cập nhật dependency theo lockfile và CI.

## Việc cần làm ở môi trường thật

Theo `DEPLOY_VERCEL.md`: cập nhật Apps Script trước, giữ Script Properties, triển khai Vercel và kiểm tra luồng thật bằng tài khoản thử. Chưa tự push vào GitHub hay triển khai vào tài khoản Vercel của bạn; chưa có quyền truy cập hai tài khoản đó trong phiên này.

Không gọi đây là “an toàn tuyệt đối”: Sheets vẫn quét bảng JSON phía server, dịch vụ Google có quota và không có transaction nhiều bảng. Xem giới hạn và quy trình đối soát trong hướng dẫn triển khai.

## Tài liệu tham chiếu

- https://developers.google.com/apps-script/guides/support/best-practices
- https://vercel.com/docs/project-configuration/vercel-json
- https://vite.dev/guide/static-deploy.html

Bản cuối đã bỏ chế độ demo, nhánh API cục bộ và seed khỏi frontend. Fixture chỉ còn trong tests để kiểm chứng; không nằm trong bundle sản xuất. Dữ liệu mẫu localStorage cũ được xóa khi mở ứng dụng, không ảnh hưởng Google Sheet.

## Kết quả cuối

- `npm test`: 73/73 kiểm thử chạy qua.
- `npm run build`: thành công; bundle sản xuất không có màn chọn account mẫu hay hàm sinh dữ liệu kiểm thử.
- `npm audit`: 0 advisory được báo trong lần kiểm tra này (gồm dependency production và development).
- `git diff --check`: không có lỗi khoảng trắng.
- Kiểm thử snapshot theo kỳ chứng minh mỗi bảng chỉ có một lần đọc getValues trong một request mô phỏng; đây không phải số đo độ trễ Google thật.
- Chưa kiểm thử tương tác trình duyệt/live Google Sheet hoặc triển khai vào tài khoản GitHub/Vercel thật. Cần hoàn tất checklist tích hợp trong DEPLOY_VERCEL.md.
