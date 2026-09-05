# V1-08 — 可版本化兴趣配置与全球覆盖底线

状态：ready-for-agent · 已发布：[GitHub #8](https://github.com/yiwer/Observer/issues/8)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-08 -->

规划 ID：V1-08 · 类型：implementation

## What to build

Owner 编辑和导入导出配置后，下一次日报按明确偏好选题，同时重大 Global Baseline 事件仍有入选资格，实际语言和地域缺口可见。

## Acceptance criteria

- [ ] 主题、实体、地区、优先级和排除项可以文件导入导出；无效配置给出错误并保留上一有效版本，生效版本写入 Report Record。
- [ ] 固定相同 Evidence 与历史，只修改偏好即可观察排序变化；每次生成固定配置快照，中途修改不偷偷改变正在生成的刊次。
- [ ] 重大 Global Baseline 事件在兴趣排除下仍有入选资格；该底线不越过 Source Policy、证据门或时间窗口。
- [ ] 常规中国、美国、欧盟及其他全球/重大区域影响的多语言候选有可解释纳入策略；缺源与语言盲区在总览或相应栏披露。
- [ ] 提供可审阅的初始配置及边界用例；不读取阅读时长、不从点击隐式学习、不自动改写 Owner 偏好。

## Blocked by

- #7 — V1-07 — Event Cluster、跨栏去重与跨日报更新

## Scope boundary

配置驱动的选题行为，不建网页后台、用户画像或个性化训练系统。

## Decisions and evidence

记录初始 Interest Profile、Global Baseline 判定和排序优先级；不借机修改六栏与不凑数原则。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-8、US-64、US-65、US-66。
- PRD 行为验收：AC-17。
- 参考分支：D1、D3、D6、research:sources。
