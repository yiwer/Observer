# V1-10 执行与待验收记录

状态：**fresh 实施作者已派发，局部方案收敛中；无本票测试/验收结果**。GitHub #10 OPEN / assignee yiwer。

- [本地票](../tickets/10-social-discourse-edition.md) / [GitHub #10](https://github.com/yiwer/Observer/issues/10)全文、空评论及原生依赖已实际读取；唯一#7 CLOSED，#7已验收集成8e02377在新基线可达。顺序前票#9已实际关闭并完成冻结/master验收，见[#9记录](09-domain-evidence-rules.md)。
- 固定base **f36aae2122d081e638bfd520f93ded88fc95ef3b**，专属 `O:/GenesisCode/Observer-worktrees/v1-10` / `ticket/v1-10` 已由Root创建并核对clean。fresh `/root/implement_v1_10` 已实际启动，不复用旧作者/评审上下文。
- [GitHub启动回写](https://github.com/yiwer/Observer/issues/10#issuecomment-5555149060)已单次发布，Root用独立API读回完整正文/ID/URL，另读Issue状态与assignee。

## 范围与先行要求

一个可替换平台Adapter，交付Story-linked Discourse、Platform-native Signal及无合法样本时的明确Coverage Gap。真实社交源尚未批准；X/Reddit等用途未知维持关闭，不用自有fixture证明真实平台覆盖，也不能以只有空栏替代两类固定合法材料的开发路径。

作者先亲读implement、TDD及tests/mocking、codebase-design、领域词汇、票/PRD US23–25、AC05/06、D5/D6/T1和ADR0001/4/5。局部技术方案须覆盖六AC：平台/查询/语言/时窗/地域依据/样本量和缺口；最小采样、原生信号阈值与偏斜判断；主EventCluster关联和不得作为独立事实佐证；采集/模型/存储/永久导出分段授权与撤回/删除时点；敏感字段阻断；Schema/历史兼容。需要平台事实时用research技能派背景一手研究，历史研究不是当前授权。

先向Root提交最小Interface/版本/首片方案确认，再沿已批准T1逐片RED→GREEN。原公开 `createObserver` 来源/配置/业务时间/历史/Runner与Verifier→produce→鉴权readReport、真实SQLite/重启为主要seam，少量外部来源I/O契约。不得用候选或模型自报授予SourcePolicy权限、事后调阈值凑信号、总体支持率/个体画像或新增人工编辑器。PDF/邮件尚属于后续票，本票须证明禁止材料不会进入共用Canonical，不虚称已运行不存在的Rendition。

## 冻结与安全基线

基线完整186项，smoke3为子集。保留request1–5/Record1–6/Version1–5及SQLite user_version1旧字节/读回语义；新版本先协调，不能静默改旧renderer。#9所有栏目逐Claim domain规则、#8Profile开始固定和实际Verifier发送计数、#7事件因果/去重/历史来源权利、六栏7/3软目标继续有效。

Root持有旧Record1–5六份及Record6三份不可变oracle；新增后者在 `accept-v1-09/data/root-v1-10-compat-57e9686`，generator禁止重跑，基线与reader摘要见[#9记录](09-domain-evidence-rules.md#record6-后续兼容基线)。作者不改这些基准，最终由Root以新built及actual-master独立读取。

不读auth/秘密/QQ_SMTP_KEY/用户`.idea/`，不发真实Provider/SMTP，不采集真实平台、批准来源、购买、部署、push、合并或关闭票。Docker固定desktop-linux29.6.1及既有三个sha256镜像，禁止升级、重建、retag、重启或prune。绝对不触碰/换工具清理历史拒绝目录 `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`、`O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c`、`C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`；两只21:56旧exited容器fb6640585ce1/c9e72c9c5c5f亦不归本票管理。

完成代码与说明一并提交clean SHA，再同SHA完整check/smoke，Root固定三点diff、fresh Standards/Spec双轴、独立冻结与实际master验收。真实源许可、模型质量、邮件/PDF、目标环境与14天人工门槛继续分别验收。

## 首片方案确认

作者已报告亲读指定技能/项目文件、实际gh与基线clean。Root确认以下局部设计仍属于已批准T1与本票范围；这是实施方案，不是完成证据：

- Request6→Record7/Version6/`observer-canonical-v5`，沿domain-v1；旧request1–5/Record1–6及SQLite版本、Candidate2/Research2/Verification1外壳保留。逐社会Claim增加独立受限discourse判断，缺失/未知failclosed，不由注解赋予来源权限。
- `discourse.observations` 单独存放经过共同Gate的样本论点/分歧；不伪造fact以穿过#7事件规则。Story-linked定位本期最终唯一合格主EventCluster，不能相信候选自报ID；无主或多主Gap。native标为平台信号候选、非已证新闻，不能当新闻事实或独立佐证。社会组数与普通新闻/ImpactNote配额区分。
- 开始时冻结Owner采样配置与指纹：单组最多100条、最多10组、原post key去重；Story-linked最少6条，native最少12条/至少3个不同讨论线程/2个预先时间桶。同线程占比>50%或重复>40%、关键完整性未知、限流/删除/不足均Gap。这些是版本化工程资格阈值，不是经校准的代表性或置信度；不同thread ID不叫独立可靠来源。语言/地域未知不编造。
- 社会专门用途约束只能收紧当前SourcePolicy；所有现有阶段grant及明确允许永久衍生/不可撤回导出同时满足才可使用，删除义务若要求回收衍生/导出物或未知则拒绝。旧policy不带可选social字段时必须保持原digest，且不会自动获得social用途。
- 采集后、送模型/核验前、核验后和提交前的生命周期复核只能收紧：deleted/changed/unavailable使该组退出可读/归档内容，不补取越过cutoff的新正文。可选外部当前配置读取与静态启动快照明确区分，不声称静态默认能感知磁盘变更；已导出文件不可回收。原始材料敏感字段在最早许可投影阻断，允许观点文本仍受原文存储/TTL/模型grant；不声称结构字段过滤可识别任意自由文本中的全部PII。

Root要求将最初“仅Owner-supplied sample Adapter”方案改为**一个真实Mastodon受控HTTP/分页协议Adapter + 自有合法固定响应替身**，避免以每日手动dump接口替代票内平台采样能力。Root依research技能实际派 `/root/v1_10_mastodon_research` 独立核对官方API/字段/分页/删除/许可边界，仅写作者工作树 `docs/research/mastodon-social-sample-adapter-2026-09-05.md`，不读取真实时间线或帖子。所有实际实例仍未批准、保持关闭；正向采样片要先根据研究收敛具体合同，技术可访问不代表使用许可。

已批准先做不依赖真实网络的首片：public produce6面对缺社会用途许可时不调用采样，普通合格新闻仍成稿，社会栏明确无合规来源Gap；真实SQLite重启/鉴权可读，request5仍原Record6。作者应先取得真实RED，再最小GREEN；目前尚无该片结果。
