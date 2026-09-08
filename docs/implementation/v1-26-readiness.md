# V1-26：真实接入最小就绪交接

日期：2026-09-08（Asia/Shanghai）。状态：`WAITING_OWNER_INPUT / LIVE NOT RUN`；#26 保持 OPEN。
核对基线：`ticket/v1-26`，`c710c9968c126fa3cec2b326cfa4bcf1489f8a1e`。Root 交接 #1–#25 已实现、接受、集成并 CLOSED；本次未访问 GitHub。
本次按 implement 技能提交文档；Owner 快速 V1 与本次明确范围覆盖技能的测试、全套回归和另派 reviewer 要求。仅阅读必要代码/文档并静态检查提交范围，没有 typecheck、test、build、产品/Provider CLI、模型、SMTP、Docker、S3 或网络探针，也未读取 Owner 数据、秘密、个人认证文件或 `QQ_SMTP_KEY` 值；未做开发 hash 验收。

## 已知授权与已有证据

- [Owner 输入](../planning/v1/OWNER-INPUTS.md)已批准本机现有 Codex 真实测试且不设额度上限；进程时限、调用轮数、取消及用量边界仍保留，不因此授权购买资源或额外 API 账单。
- 历史只读记录为 Codex `0.153.4`、`Logged in using ChatGPT`，尚未发起真实模型请求。本次未刷新 CLI/登录状态；资格、部署身份与隔离均未由登录证明。
- Claude 当前为 `owner-deferred / NOT VERIFIED`，按 Owner 决定跳过真实测试，不索要 Claude 凭证，也不宣称双 Provider 通过。
- QQ 授权码已经提供且获准使用，同一邮箱发件/收件；2026-09-05 一封 SMTP 预检获得 AUTH 235 / DATA 250，2026-09-06 Owner 确认实际收件与中文显示。依据为上述 Owner 记录；本次未重发。该历史证据不等于当前产品 HTML、PDF、链接、附件或目标部署实测。

## 当前代码接线事实

- [production-runtime.ts](../../src/production-runtime.ts)只为启用且 live 账户/地区资格在有效期内的 Provider 装配 Runner；Codex 使用 `OBSERVER_OPENAI_API_KEY`，Claude 使用 `OBSERVER_ANTHROPIC_API_KEY`，支持各自 `_FILE`。固定模型分别为 `gpt-5.6-sol` / `claude-sonnet-4-6`，CLI 运行在现有容器与受控 API broker 边界。
- [runtime-secrets.ts](../../src/runtime-secrets.ts)使已配置秘密文件成为权威输入，失败不回退旧环境值；代码不会复用本机个人 Codex 订阅 OAuth 登录。`runner-configured` 只表示接线状态，状态明确返回 `actualConnectivity: not-probed`。
- [本地示例](../../config/runtime.example.v1.json)与[部署示例](../../deploy/runtime.example.json)的 Provider 集合为空，日报/采集/邮件关闭。[来源示例](../../config/sources.example.v1.json)为 `pending` 且禁止采集，`source.example` 是占位域名；已提出的真实来源仍待批准，不能直接启用。
- [备份示例](../../deploy/backup.example.json)关闭且 endpoint/region/bucket/owner 均为占位值；最新来源策略、删除契约和独立备份密钥均是实际恢复输入，缺文件不能解释为空契约。

## 最少待确认的 Owner 非秘密输入

1. **实际 Codex 路径及国家/地区**：Root 已询问优先本机 native Codex 还是当前专用 API 入口，尚无答案；同时需要本机执行所在地，以及目标节点所在地和适用账户资格。若选现有 API 入口，需要明确该账户/API 计费授权及专用凭证已就绪的私人路径，不能沿用本机订阅授权代替。
2. **目标 Linux 节点及私有服务地址**：可操作的主机标识、Linux amd64 环境、授权管理入口、域名/HTTPS 地址及 DNS/证书/部署操作范围。地址和接入细节仅交私人配置；不在公共提交填写邮箱或管理凭据。
3. **获准真实来源及最新权利输入**：选择实际 origin，明确采集、存储、模型处理、引用、分发及保留/删除许可，提供当前已审 SourceConfiguration 的私人路径。没有合规社交源时保留缺栏；不能用 pending proposals 或测试 fixture 抵扣。另须最新 `observer-rights-suppression` 契约；确无删除记录也需 Owner 明确提供空契约。
4. **私有节点外存储与独立秘密的就绪交接**：已获授权的 S3 endpoint/region/bucket/prefix/expectedBucketOwner，以及私人凭证和独立恢复密钥的保存路径/保管方式，不索要秘密值。需独立 32 字节备份密钥、Owner 管理 token 和恢复环境 token；确认可使用私有桶、干净恢复环境及相关费用/操作范围。桶须支持 #24 所需 API、完整 PublicAccessBlock，且无版本历史、Object Lock 或复制。
5. **现有邮件输入的产品接线与人工检查安排**：复用已确认的发件/收件邮箱和已提供授权码，确认它们在所选运行环境的私人配置/秘密路径；提供产品链接使用的授权 HTTPS 地址和实际 PDF/邮件检查时段。缺的是部署接线与本次成品证据，不是 QQ key 或重复的发信授权。

## 若 Owner 选择 native Codex

现有 `codex-cli` 名称指容器内 CLI，不是已实现的宿主 native 登录入口；这不是改一个配置开关即可使用的路径。本次不选定路径、不适配、不复制或读取 OAuth/订阅认证文件。
最小影响面：入口装配 [production-runtime.ts](../../src/production-runtime.ts)；研究/语义复核 [codex-runner.ts](../../src/codex-runner.ts)、[semantic-verifiers.ts](../../src/semantic-verifiers.ts)及其 [agent-container.ts](../../src/agent-container.ts) 执行边界；执行身份契约 [agent-execution.ts](../../src/agent-execution.ts)、[contracts.ts](../../src/contracts.ts)；live 接收规则 [shadow-evaluation.ts](../../src/shadow-evaluation.ts)。
当前 live 成功结果必须具有对应 CLI 身份、`openai-api` / `anthropic-api` 传输、容器 ID 与 `cleanup: removed`；native 结果不能伪填这些字段。选择 native 后须先完成适合该路径的执行/终止/秘密隔离与元数据适配，再接 #26/#27；CLI 自身使用已有登录，不转移认证文件。

## 输入齐备后的单次有界 live 顺序（本次不执行）

1. 按 Owner 选定路径准备私人配置；记录实际源码 release、配置/Schema、来源政策、CLI/模型、评分及评测规则版本，限定一次批次和原有时限/调用边界，不新增开发 hash 验收。
2. 在获准目标 Linux 环境完成私有启动与选定 Provider 的真实运行，观察网络/工具权限、超时终止和秘密隔离；只采集已批准真实源，生成六栏含缺口报告。保留失败和缺栏，Claude 继续明确延期。
3. 检查鉴权读取、未鉴权拒绝、签名过期、设备撤销；取实际长文 PDF，由 Owner 检查中文、分页及链接。执行本批产品邮件，分别记录 SMTP 受理、可获得的投递证据及 Owner 收件箱 HTML/链接/附件确认；未知状态不盲目重发、不代签人工。
4. 检查真实对象存储私有性并备份；记录真实演练起点后恢复到新命名的干净隔离环境，应用最新来源/删除契约，使用恢复实例完成私有读取。沿 #24 测量 RPO ≤24h / RTO ≤4h；恢复文件生成不等于服务恢复通过。
5. 汇总该批各类别实测/失败/未验证状态，满足 #26 后才交给 #27。#27 仍需真实 Provider 接线、独立持久调度、首日运行和 Owner 核定规则/人工责任；#28 仍需连续 14 天事实与人工审核。

## 可恢复输出与能力边界

- 以下沿现有说明的路径均为**待部署示例，尚未创建**：[v1-23](v1-23.md) 的 `/srv/observer/data` 保存报告/任务/邮件状态；`/v1/briefs/<date>` 与 `/v1/reports/<version>` 定位同批可读产物。
- [v1-24](v1-24.md) 的 `/srv/observer/backup-control` 保存收据和 `drill-<id>.json`；`/srv/observer/restores/<drill-id>/{data,config}`、`manifest.json`、`restore-receipt.json` 保存本次隔离恢复结果。续接沿用原 drill ID/事故起点，不重置计时或覆盖原数据。
- [v1-25](v1-25.md) 的 `/srv/observer-shadow/evaluation/shadow.sqlite` 保存 campaign/batch/jobs/attempts；#27 启动后按 campaign ID 读取 status，再接续未完成 attempt。正文按来源最短 TTL 处理，人工核查须在材料过期前完成，长期仅保留脱正文统计。
- 本轮唯一产物是此就绪文档。真实模型、来源、Linux 容器、产品邮件/PDF、私有访问、S3/恢复和隔离均未在本轮测试；#24/#25 历史块末类型错误修正后未重跑的限制仍以各自说明为准，本轮不补写 PASS。
- 一次真实运行不构成 14 天 PASS，历史 QQ 预检不构成本批产品实测，工具不能代签人工；#26 尚未验收，#27 真实接线/持久启动与 #28 发布门均未完成。下一步等待上述最小输入，由 Root 接续。
