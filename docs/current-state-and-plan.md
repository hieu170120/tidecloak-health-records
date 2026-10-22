# Challenge 2 — Đánh giá hiện trạng và kế hoạch triển khai

Ngày đánh giá: 22/10/2026. Đối chiếu quy trình vận hành do nhóm cung cấp và ý tưởng healthcare đính kèm với mã nguồn đã fetch.

## Kết luận

Luồng nghiệp vụ của nhóm đủ rõ để làm MVP: bệnh nhân giữ hồ sơ, cấp consent theo scope/TTL; bác sĩ đọc trong phạm vi; cấp cứu chỉ mở Emergency Capsule; auditor xem bằng chứng. Nhưng đây chưa phải các chức năng đã chạy end-to-end trong repo.

Có **hai mức tiến độ khác nhau**:

- Local `main`, commit `6e16e37`: starter Next.js + TideCloak.
- Remote `origin/dev`, commit `e52162f`: thêm NestJS, JWT/role guards, PostgreSQL schema. Chưa merge vào main. Không tự đổi branch hoặc thay realm đang dùng khi đánh giá.

Giữ Next.js frontend và NestJS backend mà nhóm đã bắt đầu; không chuyển sang Vite theo bản research cũ. Bước phát triển tiếp theo nên là một luồng nhỏ chứng minh cross-user encryption/policy thật, trước khi xây đủ chín dashboard.

## Đã có gì?

| Hạng mục | main | dev | Ý nghĩa thực tế |
|---|---|---|---|
| Next.js 16, React 19, TideCloak provider | Có | Kế thừa | Không phải React/Vite |
| `tidecloak.json` | Local đã copy, ignored | Không track | Adapter có field cần thiết, chưa chứng minh realm online/đúng quyền |
| Login/logout/callback | Có code | Kế thừa | Chưa thử login bằng các persona thật |
| Demo self-encryption `message` | Có | Kế thừa | Ciphertext ở localStorage; người tạo tự giải mã |
| API demo `/api/protected` | Có | Kế thừa | Kiểm tra token + `offline_access`, chưa phải health permission |
| Bốn role nghiệp vụ | Chưa có trong realm mẫu | Có union type/allowlist/guard | Chưa chứng minh role đã provision vào realm thật |
| NestJS API + JWT JWKS/issuer/audience | Không | Có | Global JWT guard; role guard áp dụng khi route có role metadata |
| PostgreSQL pool + `/health` | Không | Có | Chưa chạy với DB trong lần đánh giá |
| Schema capsule/records/versions/consents | Không | Có | Chưa có CRUD/service/controller nghiệp vụ |
| Schema emergency grants/receipts | Không | Có | Chưa có policy giải mã hoặc Break-Glass endpoint |
| Schema audit/checkpoints/outbox | Không | Có | Có columns/trigger; chưa có writer, verifier, anchor hay worker |
| Chín trang healthcare trong quy trình | Chưa | Chưa | Hiện chỉ `/`, `/home`, `/protected`, callback và route demo |

Chứng cứ source `dev`: `api/src/app.module.ts` chỉ đăng ký `HealthController`; controller hiện chỉ khai báo `GET /health`. Không đồng nhất việc có bảng `consents` với việc consent đã hoạt động.

## Kết quả kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Fetch remote | Đã phát hiện nhánh dev mới |
| Dependencies frontend | Đã cài theo lock hiện có, dùng `--ignore-scripts` |
| Main TypeScript | PASS: `tsc --noEmit` |
| Main production build | PASS: `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` |
| NestJS dev build độc lập | PASS: `npm run build` trong bản sao tạm của `api/` |
| Root TypeScript dev nguyên trạng | FAIL: TS1241/TS1270 tại `api/src/health/health.controller.ts:9` |
| Thử sửa root exclude `api` | PASS trong bản sao tạm; chưa áp dụng vào branch dev |
| Login thật / cross-user decrypt / expiry / revoke | CHƯA KIỂM TRA |
| DB initialization, permissions, Docker Compose | CHƯA CHẠY; compose chưa có trong tree remote, có bản local untracked |
| Audit hash/signature/anchor integration | CHƯA TRIỂN KHAI |

Phiên bản frontend resolve: Next 16.4.2, React 19.3.1, `@tidecloak/nextjs`, `@tidecloak/react`, `@tidecloak/js` 0.13.33. Node 22.18.0. Dependencies API được cài/build trong bản sao `/tmp`; checkout main vẫn được giữ.

## Những điểm cần sửa/chốt trong quy trình của nhóm

### 1. Cấp consent không nên đồng nghĩa gửi một khóa lâu dài cho bác sĩ

Các bước “đóng gói khóa cho bác sĩ”, `wrapped_data_key` và `wrapped_emergency_key` phải được chốt với cơ chế Tide thật. Nếu bác sĩ nhận DEK lâu dài và giữ lại ciphertext, backend đổi trạng thái consent không thể khiến khóa đã nhận mất tác dụng.

Nếu dùng mô hình policy-governed của Tide: lưu ciphertext và policy/proof references, cho Fabric quyết định cryptographic operation theo danh tính, resource, scope và thời hạn. Đừng tự thêm master key backend hoặc emergency master key để làm demo chạy.

**Spike bắt buộc:** hai identity khác nhau; patient encrypt, doctor bị từ chối, patient approval/policy cho doctor đọc, doctor khác bị từ chối. Sau đó thử direct SDK trên ciphertext đã cache khi TTL hết hoặc consent bị revoke, không chỉ thử gọi API bị 403.

SDK đã cài có `IAMService.doEncrypt(data, decryption_policy?)` / `doDecrypt(data, decryption_policy?)`. Wrapper React hiện chỉ truyền `data`, không policy argument. Đó là điểm cần tích hợp, không phải cam kết đã có patient-consent feature chạy sẵn. Tài liệu [Forseti](https://docs.tide.org/Core-Concepts/forseti-engine) mô tả rule theo request data, approvers và executor; cách ràng buộc medical record/consent phải được nhóm xây và thử thật.

### 2. Thu hồi chỉ có ý nghĩa với lần truy cập mới

TTL của JWT khác TTL consent. Token còn hạn không có nghĩa consent còn hạn. Cần kiểm tra thời hạn ở authority path, lấy thời gian đáng tin cậy, không tin `now`/`ACTIVE` do client hay backend tự khai báo.

Revoke động là điểm chưa giải: policy cũ đã ký có còn được Fabric chấp nhận tới expiry không? Bác sĩ giữ policy/ciphertext cũ có gọi lại được không? Chỉ sửa row `REVOKED` trong PostgreSQL không trả lời được câu hỏi này. Không tuyên bố revoke tức thì ở tầng cryptographic trước khi kiểm chứng cơ chế freshness/revocation/version của policy.

Dữ liệu plaintext đã được bác sĩ xem, lưu hoặc chụp màn hình không thể bị thu hồi từ xa. Clear UI khi hết hạn chỉ là UX, không phải bảo đảm xóa bản sao.

### 3. Break-Glass là policy riêng, giới hạn object và scope

Giữ quyết định của nhóm: **không có emergency path đọc Full Medical Record trong MVP**. Emergency role không tự có mọi quyền của DOCTOR hoặc PATIENT.

Policy phải bind patient/capsule/version, người yêu cầu, lý do, TTL, nonce/request ID và receipt thích hợp; không chỉ kiểm tra tag `emergency_record` chung cho mọi bệnh nhân. `emergency=true` hay một receipt có byte bất kỳ trong DB không phải bằng chứng được Fabric chấp nhận.

`K_emergency`, `K_record` có thể là tên trừu tượng trong thiết kế. Không triển khai chúng thành khóa bí mật cố định do backend giữ, hoặc gửi raw key qua REST.

### 4. Mandatory audit cần gắn với việc cấp authority

Ghi `BREAK_GLASS_ATTEMPTED`/request trước; chỉ ghi authorized khi policy thật đã thành công. Backend trả ciphertext không chứng minh browser đã giải mã hoặc con người đã đọc. Tách event cấp quyền với client-reported display/read nếu cần.

Nếu muốn chống backend bị compromise bỏ qua log, policy/decrypt cần ràng buộc receipt đã được xác minh, không chỉ có câu lệnh “write audit rồi return”. Cơ chế kết nối receipt với Fabric là công việc chưa có.

Audit fail: không cấp quyền mới nếu quy trình yêu cầu receipt; denied request vẫn phải bị deny khi logger lỗi. Notification qua outbox/retry, không lấy việc SMS thành công làm điều kiện mở capsule. `BREAK_GLASS_EXPIRED` cần job hoặc quy tắc ghi nhận rõ ràng, không tự xuất hiện nhờ enum `EXPIRED`.

### 5. Hash-chain và checkpoint local chưa chống người quản trị sửa toàn bộ lịch sử

Schema `audit_events` có hash/signature và trigger chặn UPDATE/DELETE; chưa có code tạo hash canonical, xử lý ghi đồng thời hoặc kiểm tra chain. Column có dữ liệu không chứng minh signature hợp lệ.

Cần signer/verifier, sequence serialization, checkpoint ngoài DB trust domain và quy trình kiểm tra suffix truncation. File checkpoint trong cùng server chỉ đủ mock; không gọi là independent immutable anchor. Ghi rõ cửa sổ chưa anchor và giới hạn availability.

### 6. JWT, role và DPoP phải khớp phiên bản SDK thật

Dev đã kiểm tra JWT qua JWKS và issuer/audience; chưa có DPoP proof verifier. Guard nhận Bearer, frontend demo dùng `fetch` với Bearer. SDK 0.13.33 README lại ghi DPoP bật mặc định, khác comment “opt-in” trong starter. Cần thiết kế `secureFetch` và resource-server proof verification tương thích, kiểm thử thực tế; không tắt DPoP để che lỗi tích hợp.

Chốt issuer, audience/authorized party, thuật toán và policy bắt buộc `exp`; role routing ở frontend chỉ là UX. Với mọi endpoint mới, gắn role metadata và kiểm tra object owner/scope. `RolesGuard` hiện cho route không có role metadata đi tiếp sau JWT guard, nên không được mặc định rằng mọi health endpoint đều đã hạn chế nghiệp vụ.

`proxy.ts` hiện log `ctx` chứa token ở failure path. Cần bỏ token khỏi log trước khi thử tài khoản thật. Đánh giá này chưa sửa code auth hoặc thay đổi config realm.

## Những phần kỹ thuật cần xử lý sớm trên dev

1. Root `tsconfig.json` include `**/*.ts`, đang kéo API NestJS vào compiler frontend. Đề xuất exclude `api` ở root, giữ compiler config riêng cho API. Đã thử và typecheck qua trong bản sao tạm.
2. README yêu cầu `docker compose`, nhưng `docker-compose.yml` bị ignore và không có trong remote tree. Trong lúc đánh giá đã thấy bản `docker-compose.yml` local untracked, gồm postgres/api, nhưng checkout main chưa có `api/` và `database/` mà compose tham chiếu. Không sửa file local này. Cần đồng bộ trên dev và commit compose không chứa secret, chỉ interpolate env; giữ file `.env.docker` private.
3. API `start:dev` gọi `nest` nhưng chưa khai báo `@nestjs/cli`. Bổ sung tooling hoặc đổi sang phương án watch đã được cài. API chưa có lock file; cần lock dependency để build lặp lại.
4. `cors:false` ở API: cần Next same-origin proxy/BFF hoặc CORS allowlist cụ thể cho frontend. Không mở wildcard kèm credentials.
5. API đang dùng một pool `app_runtime`; role này không có quyền insert audit. Cần writer kết nối riêng hoặc cơ chế transaction/outbox được thiết kế, không grant bừa quyền sửa/xóa audit để tiện.
6. Schema cần enforcement ở service và/hoặc composite constraint: current_version thuộc đúng record; record scope thuộc đúng patient; recipient grant khớp doctor/requester; capsule thuộc patient của emergency request. Các FK hiện riêng lẻ chưa bảo đảm các quan hệ này.
7. `principal_roles` trong DB không được trở thành nơi backend tự nâng crypto role; role quyết định vẫn lấy từ danh tính/quyền đã verify. Thay đổi role thật cần flow quản trị tương ứng.

## Thứ tự phát triển đề xuất

| Ưu tiên | Deliverable | Điều kiện hoàn thành |
|---|---|---|
| P0 | Chốt dev làm integration base, sửa build isolation/compose/tooling | Frontend + API build, DB health trên clean clone; không reset data |
| P0 | Crypto spike hai identity + policy | Người khác không decrypt trước approval; đúng doctor đọc; sai doctor/expired request bị Fabric từ chối |
| P1 | Principal mapping + patient Emergency Capsule | Owner từ token; client encrypt; API chỉ nhận ciphertext; patient CRUD/versioning hoạt động |
| P1 | Audit writer tối thiểu + trusted receipt design | Request/decision riêng; không log token/PHI; allow path có receipt hợp lệ |
| P1 | Full record + normal consent | Scope, TTL, recipient, version; renew tạo version; revoke có giới hạn được ghi rõ |
| P1 | Doctor dashboard | Chỉ liệt kê/đọc record được cấp scope; API độc lập chặn direct requests |
| P1 | Break-Glass capsule-only | Reason bắt buộc, emergency role, TTL ngắn; Full Record luôn deny ở path này |
| P2 | Notification worker + patient audit + auditor | Retry idempotent, không chặn cấp cứu vì notification outage; auditor không đọc clinical plaintext |
| P2 | Chain verifier + external anchor demo | Sửa/xóa/rebuild local history bị phát hiện bằng checkpoint độc lập; mock ghi rõ là mock |
| P2 | Demo/README/video | Chỉ dùng synthetic medical data; phân biệt chức năng thật, mô phỏng và giới hạn |

Không cần xây tất cả dashboard trước spike crypto; nếu không chia sẻ giải mã được qua policy thì UI consent/BTG sẽ không chứng minh đúng premise của Challenge 2.

## Acceptance tests cho MVP

Các ca dưới đây là **kế hoạch kiểm thử**, chưa chạy thành công trừ build/typecheck đã ghi ở trên.

| ID | Ca kiểm tra | Kỳ vọng |
|---|---|---|
| AUTH-01 | Thiếu/sai chữ ký/issuer/audience/expired token | 401; không query clinical plaintext |
| AUTH-02 | Đúng token, sai role | 403 kể cả gọi API trực tiếp |
| AUTH-03 | Copy sender-constrained token thiếu/sai DPoP proof | Resource server từ chối; không fallback Bearer lỏng |
| OWN-01 | Patient A dùng ID của patient B để ghi/đọc | 403/404 theo quy ước, không rò payload |
| CRYPTO-01 | Lưu capsule/record | Network request/backend/DB không có clinical plaintext hoặc raw DEK |
| CRYPTO-02 | Doctor chưa được patient cấp quyền | Không decrypt được qua cả app và direct SDK |
| CONSENT-01 | Đúng doctor, đúng record/scope, còn TTL | Giải mã được, có receipt/event đúng |
| CONSENT-02 | Sai recipient/record/version/type hoặc TTL hết | Không có authorization result mới |
| CONSENT-03 | Revoke rồi dùng cached ciphertext + policy cũ | Hành vi đúng với cam kết revoke đã chốt; nếu vẫn đọc tới expiry phải ghi rõ |
| BTG-01 | Emergency Doctor + reason hợp lệ | Chỉ mở đúng Emergency Capsule trong TTL |
| BTG-02 | Doctor thường hoặc thiếu reason | Deny và ghi request/decision thích hợp |
| BTG-03 | Emergency grant dùng lấy Full Record | Luôn deny trong MVP |
| AUDIT-01 | Audit receipt/signature không hợp lệ hoặc writer fail | Không cấp quyền mới nếu policy bắt buộc receipt |
| AUDIT-02 | DBA sửa/xóa/truncate/rebuild chain local | Verifier phát hiện so với independent checkpoint đã chốt |
| NOTIFY-01 | Notification service down/retry | Không gửi trùng quá mức, không chứa diagnosis; không biến notification thành auth gate |
| GOV-01 | Một app/DB admin tự sửa consent/role metadata | Không tự tạo được crypto authority; chỉ tuyên bố sau khi test thật |

## Việc đã làm trong lượt đánh giá

Đọc cả nhánh main/dev, tài liệu của nhóm và SDK đã cài; cài dependencies frontend; kiểm tra TypeScript/build main và compile API trong bản sao dev tạm. Chỉ thêm báo cáo đánh giá này; chưa merge dev, chạy `npm run init`, sửa realm, tạo user, tạo database hoặc gửi thông báo. Chưa chứng minh threat model E2E bằng runtime test.
