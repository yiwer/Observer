# V1-10 固定社交样本的用途边界

`tests/social-discourse.test.ts` 中的观点、账户哨兵、帖子身份、标签、时间、HTTP 响应和失败变体，均为本项目新写的虚构测试材料，不是从 Mastodon 或任何真实社交平台采集、摘录的帖子。`.example` / `.invalid` 地址不可作为真实来源许可。

这些自有材料仅在 Observer 的开发、自动化测试与验收回放中被明确允许：临时处理完整虚构 API 响应、保存虚构键/摘要和匿名观点、交给受控 Runner / Verifier 替身、生成并永久保留测试 Report Record / Canonical Markdown。测试中的 `SourcePolicy.review=approved` 和全用途布尔值只代表这批自有材料，不构成对真实实例、作者、平台账户、真实 Provider、训练或外部分发的批准。

材料可为上述项目测试目的复制与改写。原始材料与永久测试产物的保留权在此分开说明：测试原始材料遵守配置 TTL；已获准的测试派生 Record/MD 可永久留作验收证据，不要求召回不可撤回副本。删除义务未知或要求删除永久衍生物的来源使用反例政策，必须保持关闭。

正常固定响应采用官方 v4.7.1 formatter 所示 hashtag HTML 形状，但观点与标识均为自创。协议依据见[研究记录](../../../docs/research/mastodon-social-sample-adapter-2026-09-05.md)。这些测试没有访问真实时间线、账户、媒体或帖子，没有调用真实模型、生成 PDF 或发送邮件。
