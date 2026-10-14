# PILOT 01C — File-Oriented Editorial Workflow POC v0.1

Architecture spike độc lập để kiểm chứng workflow:

`CONTENT.md + ASSETS/ + asset-manifest.json → prototype`

Không thay đổi production article, không merge `main`, không publish và không thay thế Editorial Console hiện tại.

## Editor workflow

Trong môi trường thử nghiệm đã được khởi động sẵn, biên tập viên chỉ làm 3 việc:

1. Mở `CONTENT.md`, sửa câu chữ và Save.
2. Muốn thay/bổ sung ảnh: đưa file vào `ASSETS/` và đặt basename đúng slot, ví dụ `HERO_01.jpg`, `B01_MAIN.png`, `B01_H01.webp`.
3. Xem cửa sổ prototype. Dev watcher tự rebuild và browser tự refresh.

Biên tập viên không phải sửa HTML, JavaScript hoặc JSON manifest.

## 5 media slots duy nhất trong POC

| Slot | Role | Ratio | Min width |
| --- | --- | --- | ---: |
| `HERO_01` | hero | 16:9 | 1600 px |
| `IMG_01` | wide editorial image | 3:2 | 1400 px |
| `B01_MAIN` | B01 main image | 16:9 | 1600 px |
| `B01_H01` | B01 hotspot 1 image | 16:9 | 1200 px |
| `IMG_02` | inline image | 4:3 | 1200 px |

Nếu không có file, prototype hiển thị placeholder đúng slot. Nếu có đúng một file basename tương ứng, placeholder bị replace. Nếu có nhiều file cùng basename với extension khác nhau, build báo `DUPLICATE_SOURCE` thay vì tự chọn ngẫu nhiên.

## Image processing

Build engine dùng `sharp` để:

- đọc kích thước ảnh;
- cảnh báo `TOO_SMALL` nếu chiều rộng dưới ngưỡng;
- cảnh báo `RATIO_MISMATCH` nếu tỷ lệ lệch quá 8%;
- không upscale ảnh nhỏ;
- tự xoay theo metadata;
- resize xuống max output width theo layout;
- sinh WebP quality 82 cho prototype.

POC không làm DAM, crop editor hoặc image editor. Ảnh lệch ratio vẫn được render kèm cảnh báo để workflow không bị chặn im lặng.

## B01 proof

`B01_MAIN` được render vào stage chính của component B01. `B01_H01` chỉ được render trong panel hotspot 1 và chỉ hiện khi người đọc mở hotspot. Hai slot không append như hai ảnh độc lập.

## Technical bootstrap

Một lần cho môi trường thử nghiệm:

```bash
cd file-oriented-poc
npm install
npm run dev
```

Mở `http://127.0.0.1:4173`.

Sau khi dev server đang chạy, editor không cần chạy thêm lệnh khi sửa text hoặc thay asset.

Kiểm thử contract:

```bash
npm test
```

Self-test tạo fixture trong thư mục tạm của hệ điều hành, không ghi asset test vào article và không sửa production files.

## Internal contract

`asset-manifest.json` là machine-readable contract giữa content, asset và prototype. Nó khai báo stable ID, type, ratio, layout, source pattern và ngưỡng độ phân giải. Người dùng phổ thông không chỉnh file này.

`CONTENT.md` sử dụng hai marker máy đọc có chủ đích:

- `[[ASSET:SLOT_ID]]` cho media slot thông thường;
- `[[COMPONENT:B01]]` để renderer biết vị trí component B01.

Phần chữ reader-facing vẫn nằm trong Markdown; marker chỉ là neo bố cục ổn định.

## Scope limits

POC không có CMS, DAM, backend, cloud storage, Reader AI, chart library, maps, realtime API, theme engine, full migration, merge main hoặc publish.
