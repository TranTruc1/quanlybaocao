# Chuyển dữ liệu Sheets sang MongoDB

Công cụ giữ nguyên ID, tài khoản, sản phẩm, phân phối, báo cáo, đơn hàng, mục tiêu, lịch sử và thông báo. Không thêm lại đơn hàng bằng tay và không xóa dữ liệu Sheets.

## 1. Chuẩn bị và xuất bản sao

1. Chọn thời điểm mọi người tạm dừng sửa dữ liệu trên web cũ.
2. Trong Apps Script đang gắn với Sheet cũ, thêm file `ExportSheets.gs`, dán nội dung `migration/ExportSheets.gs`.
3. Chạy `xuatDuLieuSangMongoDB`, cấp quyền đọc Sheet và tạo file trong Drive nếu được hỏi.
4. Mở **Execution log / Nhật ký thực thi**, click link file JSON rồi tải xuống. File chứa cấu trúc mật khẩu đã băm và dữ liệu kinh doanh; giữ riêng, không đưa lên GitHub.
5. Đặt file tại `migration/export.json` trong mã nguồn mới. File JSON trong thư mục này đã được gitignore.

Hàm xuất chỉ đọc Sheet, giữ khóa cùng backend cũ trong lúc xuất để không lấy nửa dữ liệu trước/nửa sau một lần sửa. Phiên đăng nhập cũ không xuất, mọi người đăng nhập lại trên bản MongoDB.

## 2. Giữ mật khẩu hiện tại

Mở **Project Settings / Cài đặt dự án → Script Properties / Thuộc tính tập lệnh** trong Apps Script cũ. Sao chép riêng giá trị `SL_AUTH_PEPPER` vào biến cùng tên trong `.env.local` và trên Vercel. Không cần gửi giá trị này cho ai.

Phải giữ đúng pepper cũ để xác minh mật khẩu đã băm. Tạo pepper mới sẽ khiến các tài khoản dùng pepper cũ không đăng nhập được. Công cụ không thể suy ra pepper từ hash. Sau khi đăng nhập thành công, backend nâng số vòng băm cho tài khoản đó mà giữ nguyên mật khẩu.

## 3. Kiểm tra rồi nhập vào database trống

Điền `MONGODB_URI`, `MONGODB_DB`, `SL_AUTH_PEPPER` trong `.env.local`. Chọn một database mới, chưa có tài khoản hay đơn hàng.

```sh
npm ci
npm run db:setup
npm run db:import -- migration/export.json
```

Lệnh cuối chỉ kiểm tra file và in số dòng từng bảng, **chưa ghi dữ liệu**. Nó chặn ID trùng, thiếu liên kết tài khoản/sản phẩm, báo cáo trùng ngày và số dư không hợp lệ. Data ktt được tính lại từ Tổng data − Data tương tác.

Nếu hợp lệ, chạy:

```sh
npm run db:import -- migration/export.json --apply
```

Toàn bộ nhập dữ liệu chạy trong một giao dịch. Có lỗi thì hủy toàn bộ, không nhập dở. Nếu database đã có dữ liệu, lệnh từ chối ghi đè. Không chạy `db:admin` trước khi nhập; tài khoản admin được nhập cùng dữ liệu.

## 4. Đối chiếu trước khi chuyển web

```sh
npm run dev
```

Đăng nhập bằng tài khoản cũ và kiểm tra:

- Số lượng đơn, doanh số, báo cáo và mục tiêu theo các ngày đã dùng ở web cũ.
- Dư gần nhất của từng sản phẩm, đặc biệt các sản phẩm có ngày bỏ trống.
- Phân phối MKT/SALE, quan hệ đơn MKT/SALE, đơn chia và đơn bùng.
- Lịch sử, thông báo và việc user chỉ nhìn thấy dữ liệu được phép.

Vì đã dừng ghi web cũ lúc xuất, không cho tiếp tục sửa đồng thời trên hai bản. Nếu cần thử trước, nhập vào database thử; khi chuyển chính thức, xuất lại file mới nhất rồi nhập vào database mới khác và đổi MONGODB_DB. Tránh nhập đè hoặc nhập hai lần làm trùng đơn.

Giữ Sheet cũ làm bản sao để đối chiếu; chỉ chuyển domain/bản Vercel khi đã kiểm tra xong. Nếu lỗi, bản cũ vẫn còn dữ liệu. Không chuyển lại web cũ sau khi người dùng đã ghi thêm dữ liệu ở MongoDB mà chưa xử lý phần chênh lệch.
