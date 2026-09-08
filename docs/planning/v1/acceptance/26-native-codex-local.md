# #26 子块：本机 native Codex 接线

后续状态：Owner 已确认来源，2026-09-08 真实研究/核验四次成功并生成降级产物；以下为接线完成时的历史快照，当前以[实际补发记录](26-owner-live-2026-09-08.md)为准。

2026-09-08（Asia/Shanghai）。作者 `4320637b9951e12930423560b546bc20b8020f9b`，固定起点 `fe9e7a62c3664e44133ecf64d7d6403d0a75a47d`，本地集成 `f594512`；与 Owner 补发子块合并无冲突。

## 已交付与最少实际观察

- native Windows CLI、Windows Job 生命周期、既有登录、研究/语义复核/路由/生产装配。默认 `gpt-6-astra` / `medium`，不静默换模型，不复制或输出登录文件，不读取新 API key。国家审查已取消，记录 skipped 而非资格 PASS。
- 一次静态 Standards 0、Spec 0；Root 阅读主要执行/配置/路由/协议及合并入口。没有测试、夹具、build/typecheck、hash 验收或重复集成回归。
- 唯一真实 CLI 启动于 `2026-09-08T07:02:53.470Z` 至 `07:02:54.158Z`：683 ms，CLI 0.153.4，exit 1，诊断 `configuration`，terminal missing，进程清理完成。tokens/cost unknown，**没有模型成功结果**。依据官方 Schema 把旧 `tools.view_image` 改为 `features.view_image` 并关闭图像生成，修后没有第二次模型 probe；详见[作者安全记录](../../../implementation/v1-26-native.md)。不能断言该项是唯一失败原因。
- Root 在独立 ignored 私人配置/新 SQLite 路径调用实际本地状态入口成功：native `runner-configured`，指定 Astra/medium，`cli-managed-not-read`，`active=0`、`cleanupUnverified=false`。该状态说明装配成功，不证明连接、模型或沙箱对抗验证通过；没有打开 HTTP 服务或后台循环。

## 当前交付缺口

自动 schedule/collect/email/corrections/patrol 全部关闭，Claude disabled。来源仍为 pending 示例，没有真实采集、今日报告、PDF 或新邮件。Root 已准备私人独立 generate/export/send 操作入口，QQ 授权码在用户环境中的存在性已确认，没有输出秘密；已向 Owner 请求一次确认 [starter](../../../research/today-source-starter-2026-09-08.md) 的最少公开字段白名单，尚未收到回复，不代填批准。

下一步是获批后真实采集和今日补发，集中阅读实际 MD/HTML/PDF，再单次 SMTP 发送，分别记录受理与 Owner 收件。当前 GitHub 仅 #26–#28 OPEN；#26 尚有真实成品、私有访问和灾备等未验证项，本子块不关闭 #26、不启动 #27、不完成 #28。本轮未 push。
