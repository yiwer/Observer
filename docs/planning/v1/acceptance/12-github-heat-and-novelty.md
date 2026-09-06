# V1-12 执行与待验收记录

状态：**in-progress；fresh implement 作者已派发，先确认局部Interface/评分参数回放方案；尚无产品变更或验收结论**。GitHub #12 OPEN / yiwer。

## 固定任务与依赖

- [本地票](../tickets/12-github-heat-and-novelty.md) / [GitHub #12](https://github.com/yiwer/Observer/issues/12)正文、空评论已实际读取；原生依赖恰为#8/#11，均CLOSED。
- #8已验收集成 **8079271c3cc2911257f5a54153b3ec16969c6b67**、#11已验收集成 **867e500431886e1d876066c950f3a880b38f81f8**均在base可达。#11最终候选/冻结/实际master全部证据见[#11记录](11-github-snapshot-observations.md#实际-master-验收与关闭)。
- 固定base **48d4767561459db66575125d18c8a89dce185068**，专属 `O:/GenesisCode/Observer-worktrees/v1-12` / `ticket/v1-12`。Root已核对不存在旧同名worktree/分支后创建并验证clean。
- 新上下文 `/root/implement_v1_12` 实际spawn成功，不复用#11作者。已告知亲读implement/TDD/tests/mocking/codebase-design及领域、PRD D8/T1、ADR0003、本票/当前#11契约/官方元数据研究，先回报方案、Root确认后才实施。
- [启动回写](https://github.com/yiwer/Observer/issues/12#issuecomment-5556371220)已单次发布，Root经独立API读回完整正文、ID与URL；Issue已读回OPEN/yiwer。

## 实施边界与先行协调

普通热度与历史报道降权：语言/年龄cohort、显式topic兴趣，不限制语言、不让累计stars独自主导；冷启动与实测动量分区标识；稳定node历史，7天冷却后30天线性恢复、90天频率惩罚；正常位置至少一半给过去30天未报道项目，候选/质量不足减少数量。须记录评分版本、函数/参数、全体评分输入/排名与选择理由，能用出版时保存输入重算。

技术方案需先明确精确边界、奇数取整、小cohort回退、质量阈值、参数比较与偏差指标，回放验证后冻结；历史研究示例不是已采用算法。参数回放是合成输入验证，不冒充用户满意度/真实噪音率。#13 Release/GHSA/重大动量一次性绕过及#22保留清理不提前实现。

#11 `snapshot(cutoff)` 已是最多7个Watch Item的出版投影，#12不能只对这7个排名却声称比较全部候选。Root要求在观察Module内部复用实际截止前完整合格候选、保留现有可用时刻/来源/失败约束；新增公开Interface、Schema/正文或持久结构先协调单一写者。报道历史只来自实际成功出版，并明确截止因果、当前来源权限和失败/重复的原子性。

沿Owner已批准T1公共观察→真实SQLite→produce/鉴权readReport→重启seam逐条RED→最小GREEN；不写私有helper/SQL旁路断言，不重新询问已批准测试边界。首片和评分实现均等待作者方案，不把派发等同于已完成功能。

## 兼容与安全

基线完整check282/282、smoke3/3子集。旧Request1–7、Record1–8、Version1–7和Canonical旧v1–v6正文原字节保持；Report SQLite user_version1、观察库appID1329746759/v1的变更须显式协调。权限/配置版本、逐跳DNS/路由、最小资源限制、受限secondary403读取、身份确认与数值资格分离、截止前当前失败不复活旧good数值等不放宽。

Root持有29次旧业务/Record1–6九刊oracle、Record7两刊，以及GitHub13项原期待；新增Record8四刊基准 `O:/GenesisCode/Observer-worktrees/accept-v1-11-r2/data/root-v1-12-compat-14f6889`，baseline SHA **ec54671f5c22b72661cf19037e8f4c95211a66ed68d7c78937e292f240d73638**，reader SHA **4a6c7ea75cd19d5d30aa7c4b2ed7e95aeac17676c612873c8af3e9a0069308d2**。禁止重freeze、改期待或删除归档；正式回归须用新built绝对路径读取。

本票不读真实PAT/auth/env秘密/QQ_SMTP_KEY或无关`.idea/`，不请求真实GitHub/Provider/SMTP，不部署、购买、push或启用生产。QQ既有单封预检和Owner中文收件确认不重发；Claude live延期。固定Docker/镜像约束与历史拒绝cleanup见[执行入口](../EXECUTION.md#保留的测试证据与禁止重试清理边界)及#11记录。作者与Root串行Docker；只读短标签失败需保留整次失败，新目录同SHA整次重跑，不拼接PASS。所有新TEMP定点自身data，旧证据不清理。
