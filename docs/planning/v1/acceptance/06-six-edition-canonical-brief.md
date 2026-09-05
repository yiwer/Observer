# V1-06 执行与待验收记录

状态：**实施中，尚无冻结提交/验收结果**。GitHub #6 OPEN，assignee=yiwer。

- 范围：[GitHub #6](https://github.com/yiwer/Observer/issues/6)、[本地票](../tickets/06-six-edition-canonical-brief.md)。
- Fixed base：`e57832f65222c949b00acb12bbb5196ae2c2c033`，包含已验收 #5 集成及最新证据。
- Worktree：`O:/GenesisCode/Observer-worktrees/v1-06`；branch：`ticket/v1-06`，创建时 clean。
- Fresh-context agent：`/root/implement_v1_06`，已实际创建新会话，不复用审查/旧实施上下文；要求亲读 implement、TDD 与 required references、CONTEXT、PRD/ADR/票据。
- 唯一 native dependency #3 已实际读回 CLOSED；顺序前票 #5 也已验收关闭。[启动回写](https://github.com/yiwer/Observer/issues/6#issuecomment-5551218588)及 assignee 已读回。

## 实施边界

六个 Edition 共同编排，Today Overview 引用各栏首要内容与缺口，生成同一 Report Version 的唯一 Canonical Markdown。约 7 条/3 重点、Priority 400–800 中文字（复杂约 1200）、Watch 100–250 是软目标，不是硬配额/读时要求；证据不足保留真实数量和原因，Source Policy 优先，Impact Note 独立位置不占普通故事配额。

Final Editor 只接触已校验 Report Record，不能联网、运行 shell 或加入未核验事实；新增/改变成稿事实须重新核验或拒绝。标题、数字、链接、状态与记录一致，总览只是该版本正文的导航子集，不能独立研究。说明事件、意义、影响路径、未知，同时保留事实/声明/分析/引用的语义区别。

既有入口与已确认 PRD T1 seam 为 `createObserver.produce → readReport`；使用真实 SQLite，必要时只替换外部 AgentRunner/Verifier、时钟或来源响应，不测内部函数、类结构或 Prompt 字面。首个竖切先验证六栏完整生产读取的 RED→GREEN，再逐片覆盖稀疏、全空、单栏异常、内容一致性、来源许可优先。空输入不能伪造成功 Agent 或未经核验的正文；不通过新增发布后门绕过 Publication Gate。

当前基线 **104 项**，smoke 3 项属于旧子集。应保留旧 Report Version 字节不变/可读、来源各阶段许可与 TTL、固定 Codex/Claude CLI 协议与失败/用量/回收、私有鉴权、原子不可覆盖归档、生产入口拒绝 fixture。公共 Schema 的演化必须明确兼容/版本，不删除旧断言以掩盖回归。

本票不实现跨天去重（#7）、主题判定、真实专用采集、Provider 路由/复核（#14）、调度恢复、PDF、邮件、Android 或生产开闸。下一票需要的契约可在本票范围内明确，但不偷带后续业务。

## 环境与安全

继续使用既有固定 Docker Linux 运行依赖及无凭证模型协议替身：Codex 0.153.4 镜像 `sha256:12226892754c245087a7285475dad50d58322e7b9d637ba40850370c37cc5024`；Claude 2.1.252 镜像 `sha256:0fce00145d59010131a2efebdcac36dd66ef1c8b388830e275fcdc096d720269`。宿主 Claude 现为 2.1.261，不替代容器资格，不升级/重建现有依赖或更改全局配置。

本票不需要真实模型调用或秘密。Owner 的本机 Codex 费用授权/地区资格核查、延期的 Claude 实测、QQ SMTP 单封测试由 Root 分开处理；本 agent 不读个人认证/环境秘密、不发邮件、不读邮箱。其他项目容器/网络/卷和用户 `.idea/` 不动。

此前策略拒绝清理的 `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`、`O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c` 绝对不触碰，不换工具重试。其他 agent 的证据目录不修改/删除。

本票后续另新增禁止触碰/清理重试路径 `C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`：作者测试收尾曾 EBUSY，随后精确目录清理被自动策略拒绝；Root 已明确保留，不换工具或重跑同目录 cleanup 绕过。它仅含虚构 SQLite 测试证据，不是产品数据库。

## 待验收

作者竖切 TDD、定期 typecheck/单文件检查后，提交代码与实施说明并冻结；最终完整 `check` / `smoke` 绑定该 SHA。Root 固定非空三点差异，协调独立 Standards / Spec，另在 detached 工作区与集成基线复跑后才验收。当前未提供冻结 SHA 或通过计数，不把 #5 的 104/104 当作 #6 结果。

## 首个竖切（未冻结阶段证据）

作者提出在原公开生产边界增加显式输入 v2、Report Record v3，保留输入 v1 与旧 Record v1/v2 的契约及存量正文。六栏研究结果作为一个外部 seam 的输入，不在本票实现真实六进程路由；逐栏后续将明确区分无证据、成功无候选和失败。Final Editor 采用只从已核验记录确定性投影，成稿通过内容哈希/重新投影一致性校验，不接收任意自由文本成稿。Root 已要求所有故事角色/Impact Note 引用已核验 Claim，不能把未确认或隔离项包装成事实；这些约束还须逐项测试，当前只是已收敛的实现方向。

作者实际 `node --test tests/six-edition.test.ts` 首片 **RED 0/1**（`runner-unavailable`，204.6564ms），最小接入后 **GREEN 1/1**（233.9689ms）：真实 SQLite 可读取 Record3 的 42 条故事、六个独立栏目及每栏 3 个重点位置，输入中的未核验标题不进入正文，错误凭证无法读取。Root 随后只读核对 WIP 的业务测试和实现差异，未运行独立验收，也未把该定向结果称作完整票通过。

此时原有 CLI 测试因联合 Record 增加 v3，需要先按 schema 判别才读取旧 `agentResult`；作者将补类型判别保留既有断言，不能删除旧用例或改变旧 Runner 契约来消除类型错误。首片暂用旧 renderer 的临时分组，仅为 tracer；后续应改为 Record 直接投影，并补稀疏/全空、逐栏失败、事实及链接/状态一致性、Priority 解释、Impact Note 和许可优先。当前无最终 SHA、完整 typecheck/check 或双轴结论。

## 空栏与失败推进（仍未冻结）

作者随后报告全空与单栏失败已各经历 RED→GREEN：无证据时不运行 Agent、Record 中不捏造 Provider；失败栏保留实际 status/category/usage，成功但无候选另记 `no-candidates`。Root 只读看到了这些公开业务断言及新增直接 Record 投影；未独立运行该 WIP，也没有取得完整 check 终态，不能作冻结通过结论。

Root 另检查原 Claude/Codex 测试 diff，当前只是增加 5/4 处 Record schema 判别，旧业务/用量/权限断言未删除。初稿 renderer 曾以 `storyId` 的栏目名前缀判断隔离说明归属，这不是既有 ID 契约；新的通用来源渲染也尚未保留旧待确认项的支持/相反材料标签。Root 已提示作者用可信结构关联和任意 ID 场景、冲突来源语义回归解决，作者已确认纳入后续竖切。它们是未冻结阶段的具体风险观察，不是已经完成的最终 review。

## Root 独立历史兼容样本

为避免只以新实现生成新样本测试兼容性，Root 在已验收的 detached `accept-v1-05`、固定 `177cfbbddf08e507c448e76dbe23ebc31a2ef617` 使用公开 `produce → readReport`、虚构来源、标注语义替身，生成两份真实 SQLite 历史归档。所有文件位于 Root 独占且 ignored 的 `O:/GenesisCode/Observer-worktrees/accept-v1-05/data/root-v1-06-compat-4ca1d8`：`generate-baseline.ts`、`baseline.json`、`verify-reader.ts`、`record-v1.sqlite`、`record-v2.sqlite`；没有真实新闻、秘密或其他 agent 数据，未修改冻结产品代码。

- Record v1：MD 747 bytes；MD SHA-256 `551448c57bdce0e16e65387d2a0b54d8d5e1950b99a97a233d45a21a517d9e66`；完整 PublishedReport JSON SHA-256 `138852de154063f97746fb154b357d6acb9060318d9d43f2ada92a6333ca24d8`。
- Record v2：MD 596 bytes；MD SHA-256 `98caf0ccf24fb58ecc52fa06e7361aff0dc86b5b8dc7df095f56e594d350e3df`；完整 PublishedReport JSON SHA-256 `2051e2a9bfae59fce7c206c9d2adb53985bb0beba25ec759cf97c5b3dd5bcc41`。

生成进程结束后，另一个进程使用旧版本 `dist/observer.js` 读取同批样本，2/2 旧版自洽核对通过：schema、MD byte length/hash、Report Version hash、完整 Report JSON hash 一致，错误 Owner token 被拒绝。这里只建立旧样本基线，不证明 #6 的兼容性；待 #6 最终冻结后必须由新 built reader 读取这些既有归档并重复核对。生成脚本拒绝覆盖既有数据库，证据保留不重新生成成“新样本”。

Root 随后提前用未冻结 #6 的 `src/observer.ts` 做一次诊断读取，同批 v1/v2 样本 **2/2** 的 MD 与完整 Report hash/鉴权均匹配。运行前后六个相关源文件 hash 一致，具体身份保存在同目录 `unfrozen-source-diagnostic.json`。这是 WIP source 诊断，不是最终 SHA 或 build 验收，后续仍必须重跑。

## 后续阶段反馈（未冻结）

作者报告新增 13 项 T1 与 typecheck 曾通过，来源许可/TTL 矩阵沿新入口回归；按竖切继续收紧任意 ID 拒绝说明、冲突来源关系、单栏坏结构降级、悬空/未确认/隔离分析引用、自由文本缺口原因及跨栏证据归属。随后扩到 15 项的定向运行在最后一项收尾出现 EBUSY：production reader 晚于 fixture cleanup 关闭；作者调整为先关闭 reader，再回收本轮目录。这是 harness 收尾问题，不能将该失败轮当作完整 PASS；新的定向运行及冻结 SHA 全量结果尚待实际终态。上述被策略拒绝的目录不再清理，且没有把被拒 shell 后未执行的测试算作运行。
