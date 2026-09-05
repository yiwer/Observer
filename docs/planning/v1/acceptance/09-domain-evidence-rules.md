# V1-09 执行与待验收记录

状态：**首片高风险独立来源T1已RED→GREEN，后续规则逐片实施；未冻结/验收**。GitHub #9 OPEN、assignee yiwer。

- [本地票](../tickets/09-domain-evidence-rules.md) / [GitHub #9](https://github.com/yiwer/Observer/issues/9)全文与空评论已实际读取；原生唯一依赖API返回#6closed，顺序前票#8亦已CLOSED。
- 固定base **df63b78875a1fb8b4c85389ac6797ddfc5e75400**，包含#8最终06fc8b3、master集成8079271与验收关闭记录。
- 新worktree `O:/GenesisCode/Observer-worktrees/v1-09`，branch `ticket/v1-09`，Root实际核对clean/SHA；fresh `/root/implement_v1_09` 已实际spawn成功，未复用旧票上下文。
- [GitHub启动回写](https://github.com/yiwer/Observer/issues/9#issuecomment-5551990580)已发布并实际读回完整正文/作者yiwer，仍为OPEN、assignee yiwer。

## 范围与先行确认

仅共同Evidence/Publication Gate中的世界要闻、财经、AI及科技前沿主题规则，PRD US18–22 / AC04 / D1/D5/D6。高风险world至少两个独立可靠来源，finance明确更严格；动态伤亡/计票/市场数值带统计时点及单方归因，不把转载当独立证实。财经不发买卖指令、目标价或收益承诺，不启用未许可行情/FRED等默认排除来源。AI/科技区分预印本、官方发布、独立验证及同行评审；公司声明不升级事实。未核验社交视频/血腥图片不得进入，冲突/区间/未知保持可读。

要求作者先亲读implement、TDD及required references、必要设计指导和实际项目规范，提出六项AC映射、风险/标签元数据权威、局部fail-closed、数值时点、来源待审配置、版本与首个竖切。Root确认仍在既有T1后开始一片RED→GREEN，不批量预写测试，不以关键词或候选自报代替证据核验。新接口/重大协议选择先报告。

既有T1：公开 `createObserver` 配置输入→`produce`→鉴权`readReport`，真实SQLite/重启，外部Runner/Verifier/时钟替身；不测私有函数、内部mock或SQL侧读。旧request1–4/Record1–5不可重写，SQLite user_version1；保留#8固定InterestProfile及实际核验发送计数、#7事件/补报/历史授权和#6六栏7/3软目标、ImpactNote不占位。

为真实首发源提供Owner待审配置记录不等于批准采集/许可；需要研究时使用research技能与一手资料，不能把历史引用当现有授权。无四套独立系统、网页后台、Provider路由、调度、更正、PDF、SMTP、Android或部署扩展。

## 验收与归档基线

当前167个测试，smoke3为子集。作者专属说明和代码一起提交clean冻结SHA，再运行完整check/smoke；Root固定非空三点diff、独立Standards/Spec双轴、detached及实际master验收。真实质量/来源许可/长期人工核查另记，不以fixture替代。

Root持有不可变旧档：Record1/2 `accept-v1-05/data/root-v1-06-compat-4ca1d8`；Record3 `accept-v1-06/data/root-v1-07-compat-a913cb`；两期Record4 `accept-v1-07/data/root-v1-08-compat-9b22d0`；Record5 **`accept-v1-08-r2/data/root-v1-09-compat-06fc8b3-r2`**。最后路径必须带-r2，非-r2目录是保留的生成器封装错误，不是oracle。各`verify-reader.ts <absolute-module>`只读新reader，不能用#9生成器改写旧期望。具体摘要见[#8记录](08-explicit-interest-and-global-coverage.md#后续record5兼容基线)。

## 安全与外部门槛

不读秘密、认证文件或用户`.idea/`，不调用真实Provider/SMTP，QQ已单封SMTP受理但收件未确认，禁止重发。本机Codex地区资格待Owner、Claude真实环境延期；不阻止本票离线实施。固定CLI镜像/版本/daemon保持，不升级、重建、重tag或全局prune。首轮tag查询偶发错误根因未知，完整失败/只读诊断/同SHA重跑分别记录；#8最终三方完整检查均通过，不能假定本票必过。

测试只用自己新唯一目录，保留证据，不清理他人或既有材料。绝对禁止触碰/换工具清理：`C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`、`O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c`、`C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`。

当前没有本票测试结果、实现提交或冻结；代码未push，生产仍禁用。

## 首片方案确认

Root在当前作者HEAD仍df63b788/clean时核对完整方案，并按codebase-design/TDD确认继续使用原公开Interface，不新增test-only入口或远程后台。允许request5 → Record6 / Version5 / `observer-canonical-v4`，固定主题规则版本；原Candidate2/EditionResearch2/Verifier1外壳、旧请求/旧档案字节与SQLite版本保持。新增自由注解对所有旧入口同样剥离，旧版不冒称获得新规则保证。

- request5所有六栏Claim均需完整外部domain判断，按语义领域而非Candidate栏目执行规则，避免换栏绕过；缺/无效注解局部隔离，不能影响同批其他合格Claim。明确routine与unknown，不从缺省/关键词或候选自报授予routine。重大冲突、伤亡/灾难、选举计票、公共卫生紧急事件均有明确风险类别；多领域同时满足适用门槛。
- 高风险world至少两个不同可靠Source与Upstream Origin的非单方支持；高风险finance同样至少两个且至少一个适当primary/direct-observation，作为更严格的交叉核验。转载不得凑数，冲突保持待确认。
- 财经每种Claim均受资讯边界约束；statement仅证明发布者作出声明，analysis/quotation等kind不能成为嵌入高风险事实或数字的豁免。纯解释/条件情景与底层事实断言须由完整外部判断区分，确定性检查执行对应约束，不假装能证明模型分类正确。
- 动态数字明确none/assessed，统计时点/归因逐Claim和Evidence关联、由获准文本支持；不自动复制发布时间/事件时间。正文中的安全待确认数字也必须显示必要时点和归因，不能只给已发布条目加标签；缺/unsafe/许可失败只保留固定原因。
- AI/科技研究成熟度逐引用Evidence关联，可组合预印本/官方/独立验证/同行评审未知等，不从域名或另一研究借权；官方能力声明不升级独立事实。
- 媒体沿既有文本-only Bundle、无二进制或媒体解引用/渲染入口的实际能力验证；不将未核验视频/血腥图片作为发布证据，不留拒绝媒体原文。未新增Runner之前对任意文本的可信自动分类平台，也不声称已具此能力。可留政策允许的最小审计IDs/固定拒因。
- 4–6个真实一手首发来源仅研究并生成pending/disabled待审记录，不开启采集、批准权利或触发真实模型/邮件。

首个竖切已批准：相同world冲突事实与Profile，两份独立可靠支持可发布，改为相同Upstream转载则待确认；从公开produce/readReport观察中文正文、门账本、版本及关闭/重启读取。先单片RED→最小GREEN，再按其余AC逐片推进。以上是计划确认，不是已实现或测试PASS。

## 首片 TDD 与开发期检查

作者首次运行缺少zod，仅属于依赖环境失败；`npm ci --ignore-scripts --no-audit --no-fund` 安装7个锁定包后，`node --test tests/domain-evidence.test.ts` 实际 **0/1 RED**（314.0056 ms），原因`invalid-request`。最小request5/Record6/Version5分支及高风险world独立来源门贯通后 **1/1 GREEN**（297.8453 ms），真实SQLite关闭/重启鉴权读取一致。typecheck先出现测试中的冗余schema narrowing，窄修后exit0；没有把环境错误或类型修复前状态冒称业务通过。

Root已实际阅读当时`domain-contracts.ts`、`domain-evidence.ts`与首片公开测试：测试材料与所述冲突事实一致，通过真正文件配置/produce/read观察支持来源与同上游转载的不同结果，不靠私有SQL断言。当前domain字段只贯通首片，数字、财经、成熟度、媒体及完整兼容/安全矩阵仍在逐片完成；不对未实施约束预下缺陷结论，也不把首片作为全票通过。

Root用当前 **WIP source** reader实际读取6份旧producer档案：Record1/2 2/2、Record3 1/1、两期Record4 2/2、Record5 1/1，全部原MD/完整JSON/摘要及鉴权隔离保持；各脚本和固定预期未改。此时作者HEAD仍df63b788，WIP尚未提交，不能将结果绑作该HEAD已有新功能；最终冻结built和实际master仍须重跑。

作者已实际派独立`/root/implement_v1_09/source_research`，完成待审[来源提案](../../../research/domain-evidence-source-proposals-2026-09-05.md)：OCHA oPt、Eurostat、Fed、arXiv、Anthropic、NASA六条，均pending/所有使用开关false，仅文档、不自动授权或采集；Root已读产物，官方引用及许可边界尚待整票独立审查。文档明确不是可导入SourcePolicy，未知feed保留unknown，不以伪URL通过Schema。真实接入/许可/全球覆盖尚未验证。
