# V1-09 执行与待验收记录

状态：**fresh作者已启动，正在阅读规范并提出首片方案；未实现/冻结/验收**。GitHub #9 OPEN、assignee yiwer。

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
