# V1-07 执行与待验收记录

状态：**已启动 fresh-context 实施，未冻结、未验收**。GitHub #7 OPEN，assignee=yiwer。

- 范围：[GitHub #7](https://github.com/yiwer/Observer/issues/7)、[本地票](../tickets/07-event-history-and-updates.md)。
- Fixed base：`5da81976dd2ba166066977c038e6f46451890283`，包含 #6 最终接受、集成与关闭记录。
- Worktree：`O:/GenesisCode/Observer-worktrees/v1-07`；branch：`ticket/v1-07`，创建时 clean。
- Fresh-context `/root/implement_v1_07` 已实际创建成功，不复用作者或 review 会话；要求亲读 implement、TDD/required references、domain-modeling（必要格式）、CONTEXT、PRD/ADR 和票据。
- 唯一原生依赖 #6 已实际读回 CLOSED，closedAt `2026-09-05T11:29:58Z`；#7 dependency API 也返回 #6 closed。
- [启动回写](https://github.com/yiwer/Observer/issues/7#issuecomment-5551477565)已发布并读回；#7 OPEN、assignee=yiwer。

## 范围与判定边界

建立可追踪 Event Cluster、主 Edition 决定、跨栏 Impact Note 与新闻事件历史；同一事件只完整展开一次，其他栏的 Impact Note 不占普通/重点配额。相似词但独立事件不强行合并；Agent 可建议，任意 ID、相似度或自报布尔值不能成为未经核验的聚类/新颖性权威。

分别记录事件发生、首次公开披露、首次发现与实质进展时间；旧事件今日披露可以入选，无新进展仅换标题不能重复；重大漏采仍有价值才补报，并明确标签，不捏造未知时间或伪装新发生。实施须先收敛可执行新进展/补报判定表及冲突案例，写在本票实施/技术说明；词汇表仅保留领域定义，不塞入实现细节。

按已确认 T1 公开 `createObserver.produce → readReport` 逐片 TDD，真实 SQLite，外部 Runner/Verifier/来源/时钟可替换。通过连续多期生产、关闭/重开后再生产读取，观察历史影响和旧版字节不变；不以内置私有方法/内部 mock/SQL 旁路替代业务断言，也不为测试擅建未确认业务入口。

保留既有六栏 7/3 软目标、Record→唯一 Markdown、纯确定性 Final Editor、来源字段/模型与分发许可、逐批/最终 TTL、整期引用额度、私有鉴权和生产 fixture 隔离。新闻聚类不能绕过 Publication Gate，或把未确认/隔离内容升级成事实。若演化 Schema/SQLite，须显式兼容、原子迁移、未知新版本拒绝；旧 Record v1/v2/v3 和已出版正文不能静默重写，采集缓存不混为报告数据库迁移。

本票不实现 GitHub 仓库主键/热度/升权、兴趣配置、主题专门规则、真实 Provider 路由、PDF/邮件/Android、纠错新版、日刊调度或部署。真实来源/模型/人工判断资格与固定回放分开。

## 环境、安全与证据

既有基线 **130 项**，smoke 3 项是子集，不冒充新票结果。固定 Linux Codex 0.153.4 与 Claude 2.1.252 运行依赖和无凭证模型协议替身保持；宿主 Claude 2.1.261 不替代 Linux 资格。不升级 CLI、不重建/改标签/重启 Docker 或改全局配置；其它项目资源与用户 `.idea/` 不动。

既有首次 Claude tag inspect 偶发 No such image 的失败记录保留、根因未知；最近 #6 最终冻结及集成 full check 都首跑通过。若再遇到，等待实际终态并区分环境 setup 与产品结果，记录只读核对/同 SHA 定向和全量复跑，不拼接成 PASS。

本票不读 Owner 秘密、认证文件或邮箱，不触发真实模型/SMTP/云资源。QQ 单封预检已由 Root 完成（SMTP accepted / inbox unconfirmed），禁止重发；本机 Codex 真实测试地区资格和延期 Claude 实测由 Root 分别处理。

绝对禁止触碰或换工具重试清理：

- `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`
- `O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c`
- `C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`

Root/其它 reviewer 的各工作区 `data/` 证据也不归本作者所有，尤其旧归档基线、#6 独立 probes 与 `v1-06/data/spec-73c95da-independent`。使用自己新建的测试目录，不清理旧证据。

## 后续验收

作者先回报契约/判定表思路和首片 RED→GREEN；定期 typecheck/单文件验证，代码与实施说明一起提交冻结，再运行完整 check/smoke。Root 固定非空三点 diff，独立 Standards/Spec 双轴、detached 专项与历史兼容、实际 master 集成复跑后才接受/关票。当前没有 #7 测试计数或最终提交，不拿 #6 130/130 代替。

## 已沟通的技术方向（尚未冻结或验证）

作者已亲读所需指导与项目规范，提出沿用现有 SemanticVerifier，在明确版本的回执中增加与事实 Claim/输入摘要关联的 event assessment，研究输出只建议 Claim 引用和主栏。确定性流程核对已通过 Gate 的事实/来源时间及关联，再从不可变已发布 SQLite 行重建本地历史、比较事件与进展；不将历史原文重新发给模型，也不增加测试专用业务入口或无必要的存储迁移。拟用新的六栏请求 v3 选择事件感知语义，保留既有输入与 canonical-v1 读取；具体 Schema/规则待首片验证，不能将此方向当成已经落地的事实。

Root 允许在当前票范围内按 T1 竖切推进，并要求：事实性的身份/时间不能只凭分析或自报布尔值授权；未知时间保持未知，不用发现时间冒充首次披露；缺失/错配/冲突的事件评估不能回退到任意 candidate.eventClusterId；历史回放不能偷用未来日报，有界截断不能被解释为“未报道”；错误合并的后续可追踪处置不重写旧正文，正式 Correction 仍属后续票；历史数据不能绕过来源模型许可。先跨栏同事件的一条 RED→GREEN，再逐片补判定表，不预先横铺全部测试。
