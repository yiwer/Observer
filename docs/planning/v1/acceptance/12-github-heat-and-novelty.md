# V1-12 执行与待验收记录

状态：**in-progress；fresh作者已完成指定材料/依赖核实，局部Interface与首条业务tracer已获Root协调确认，正在逐片实施；参数仍待回放评审冻结，尚无验收结论**。GitHub #12 OPEN / yiwer。

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

## 局部Interface及首片协调（未冻结）

作者已报告亲读全部指定技能/领域/票/当前#11实现与官方元数据研究，实际核对clean分支/base与原生依赖。Node v24.18.0，专属worktree `npm ci --ignore-scripts --offline`从锁定缓存完成、锁文件未改；没有Docker/真实网络调用。

Root批准以下实现方向，不视为参数或功能验收：

- Request8→Record9/ReportVersion8/`observer-canonical-v7`，旧路径原字节；两SQLite版本不迁移。观察Module可选`rankingSnapshot(cutoffUtc)`提供严格schemaVersion2的完整本轮有限候选（最多50），原snapshot v1最多7不改。权限核验须明确识别v1/v2真实收据，不能以新Interface接受Request/Agent自报授权。
- 一个版本化纯`rankGitHub({ snapshot, interestProfile, history, algorithmVersion })`供可信出版与固定归档输入重算；没有eval、用户任意函数或从网络补输入。Record9保存完整候选和既有InterestSnapshot，另存必要历史、规则、全体得分/入落选理由，不重复保存整个snapshot两次。
- 报道历史由截止前、期初已可见、实际成功INSERT的Record8/9选中稳定node导出，不单独跨库写历史表。来源与完整性不可验证时本栏history-unavailable，不视为new。相关90天内旧Record<=7 GitHub prose无法证明稳定node时留明确legacy Gap，不猜名称/URL；窗外不永久阻断。最终同步事务重核历史/来源→INSERT，失败或未发表尝试不产生报道历史；未来更正/撤回由后票明确接入。
- 精确UTC毫秒：7天点恢复仍0，之后30天线性恢复，37天全恢复；30/90天窗为`(cutoff-D, cutoff]`，对应边界须测±1ms。正常最终入选数N需至少ceil(N/2) novel，按质量合格候选选择可满足配额的最大N<=7，不足缩数，novel0则空刊，不为配额填低质量。
- 首片使用9个实际Owned协议格式候选与两个观察时刻，经真实SQLite→produce8→鉴权readReport：排序输入包含9个，原cap7之外高动量第9个入选，保留signed变化/版本/审计并重启原样读取。Root亲读测试和helper确认restartStore同时重开观察及Report库；没有私有SQL旁读断言。首片获准逐个RED→最小GREEN，暂定参数不可冒充最终算法。

作者参数提案`data/parameter-proposal/expectations.json` SHA **41ad8312dce52fe0ed5aa24771f97db29062d9d7ad6232dd10c8c18ff88db872**已由Root亲读：8组设计偏好/偏差场景，stars/forks权重、topic增益、cold门槛和频率惩罚均是候选而非批准常量。四点同cohort手算只说明信号平衡偏好，不是客观质量真值或最佳权重证明。

Root要求保留原提案，扩展另成版本；将描述性场景落实成完整可重放数值/结果，覆盖候选数/并列、语言年龄不均、实际双点间隔、存量不变性、正零负、cold、偏好及配额冲突。宽约束无法区分两个参数时如实说明，较小干预可作工程默认而不声称唯一最优。小cohort回退须披露降低分辨率，不追加未批准语言配额；createdAt晚于真实观察不能以max(1,负年龄)掩盖。measured注意力门依赖真实正净变化或经说明的实际间隔标准化率，不能仅靠巨大存量使零/负动量合格；cold proxy保持明确分区。
