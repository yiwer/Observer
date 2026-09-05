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
