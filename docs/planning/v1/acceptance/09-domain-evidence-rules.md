# V1-09 执行与待验收记录

状态：**恢复作者继续逐片实施；Root 公司能力独立性探针 0/1 RED 已交修复；未冻结/验收**。GitHub #9 OPEN、assignee yiwer。

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

截至最初启动点尚无本票测试结果；其后开发期结果见下文，仍无实现提交或冻结。代码未push，生产仍禁用。

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

作者已实际派独立`/root/implement_v1_09/source_research`，完成待审[来源提案](O:/GenesisCode/Observer-worktrees/v1-09/docs/research/domain-evidence-source-proposals-2026-09-05.md)：OCHA oPt、Eurostat、Fed、arXiv、Anthropic、NASA六条，均pending/所有使用开关false，仅文档、不自动授权或采集；Root已读产物，官方引用及许可边界尚待整票独立审查。该文件当前仅在作者WIP工作树，尚未集成至master。文档明确不是可导入SourcePolicy，未知feed保留unknown，不以伪URL通过Schema。真实接入/许可/全球覆盖尚未验证。

## 2026-09-06 恢复检查

中断后 live agent inventory 仅有 Root，原作者不再存在；Root 核对原 worktree 仍在 `ticket/v1-09`、HEAD 为固定 base `df63b78875a1fb8b4c85389ac6797ddfc5e75400`，保留全部已跟踪/未跟踪 WIP。未发现可归属本票的测试进程，未终止无关进程。已实际启动 fresh-context `/root/implement_v1_09_recovery`，作为同一工作树唯一产品作者，并要求重新亲读技能、票与已批准方案，不重新发明范围。

Root 在放行恢复作者写入前运行 `npm run typecheck`（exit 0）及 `node --test tests/domain-evidence.test.ts`，**4/4 PASS，583.5191 ms**，覆盖 world 独立来源、动态数字时点、高风险财经 primary 门及跨 Claim kind 的财经禁止内容。这是保留下来的 WIP 恢复初绿，不是恢复作者的新 RED→GREEN，也不是冻结 SHA 的资格。Root 指出后续数字/财经测试的来源正文、hash 与事件语义需同步场景，作者已接受并修正；不能用替身的肯定判断掩盖不匹配的固定材料。

恢复作者其后报告四片 RED→GREEN：逐 Evidence 成熟度（279.0074 ms RED → 单文件 5/5、584.1986 ms GREEN）；研究标签缺失/外来/重复与同批隔离（403.762 ms RED → 专项 1/1、298.3398 ms GREEN）；公司能力声明（250.49 ms RED → 专项 1/1、349.504 ms GREEN）；单方数字归因（279.8085 ms RED → 单文件 8/8、770.6181 ms GREEN），typecheck exit0。Root 已读新增代码/测试并核对来源正文/hash 修订，但这些运行结果仍明确是作者开发期证据，不冒充 Root 独立冻结检查。

余项继续按单片推进：媒体安全优先级、跨 Claim kind 和六栏局部 fail-closed、四栏结果矩阵与新旧档案回归。Root 阅读已完成切片时指出公司能力 `unconfirmed` 早返回可能先于数字隔离判断，已要求在组合测试中覆盖“公司能力未确认 + 缺统计时点/归因”，确保应隔离的约束不会由待确认短路。完成实施说明和 clean 提交后，才进入固定三点 diff、双轴及独立冻结/集成验收。

本次 Docker 只读检查中，固定 Linux daemon `npipe:////./pipe/dockerDesktopLinuxEngine` 的 `version` / `ps` 均 exit 1，原因是命名管道不存在。这是当前环境未就绪，不是本票产品失败，也不同于此前偶发 tag 查询错误。Root 已询问 Owner 是否允许后台启动 Docker Desktop（说明可能恢复其他自动启动容器），尚无答复；不擅自启动、重启、升级或修改镜像。离线开发继续，完整隔离回归仍待环境就绪。

Root 另实际派 `/root/v1_09_source_audit` 按 research 技能核对原六条来源的第一方依据，已完成并由 Root 全文读取[独立来源审查](../../../research/v1-09-source-proposal-review-2026-09-06.md)。该报告固定原提案工作文件 SHA，区分第一方文档、四个候选 feed 的单次 HTTP/XML 观察和未取得的产品接入/权利决定。OCHA 本站使用条款与 NASA AI 输出归因规则两处重要遗漏、Eurostat 翻译义务具体化已交作者修订；Root 另实时读了 OCHA/NASA 原始官方页。没有运行 Observer Collector 或改 SourcePolicy/权限，所有来源仍 pending/false。这不是正式产品 review 或整票通过。

Root 再次实时读回 #9 全文及其启动评论（OPEN / yiwer），原生 blocking API 仍仅 #6 CLOSED。只读核对 Record3、两期 Record4、Record5 的 `verify-reader.ts` 及 Record5 `baseline.json` SHA-256，均与前票冻结记录一致；未运行生成器或改写档案。这是既有基准的完整性检查，不是新 reader 的回归结果。

## Root 开发期独立探针：公司能力的来源独立性

作者其后报告单文件 **13/13 PASS，1195.6541 ms**、typecheck exit0；媒体/unsafe 优先级、跨 kind/领域一致性、六栏坏注解局部隔离、旧 request1–4 剥离均已加入。Root 随后按已批准 T1 另写 ignored `data/root-v1-09-review/company-independence-probe.ts`（SHA-256 `ad4db2f684ce8185f9bb3d0ed735c5076ecb5382f8a37e057e36a848d2d32905`），只调用公开文件 Profile / produce / 鉴权 readReport、真实独立 SQLite/重启；Runner/Verifier/clock 是外部固定替身，不使用私有函数或 SQL 侧读。

实际命令：`node data/root-v1-09-review/company-independence-probe.ts O:/GenesisCode/Observer-worktrees/v1-09/src/observer.ts`，**0/1 RED，64.7319 ms，exit1**。真正不同 Source/Upstream 的基准先通过；接着 same-origin 场景得到 `published` 而非预期 `unconfirmed`。该材料明确为公司说明的转载，Verifier receipt 的上游身份与公司材料相同，却又给了 `independentValidation=yes`；当前公司能力判断接受该标签而未核对可确定的来源身份矛盾。已交作者作原范围内的单片修复。后续 same-source 场景因前面断言失败未执行，不声称已复现；本次绑定 WIP，不冒充 clean base 或最终冻结。Root 探针与失败证据保留，修复后另行独立重跑。
