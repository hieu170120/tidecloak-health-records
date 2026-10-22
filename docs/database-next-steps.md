# Database milestone: identity + owner-only Emergency Capsule

Đã triển khai trên dev, không reset volume, không sửa realm hoặc tự cấp role.

## Phạm vi đã có

- Migration runner có version/checksum và transaction/advisory lock; chạy lại không chạy lặp migration.
- `GET /me`: mapping `sub` đã verify thành principal, không tự kích hoạt lại account suspended/revoked. Role dùng từ JWT, không dùng role do browser/database tự khai báo để cấp quyền.
- `GET /me/emergency-capsule`: đọc capsule của chính PATIENT, trả ciphertext, không có endpoint nhập patient ID để đọc người khác.
- `PUT /me/emergency-capsule`: lưu phiên bản mới; required `expectedVersion`, concurrency stale trả 409. Transaction supersede phiên bản cũ + insert phiên bản mới + append audit cùng commit/rollback.
- `DELETE /me/emergency-capsule`: archive active capsule, giữ lịch sử; không phải xóa ciphertext vật lý hoặc crypto-erasure.
- `GET /me/audit`: chỉ lịch sử của chính patient. Event `CIPHERTEXT_RETURNED` không tuyên bố đã giải mã/đọc plaintext.
- Audit chain + Ed25519 local signing, advisory lock cho writer đồng thời, xác minh head trước nối chain. App gọi hàm SECURITY DEFINER phạm vi hẹp, không được INSERT/UPDATE/SELECT trực tiếp toàn bộ audit table.
- DPoP resource verification cho token có cnf.jkt: proof key binding, signature, htm/htu/ath, freshness và replay table. Không chấp nhận downgrade bound token sang Bearer. JWT chưa bound vẫn dùng Bearer. DPoP nonce challenge chưa triển khai; proof window cố định 60 giây.
- API container chỉ nhận app_runtime password, không nhận PostgreSQL owner/audit_writer password. Audit signing key là khóa ký log riêng, **không phải khóa giải mã bệnh án**.

## Đường chạy trên máy

```sh
# Nếu clone mới, chuẩn bị Compose từ template không chứa secret:
# cp docker-compose.example.yml docker-compose.yml

# 1. Tạo .env.api từ các field cần thiết; tạo audit key nếu chưa tồn tại.
# Không thay khóa ký đã có khi chạy lại.
node scripts/configure-local-api.mjs

# 2. Bootstrap schema đã tồn tại. Áp migrations kế tiếp, không chạy lại 10-schema.sql.
node scripts/migrate.mjs

# 3. Build API với secret chỉ đọc cho signer.
docker compose up -d --build api

# 4. Frontend trên cổng 3000.
npm run dev
```

Mở http://localhost:3000/patient/emergency-capsule. Trang gọi **Tide SDK thật** ở browser, sau đó gửi base64 opaque bytes tới same-origin Next API proxy rồi NestJS. Không lưu plaintext vào localStorage hoặc database. `key_reference=tide:self:emergency_capsule` là nhãn định danh cơ chế, không phải khóa bí mật.

Yêu cầu realm: identity patient có role `PATIENT` và `_tide_emergency_capsule.selfencrypt`, `_tide_emergency_capsule.selfdecrypt`. Các role Tide phải được quản trị realm phê duyệt; chưa tự provision trong lượt này. Đăng nhập thật và mã hóa thật với tài khoản người dùng **chưa được kiểm thử end-to-end**.

Nếu origin frontend khác `http://localhost:3000`, đổi `DPOP_PUBLIC_BASE_URL` trong `.env.api` thành URL BFF thực tế + `/api/health`, rồi recreate API. Backend không tin X-Forwarded-* do client gửi để tính URL proof. `.env.api` tách issuer đúng với token và JWKS URL để container truy cập được. Audience thực tế phải được đối chiếu khi thử login thật.

## Input contract

PUT chỉ chấp nhận:

```json
{
  "expectedVersion": 0,
  "ciphertext": "<canonical-base64 of Tide SDK output>",
  "ciphertextFormat": "TIDE_STRING"
}
```

`TIDE_STRING` nghĩa là output string từ SDK được UTF-8 encode trước base64; khi đọc phải chuyển ngược về string trước gọi doDecrypt. Output Uint8Array dùng `TIDE_BYTES`. Giới hạn 256 KiB sau decode. Các field patientId, role, bloodType... trong body bị từ chối. Server không thể chứng minh mọi opaque byte do một client bất kỳ gửi lên là ciphertext Tide hợp lệ; kết quả crypto thật phải được kiểm thử ở browser, không suy từ một chuỗi base64.

GET trả `{capsule:null,latestVersion:0}` khi chưa có. Sau archive latestVersion vẫn giữ; PUT mới dùng đúng phiên bản đó. Không suy currentVersion từ số lượng active rows.

## Kiểm thử

```sh
node scripts/test-database-flow.mjs
NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
```

Integration runner tạo database `health_it_<random>` riêng, dùng role ứng dụng đã giới hạn và JWT/proof ký thật từ JWKS test cục bộ trong test process. Không bật bypass auth trên API đang chạy. Dữ liệu test là opaque random bytes; không giả danh chúng là ciphertext đã được Tide xác minh.

Đã qua 13 nhóm integration checks: JWT thiếu/sai/expired/no-exp, mapping idempotent, role deny, roundtrip/owner isolation, body validation/size, ghi đồng thời + 409, archive/history, rollback khi audit lỗi, suspended identity, audit signature/owner filter/permissions, DPoP binding/replay/downgrade, DPoP claim/key mismatch, ghi audit từ các identity đồng thời. Verifier kiểm tra continuity/hash của toàn chain trong DB test. Migration áp lần hai skip đúng checksum. Test DB được giữ riêng để xem lại; chưa seed patient giả vào DB ứng dụng.

## Giới hạn cần giữ rõ

- Đây là self-encryption owner-only. **Chưa có doctor consent, cross-user decrypt hoặc Break-Glass.** Không giao raw key cho bác sĩ để bỏ qua policy.
- Audit signer/public key nằm local; hash-chain chưa có independent anchor/checkpoint. Không bảo đảm chống backend/DBA hợp lực rewrite hoặc truncate toàn bộ lịch sử. Patient-filtered events không đủ để kiểm tra chain toàn cục.
- Nếu signer đổi hoặc head không xác minh được, write fail closed; cần kế hoạch key rotation trước production. Không xóa file .secrets trên hệ thống đã có audit thật.
- Replay table cần job quản trị purge record đã quá proof acceptance window; runtime app chỉ có INSERT, không DELETE. Chưa tự thêm job.
- Guards từ chối request thiếu/sai token/role trước business transaction. Chưa có audit service bao phủ mọi auth-denial/validation-denial. Các write conflict đã được ghi DENIED.
- Frontend không thể thu hồi plaintext đã được một client lưu/chụp màn hình. Không dùng dữ liệu y tế thật để demo.

## Bước sau milestone này

1. Quản trị realm xác nhận roles, thử login thật và patient encrypt/save/reload/decrypt.
2. Crypto spike patient→doctor bằng policy Tide/Forseti, ràng buộc identity/resource/scope/TTL, thử cached ciphertext khi hết hạn/revoke.
3. Sau đó mới thêm Full Record, consent và Break-Glass capsule-only; không dùng bảng trạng thái DB như cryptographic authority.
4. Bổ sung audit verifier toàn cục, independent anchor, notification/outbox và audit cho auth-denial.

Tham khảo: [node-postgres transactions](https://node-postgres.com/features/transactions), [DPoP RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html), [Forseti](https://docs.tide.org/Core-Concepts/forseti-engine).
