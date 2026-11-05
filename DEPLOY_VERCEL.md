# Triển khai Next.js lên Vercel

Bản này được chuẩn bị để kết nối MongoDB sau; chưa có URI/mật khẩu hay dữ liệu thật trong source.

1. Giải nén bản Next.js vào project của bạn. Giữ file `.env.local` riêng; không commit file JSON dữ liệu xuất.
2. Cài Node.js 22/24 rồi chạy `npm ci`, điền `.env.local`, làm theo `HUONG_DAN_CHUYEN_DU_LIEU.md` và kiểm tra local.
3. Chạy `npm test` và `npm run build`.
4. Push toàn bộ mã nguồn mới lên GitHub. Nếu repository cũ còn `vite.config.js`, `index.html`, `scripts/configure-dist.mjs`, `public/config.js`, hãy xóa chúng vì bản Next.js đã thay thế.
5. Trong Vercel project: **Settings → Build and Deployment**, chọn **Next.js**. Tắt các override cũ của Vite: không để Output Directory là `dist`, không rewrite mọi URL về `/index.html`. Build Command `npm run build`, Install Command mặc định hoặc `npm ci`.
6. **Settings → Environment Variables**, thêm:

| Tên | Giá trị |
|---|---|
| MONGODB_URI | Connection string của MongoDB Atlas, có tài khoản database và mật khẩu đã URL-encode |
| MONGODB_DB | Đúng tên database đã nhập, ví dụ `quanlybaocao` |
| SL_AUTH_PEPPER | Giá trị từ Script Properties cũ nếu chuyển tài khoản; chỉ tạo mới nếu database mới hoàn toàn |

Chọn Production; nếu dùng Preview thì chọn thêm Preview và nên dùng database thử riêng. Không đặt tiền tố `NEXT_PUBLIC_` cho ba biến này. Không còn cần `SO_LIEU_API_URL`.

7. Cấu hình Atlas Database Access và Network Access để Vercel kết nối được. Dùng tài khoản chỉ có quyền readWrite cho database ứng dụng, không dùng tài khoản quản trị Atlas làm tài khoản ứng dụng. Bạn có thể làm bước kết nối này sau theo hướng dẫn trực tiếp.
8. Deploy commit mới hoặc **Deployments → … → Redeploy** sau khi thay biến môi trường. Kiểm tra đăng nhập, báo cáo, thêm/sửa đơn, phân phối và chuông thông báo.

`npm run db:setup` và lệnh nhập chạy từ máy của bạn, không chạy trong Build Command. Build vẫn thành công khi chưa có URI, nhưng đăng nhập sẽ báo chưa cấu hình cho đến khi bạn điền và khởi tạo database.

Nếu cần tăng thời gian API, route đã đặt `maxDuration=60`; giới hạn thực tế phụ thuộc gói Vercel. Đặt Atlas và Vercel gần cùng khu vực để giảm độ trễ.
