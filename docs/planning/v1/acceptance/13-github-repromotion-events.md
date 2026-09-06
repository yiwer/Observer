# V1-13 执行与待验收记录

状态：in-progress；fresh作者与有界官方资料research已启动，尚在亲读/方案阶段，未批准产品实现或参数。GitHub #13 OPEN。

## 固定任务与依赖

- [本地票](../tickets/13-github-repromotion-events.md) / [GitHub #13](https://github.com/yiwer/Observer/issues/13)正文、空评论已实际读取。原生唯一依赖#12已在2026-09-06T04:00:51Z关闭，Root重新读取关系为closed。
- #12最终实现41020f40a424d00b868085822796cdee32b6599d、实际master集成2d93d40a463af7fd64485383dca32ff92a64ebb0均可达；作者/Root detached/实际master各306/306与smoke3/3，双轴及全部回放见[#12记录](12-github-heat-and-novelty.md#实际master验收与关闭)。
- 固定base **ec9b91c3e8575f7f3f3dc363d1d35ffb6319fce3**；Root确认路径/分支不存在后创建`O:/GenesisCode/Observer-worktrees/v1-13` / `ticket/v1-13`并实核clean。
- fresh `/root/implement_v1_13`为唯一产品作者。另有fresh `/root/research_v1_13`按research skill核查官方Release/GHSA等接口、关联和授权/可用时刻证据，仅写该树`docs/research/github-repromotion-api-contract-2026-09-06.md`，不stage/commit；写入范围与产品作者互斥，作者须亲读研究再制定方案。
- Root已将#13分配给`yiwer`并单次发布[启动说明](https://github.com/yiwer/Observer/issues/13#issuecomment-5556791129)，随后通过独立comment API实读完整body/id/url，并实读票为OPEN、assignee为yiwer；此为启动回写，不是实现或验收通过。

## 待先行确认的实施边界

三类重大进展均需来源证据、稳定事件及实质修订身份；stable Release不自动等于重大变更，不从package名字猜仓库，不把未知安全信息视为安全。极端再次增长的分位/最小样本与事件竞争须独立固定回放后冻结，研究例子不是参数批准。

只在实际成功出版的最终事务消费一次性事件，重复采集/重试/改名/编排不重复消费；仍满足至少ceil(actual/2)过去30天未报道位置，质量不足缩数并明确选择/来源/历史缺口。若业务语义与批准规则冲突，回到Root/Owner，不静默放宽。安全项只作影响范围/证据明确的风险更新；不执行项目代码、不另造安全扫描器。

作者须亲读implement/TDD/tests/mocking/codebase-design、CONTEXT、票/PRD D8/T1/AC-09/ADR0003、当前#11/#12实现及研究，先回报局部Interface/契约增量、来源收据与最终同步事务、事件规则/参数回放与第一条公开tracer；Root确认后才逐片产品RED→最小GREEN。

## 兼容及安全

已接受Request1–8/Record1–9/Version1–8/Canonicalv1–v7与`observer-github-heat-v1`旧评分/字节不原地改；Report SQLite v1、GitHub application_id1329746759/v1不擅迁移。新Schema、采集Interface、持久结构或多票契约须Root协调单一写入者。保留50有界候选、当前来源权限、逐跳网络/稳定身份、截止可用时刻与失败不复活旧good规则，不接收Request/Agent自报历史或权限。

Root持有29旧调用、Record7两刊/Record8四刊、20项#12专项/13旧GitHub专项/Spec9组以及新Record9五刊固定oracle。Record9基准`O:/GenesisCode/Observer-worktrees/accept-v1-12-r2/data/root-v1-13-compat-41020f4`，baseline SHA **e69381dd7517c8d6fd524842f904d82b5f2be3a9bfad27b3782063378e154f88**；reader `Observer/data/root-v1-12-review/verify-record9.mjs` SHA **2e624b6be9343864f598d2c697d6f18e16f272cb3acfdb6e96f368dfbe24ab14**。禁止重freeze/改期待/删除原档。

不读取PAT/QQ_SMTP_KEY或无关`.idea/`，不调用真实候选/Provider/SMTP，不部署/购买/push/启用生产。QQ既有单封实际收件确认不重发，Claude live延期。新TEMP仅指定data；固定Docker镜像与Root串行，整次NoSuchImage失败保留并只读核查后同SHA新目录整跑；不升级/rebuild/retag/restart/prune，不清理原data/被拒目录/退出容器。具体固定身份和安全边界继承[#12](12-github-heat-and-novelty.md)与[执行入口](../EXECUTION.md)。
