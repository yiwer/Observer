# V1-07 — Event Cluster、跨栏去重与跨日报更新

状态：ready-for-agent · 已发布：[GitHub #7](https://github.com/yiwer/Observer/issues/7)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-07 -->

规划 ID：V1-07 · 类型：implementation

## What to build

同一事件只在主 Edition 完整展开，其他栏看到不占配额的 Impact Note；跨天只重新报道实质新进展，重大漏采旧闻显示补报。

## Acceptance criteria

- [ ] 多来源和多 Edition 的同一事件形成可追踪 Event Cluster，保存主栏决定与关联证据；相似关键词但独立事件不会强行合并。
- [ ] 从整期成稿观察只展开一次，Impact Note 指向正确主故事，且不改变其他栏的正常条数。
- [ ] 分别保存事件发生、首次公开披露、首次发现和实质进展时间；旧事件今日首次披露可入选，无进展换标题不能重复。
- [ ] Late-discovered Story 仅在仍具重大价值时入选并显式标明补报，不伪造事件或披露时间。
- [ ] 用至少连续多期的回放验证无进展、重大新进展、独立新事实和错误合并的处置；已发布历史及关联可重启恢复。
- [ ] 记录新进展/补报的可执行判定表和冲突处理方式；Agent 可以建议聚类，出版结果仍经过证据与历史约束。

## Blocked by

- #6 — V1-06 — 六栏编排、Today Overview 与唯一正文

## Scope boundary

新闻事件身份与选题历史；GitHub 仓库身份、热度和升权使用专门规则。

## Decisions and evidence

在依赖票开始前固定事件/进展身份契约及边界案例，不以相似度单值替代产品语义。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-11、US-12、US-13、US-14。
- PRD 行为验收：AC-02、AC-03。
- 参考分支：D3、D5。
