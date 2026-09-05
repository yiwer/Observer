# V1-10 — 合规社交样本到话语观察 Edition

状态：ready-for-agent · 已发布：[GitHub #10](https://github.com/yiwer/Observer/issues/10)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-10 -->

规划 ID：V1-10 · 类型：implementation

## What to build

将一个获准平台的样本转为故事关联讨论和平台原生信号，或在没有合规来源时明确交付 Coverage Gap，始终披露观察边界。

## Acceptance criteria

- [ ] 只启用允许当前采集、模型处理、保留与不可撤回导出用途的来源配置；X/Reddit 等用途未获明确许可时维持关闭。
- [ ] 每组观察包括平台、查询、语言、时间窗口、地域依据、样本量及缺口；未获取的属性显示未知。
- [ ] Story-linked Discourse 指向主 Event Cluster 并描述论点/分歧，不作为故事独立事实证明；Platform-native Signal 达到预先固定门槛才进入候选。
- [ ] 样本不足、偏斜、限流、删除或无合法来源时，成稿明确缺口；不推断总体支持率、人口民意或个体画像。
- [ ] 用批准用途的固定样本演示两类输出和无样本降级，跨采集、核验、成稿验证敏感字段及禁止导出材料不会流入 MD/PDF/邮件。
- [ ] 记录最小采样量、查询范围、隔离与删除规则的技术规格；真实来源开通未完成时标明能力边界，不能用模拟样本证明真实覆盖。

## Blocked by

- #7 — V1-07 — Event Cluster、跨栏去重与跨日报更新

## Scope boundary

一个可替换平台适配器和两类观察；不承诺全网抓取或强制购买社交数据授权。

## Decisions and evidence

真实社交源许可不足允许 V1 显式缺栏；该状态需在上线结论如实保留。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-23、US-24、US-25。
- PRD 行为验收：AC-05、AC-06。
- 参考分支：D5、D6、research:sources。
