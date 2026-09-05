# V1-06 — 六栏编排、Today Overview 与唯一正文

状态：ready-for-agent · 已发布：[GitHub #6](https://github.com/yiwer/Observer/issues/6)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-06 -->

规划 ID：V1-06 · 类型：implementation

## What to build

将通过核验的候选组成六个 Edition 和 Today Overview，生成唯一版本化 Canonical Markdown；有证据不足的栏目时仍可得到结构完整、缺口清楚的私有日报。

## Acceptance criteria

- [ ] 世界要闻、AI、财经、科技前沿、社交话语观察、GitHub 六栏均有位置，总览引用每栏首要内容或缺口。
- [ ] 候选充分时按约 7 条、约 3 条重点组织；不足时保留实际条数和原因，不用低质量材料凑数，Impact Note 的专用位置不占普通配额。
- [ ] 简体中文正文保留必要外文名称；重点说明事件、意义、影响路径和未知，篇幅采用 PRD 软目标，整期没有阅读时长硬限制。
- [ ] Final Editor 仅接触已经校验的 Report Record，不联网、不运行 shell；成稿新添或变更事实时重新被核验或拒绝，不能靠提示词承诺内容一致。
- [ ] 成稿中的标题、数字、证据链接、状态与 Report Record 可核对；总览是该版本内容的导航子集，而非独立研究产物。
- [ ] 从六栏足量、少量、全空和单栏异常的固定输入生成并读取最终正文，覆盖来源许可优先于篇幅目标。

## Blocked by

- #3 — V1-03 — 陈述级证据核验与 Publication Gate

## Scope boundary

这里实现六栏共同编排；跨天去重、主题特有判定、真实专用采集和邮件分别追加。

## Decisions and evidence

固定 Report Record 到 Canonical Markdown 的版本/校验契约，供并行呈现和同步票使用。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-1、US-2、US-3、US-4、US-5、US-6、US-7、US-9、US-10、US-54。
- PRD 行为验收：AC-01、AC-15。
- 参考分支：D1、D2、D7、D9。
