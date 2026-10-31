# CI/CD Filmiliar

## Pipeline

Workflow: [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml).

1. Pull request vào `main` và push `main`: `npm ci`, generate Prisma, chạy migration trên PostgreSQL 17 tạm của GitHub runner, build hai workspace, kiểm tra cú pháp shell và chạy unit/integration tests. Test chỉ dùng database `filmiliar_payment_test` trong runner.
2. Sau khi CI qua, push `main` hoặc chạy workflow thủ công từ `main` sẽ build image Linux amd64 và đẩy lên `ghcr.io/congtran1425/filmiliar-api:git-<SHA>`.
3. Job deploy gửi SHA, digest và token registry tạm qua SSH đã ghim host key. VPS xác minh SHA là `origin/main`, image có đúng nhãn revision, cấu hình Compose chỉ thuộc Filmiliar.
4. Sao lưu PostgreSQL, kiểm tra dump đọc được, chạy `prisma migrate deploy`, thay riêng API ở `127.0.0.1:3081`, đợi Docker healthy và kiểm tra revision/DB qua API.
5. Kiểm tra lại API công khai từ GitHub runner. Pipeline kết thúc thành công khi commit đang phục vụ khớp commit vừa triển khai.

Vercel vẫn build/deploy client qua kết nối Git đang có. Trạng thái Vercel là luồng độc lập; job CI/CD VPS không chặn deployment frontend của Vercel.

## GitHub configuration

Environment `production-vps` chỉ cho branch `main` triển khai. Secret trong environment:

| Tên | Nội dung |
| --- | --- |
| `FILMILIAR_VPS_DEPLOY_KEY` | Private key Ed25519 riêng cho CI, không phải khóa quản trị VPS. |

Repository variables:

| Tên | Nội dung |
| --- | --- |
| `FILMILIAR_VPS_HOST` | Host/IP VPS. |
| `FILMILIAR_VPS_USER` | `filmiliar-ci`. |
| `FILMILIAR_VPS_KNOWN_HOSTS` | Host key đã xác minh qua kết nối SSH quản trị hiện có. |

Image registry sử dụng `GITHUB_TOKEN` của từng job, không lưu PAT dài hạn trên VPS. Job publish có `packages: write`; job deploy chỉ có `packages: read`. DB/JWT/ZaloPay/iNet secrets tiếp tục nằm trong cấu hình riêng trên VPS và không được chuyển sang GitHub Actions.

Các action được ghim bằng commit SHA. Chỉ job triển khai được cấp SSH secret; pull request không chạy job này. Workflow không hủy job đang triển khai, và VPS có khóa `flock` chống hai deployment chạy đồng thời.

## VPS configuration

- Repository: `/opt/apps/filmiliar/repo`, branch `main`, chủ sở hữu `ubuntu`.
- Cấu hình riêng: `/opt/apps/filmiliar/config/.env`.
- Image hiện hành: `/opt/apps/filmiliar/config/deployment.env`.
- Lần triển khai thành công gần nhất: `/opt/apps/filmiliar/config/last-deployment.json`.
- Database dumps: `/opt/apps/filmiliar/backups/`, quyền riêng. Không tự xóa các dump.
- Compose project: `filmiliar`; DB và uploads giữ nguyên volumes của project.
- API giữ cổng loopback `3081`; Nginx, DNS và các project khác không thuộc thao tác deploy.

User `filmiliar-ci` không thuộc nhóm Docker hoặc sudo. SSH public key có `restrict` và forced command, từ chối shell, SFTP, PTY và forwarding. Sudo chỉ cho gọi `/usr/local/sbin/filmiliar-ci-deploy` với các tham số được kiểm tra. Wrapper và sudoers do root sở hữu.

Để cài lại/đổi khóa, chủ VPS đặt public key trên máy chủ rồi chạy bằng tài khoản quản trị:

```bash
sudo bash /opt/apps/filmiliar/repo/deploy/install-ci-access.sh /path/to/filmiliar-ci.pub
```

Sau đó cập nhật secret `FILMILIAR_VPS_DEPLOY_KEY` trong GitHub environment. Khóa quản trị cũ được giữ riêng trên máy chủ dự án. Nếu cần thu hồi CI ngay, chủ VPS có thể bỏ khóa trong `/var/lib/filmiliar-ci/.ssh/authorized_keys`.

**Sửa các wrapper trong repository không tự thay bản root-owned đã cài.** Chủ VPS cần rà soát thay đổi rồi chạy lại installer. Quy tắc này giữ phạm vi lệnh có quyền cao tách khỏi các file ứng dụng có thể cập nhật tự động.

## Kiểm tra và chạy lại

Vào GitHub → Actions → **CI and VPS deployment** để xem log. Có thể dùng **Run workflow**, chọn `main`, để triển khai lại cùng commit. Nếu một run đã bị commit mới vượt qua, VPS từ chối SHA cũ; chạy lại run của commit mới nhất.

Health endpoint công khai: `https://api-filmiliar.congtc145.id.vn/api/health`. Trường `revision` phải trùng Git commit mong đợi, `database.status` phải là `connected`.

```bash
git -C /opt/apps/filmiliar/repo status --short --branch
curl -fsS http://127.0.0.1:3081/api/health
sudo docker compose -p filmiliar \
  --env-file /opt/apps/filmiliar/config/.env \
  --env-file /opt/apps/filmiliar/config/deployment.env \
  -f /opt/apps/filmiliar/repo/compose.shared-vps.yaml ps
sudo cat /opt/apps/filmiliar/config/last-deployment.json
```

## Lỗi và rollback

Nếu migration lỗi, pipeline dừng và API trước đó tiếp tục chạy. Nếu API mới đã được thay nhưng không healthy/không đúng revision, wrapper thử khôi phục image `filmiliar-api:rollback-last`, đợi health của image trước và trả lỗi cho Actions. Pipeline luôn báo thất bại khi deployment mới không đạt kiểm tra.

Rollback image không rollback schema. Migration cần tương thích ngược với image đang phục vụ; các thay đổi phá vỡ tương thích cần kế hoạch phát hành riêng. Không tự khôi phục database dump lên dữ liệu đang sử dụng. Khi cần xử lý sự cố, kiểm tra migration và backup trước khi chủ VPS quyết định khôi phục.

Cleanup chỉ thử bỏ các image Filmiliar cũ có đúng source label, giữ ít nhất ba image mới nhất và image rollback. Không prune Docker, không xóa volume và không khởi động lại project khác. Deployment từ chối khi ổ đĩa còn dưới 2 GiB để tránh kéo image làm đầy máy chủ.

Tài liệu chính thức: [GitHub container publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token), [workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
