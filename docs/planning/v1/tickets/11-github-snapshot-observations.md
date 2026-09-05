# V1-11 — GitHub 候选、稳定身份与真实快照增量

状态：ready-for-agent · 已发布：[GitHub #11](https://github.com/yiwer/Observer/issues/11)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-11 -->

规划 ID：V1-11 · 类型：implementation

## What to build

利用官方允许元数据发现候选、按稳定仓库身份采集快照，并在 GitHub Edition 中呈现真实 24h 净变化、冷启动或缺样状态。

## Acceptance criteria

- [ ] 官方 API 搜索/仓库元数据形成有限候选集合；用 node ID 关联改名/转移，排除私有、不可访问、archived、disabled、fork、mirror、template，无法判断风险时隔离。
- [ ] 每小时观测累计 stars/forks，固定满足 07:30 截稿的调度相位；当前 ±15 分钟、历史 ±60 分钟容忍中仍只使用截止前已可用观测。
- [ ] 24h 净增严格来自两个快照并展示实际时间；正、零、负值都正确，历史不足独立标为 Cold-start Heat，其他缺样不混成冷启动或正式增量。
- [ ] 搜索分页不完整、限额、权限/凭证到期与网络失败在成稿可见；不声称候选覆盖全 GitHub，也不叫官方 Trending。
- [ ] 只读且有期限的 PAT 通过秘密配置传入并脱敏；不克隆或执行候选代码、不下载二进制。
- [ ] 固定 API 样本到快照、身份历史及归档中的 GitHub Watch Item 有可回放测试；观察记录能供后续排序重新使用。

## Blocked by

- #6 — V1-06 — 六栏编排、Today Overview 与唯一正文

## Scope boundary

发现与观测到报告的闭环；暂不实现正式综合排序、历史报道衰减或事件绕过。

## Decisions and evidence

落实观测相位、样本挑选和不完整状态契约，特别覆盖恰好截稿及仅有未来观测的反例。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-29、US-32、US-33、US-35、US-38、US-39。
- PRD 行为验收：AC-07、AC-18。
- 参考分支：D8、ADR-0003、research:github。
