# V1-25 快速交付接受记录

2026-09-08，按 Owner 快速 V1 策略接受并本地集成 `11b2bd3`。作者 `/root/implement_v1_25`，worktree `O:/GenesisCode/Observer-worktrees/v1-25`，base `a976bf8`，功能提交 `35634ad`，集中修复 `c0230ac`。未 push、未启动真实 campaign 或读取 Owner 秘密/数据。

## 交付与验证范围

交付[影子评测工具与接续说明](../../../implementation/v1-25.md)：独立 SQLite campaign/冻结批次、逐 Provider 持久任务与失败续采、完整当前六栏抽样、事实级人工判定、质量/失败/耗时/可获得成本统计、鉴权 HTTP 实际可读观察、来源 TTL/权利维护及受管导出。`npm run shadow -- --config ...` 提供管理入口，默认未启用，不改正式出版或邮件 outbox。

全部 Priority 与至少 20% Watch 抽样覆盖 Completion/Correction 继承栏目及社交/GitHub 独立内容。空事实/缺人工不记 100%，未知成本不补零；模型不可用的链接版不产生模型质量 PASS。规则为待真实核定的固定草案，工具不代签人工审核；#27 承接真实隔离 Provider 接线、每日触发和批次启动，#28 承接真实 14 天裁决。

作者离线安装依赖时未执行安装脚本。唯一一次 typecheck 返回 1，发现可选 server URL、联合证据字段访问及旧 Record 判别收窄三处类型错误；集中静态修正后没有复跑。最终候选不能标为 typecheck PASS。Root 阅读新增模块、完整实施说明与最终差异，没有重复作者检查、新增夹具、hash 验收或逐步/集成回归。

## Standards

一次静态审查：1 项 P2 硬规则问题，已处理。来源策略缺少持久最高版本/摘要，可能在回退或同版改写后重新准入材料，违反 ADR-0005。`c0230ac` 增加永久政策身份表，原子拒绝降版/同版异文；材料到期或来源移除不删除高水位。0 项另行报告的启发式异味。

## Spec

一次静态审查：2 项 P2，已处理。

- completed Edition 中的失败 Agent 回执原被要求具备成功执行证明，阻断合法降级归档。修复后允许失败的未知 CLI/缺容器信息，保留失败身份；成功结果仍严格检查，已提供元数据不得跨 Provider/scope。
- 新增输出/历史更正材料原未收紧批次期限。修复后检查其实际来源/政策及材料时间，在写锁下合并最短 TTL、额外政策和已有另一 Provider 的期限；已过期材料拒绝，旧期限受管导出提前删除。

Standards 原 1 项 P2、Spec 原 2 项 P2 均已处理，未解决发现各 0。Root 另补 1 项 P2：supported 引用的集合不得泛收 task/config/story 等任意 id；现已改为明确普通、社交、GitHub 和 Report Evidence 集合。以上最终修复只核对静态差异，没有新轮 reviewer 或动态复验。

## 未验证与下一门

真实数据形状、Provider 接线、SQLite 崩溃续采、TTL/删除、HTTP/秘密/部署隔离、实际成本、人工分句/语义核查和 14 天结果均未运行；本票关闭不代表生产 PASS。日常调度、来源采集和邮件不会因本票完成自动启用。

#26 仍需确认 native Codex 与当前 API broker 的实际验证方向、主机及地区、获准真实来源和节点外私有存储。Owner 已授权本机 Codex 测试且不设额度上限；Claude 当前延期。QQ 授权码早已提供并获准使用，既往 SMTP 预检及 Owner 收件/中文确认仍成立，不再把“未提供授权码”列为阻断；当前产品 HTML/PDF 实测仍未完成。
