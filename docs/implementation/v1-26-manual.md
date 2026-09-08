# #26 Owner 今日补发与一次附件发送

本入口用于当天尚无正式报告时，由 Owner 显式生成初刊 `YYYY-MM-DD-v1`。生产路由复用六栏研究、语义核验、Publication Gate、Final Editor、Canonical Markdown、私有阅读与 PDF 派生。既有 07:30 冻结、08:30 交付、12:00 自动恢复规则保持不变。

## 入口及边界

- `observer.publishOwnerRequested({ requestId, request }, ownerToken, signal?)`：只接受生产模式、已装配路由及 Owner 本人凭据；已配对设备的阅读凭据不能创建任务。
- `observer.ownerPublicationStatus(requestId, ownerToken)`：查询持久请求状态。先查询再采集，可避免已发布请求重新采集。相同 ID 与相同输入只返回已有版本；同 ID 换输入拒绝。
- 当天已存在报告则拒绝新请求，不覆盖历史，也不冒充 Completion Revision。每个业务日只允许一个 running/published 请求；失败后不会自动再试。进程中断的请求最多占用到其固定截止时间，随后成为失败，原 ID 仍不能重跑。
- `ownerPublicationWindow(actualFreezeUtc)` 产生真实冻结时刻以前 24 小时的窗口。冻结时刻必须属于上海今天，且请求接收时距冻结不超过 60 秒。真实 `retrievedAtUtc` 原样保留，不修改为 07:30。材料截至实际冻结时刻，生成在其后发生。
- 固定截止时间为接收请求后两小时与上海当日结束中的较早者；路由预留既有清理预算，并通过 AbortSignal 和写入事务再次检查。不能传入自定义无限截止时间。
- 报告新增 `provenance: owner-requested`、`record.ownerPublication` 和正文“今日补发 · 非定时准时交付”标注。晚于 08:30 时正文明确说明迟到。没有补写定时可读时间，也不把补发放进定时 Shadow 对照。
- 六栏仍显示真实 Coverage Gap；普通新闻不能冒充 GitHub 专门观测或社交原生样本。全部栏目均无可信内容时拒绝发布。
- 请求表只存身份、时间、输入摘要和状态，不保存另一份来源原文。原来源权利、TTL 与归档撤回路径继续生效。

## 方法调用示例：真实采集、发布、导出

这是给受控本地脚本使用的接口，不注册 HTTP 发布接口、不启动服务循环。配置指向新的独立 SQLite/任务目录；下列 `configurationPath`、Owner token 和邮箱只从本地私有环境取得，不写进仓库。生产 runtime 的 `configuration` / `collection` / `routing` 返回值由 #26 native 子块提供。

```ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createProductionRuntime } from "./src/production-runtime.ts";
import { SourceConfigurationSchema } from "./src/collection.ts";
import { editionNames } from "./src/contracts.ts";
import { ownerPublicationWindow } from "./src/owner-publication.ts";
import { prepareOwnerRequestedEmail } from "./src/email-message.ts";
import { runtimeSecret } from "./src/runtime-secrets.ts";

const ownerToken = runtimeSecret("OBSERVER_OWNER_TOKEN")!;
const configurationPath = resolve(process.env.OBSERVER_RUNTIME_CONFIG!);
const runtime = createProductionRuntime(configurationPath, ownerToken);
const requestId = "owner-2026-09-08-initial";
try {
  // No runtime.tick() or background collect/email loop is started.
  const prior = runtime.observer.ownerPublicationStatus(requestId, ownerToken);
  let versionId = prior?.state === "published" ? prior.versionId : null;
  if (prior && !versionId) throw new Error(`owner-request-${prior.state}`);
  if (!versionId) {
    await runtime.collection.collect(); // One explicit real collection; actual clock.
    const sourceConfiguration = SourceConfigurationSchema.parse(JSON.parse(readFileSync(
      resolve(dirname(configurationPath), runtime.configuration.sourceConfigurationPath), "utf8")));
    const window = ownerPublicationWindow(new Date().toISOString());
    const bundle = runtime.collection.bundle({ ...window,
      configurationId: runtime.configuration.configurationId }, "storage");
    bundle.evidence = bundle.evidence.filter((item) => item.retrievedAtUtc > window.windowStartUtc &&
      (!item.publishedAtUtc || item.publishedAtUtc <= window.cutoffUtc));
    const version = await runtime.observer.publishOwnerRequested({ requestId, request: {
      schemaVersion: 10, taskId: `owner:${requestId}`, businessDate: window.businessDate,
      configurationId: runtime.configuration.configurationId, evidenceBundle: bundle,
      editions: Object.keys(editionNames).map((edition) => ({ edition,
        evidenceIds: bundle.evidence.filter((item) => sourceConfiguration.sources.find(
          (source) => source.sourceId === item.sourceId)?.edition === edition).map((item) => item.id) })),
    } }, ownerToken);
    versionId = version.id;
  }
  const report = runtime.observer.readReport(versionId, ownerToken);
  await runtime.observer.processPdfRenditions(); // One existing PDF pass; no retry loop.
  const pdf = runtime.observer.readPdf(versionId, ownerToken);
  const preview = await prepareOwnerRequestedEmail({ report, pdf,
    address: runtimeSecret("OBSERVER_OWNER_QQ_ADDRESS")!,
    messageId: "<owner-preview@observer.invalid>", atUtc: new Date().toISOString() });
  const output = resolve("data/owner-publication", versionId);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${versionId}.md`), preview.markdown);
  writeFileSync(resolve(output, `${versionId}.html`), preview.html);
  writeFileSync(resolve(output, `${versionId}.pdf`), pdf);
} finally { runtime.close(); }
```

示例只演示普通来源采集。已经通过专门路径采集的 GitHub 快照可由 runtime 的既有 GitHub reader 冻结；社交样本需作为 `discourseSamples` 传入并满足同一窗口。没有这些真实输入就保留对应缺口，不能把普通 RSS 材料改名填入。

配置继续使用 `schedule.enabled: false`、`collect: false`、`email.enabled: false`；这些值禁止后台工作，显式方法仍可调用已装配的真实 provider。模型与 reasoning 继承 native runtime 配置，本入口不写死模型，也不增加地区审批或改变计费路径。

## 一次附件发送：成品阅读后独立调用

`prepareOwnerRequestedEmail` 只组装本地 MIME 和 HTML 预览，不读 SMTP 密钥、不联网。HTML 与纯文本由完整 Canonical Markdown 派生，邮件附完整 `.md` 和同版本 `.pdf`；不生成下载链接、不需要 `publicBaseUrl`。PDF 超过既有 5 MiB 或总 MIME 超过 8 MiB 时拒绝发送，不静默漏附件。HTML 禁止外部资源、脚本及图片加载，来源完整 URL 保留在 Markdown 附件中。

完成 HTML / Markdown / PDF 的集中阅读后，单独使用已授权的本地发送调用：

```ts
import { createQqAttachmentTransport } from "./src/qq-email-transport.ts";

// runtime/ownerToken are created as above; runtime.email stays disabled.
const address = runtimeSecret("OBSERVER_OWNER_QQ_ADDRESS")!;
const transport = createQqAttachmentTransport({ enabled: true, transport: "qq-smtp", address },
  () => runtimeSecret("QQ_SMTP_KEY"));
try {
  const status = await runtime.observer.sendOwnerRequestedEmail({
    requestId: "owner-mail-2026-09-08-initial", versionId: "2026-09-08-v1", address,
  }, ownerToken, transport);
  console.log(status); // Safe IDs, timestamps, bounded reason/status; no address/key/body.
} finally { transport.close(); runtime.close(); }
```

`observer.ownerEmailStatus(requestId, ownerToken)` 读取独立发送账本。每个 requestId 和同版本/收件地址只允许一次尝试，验证报告后先持久写入 pending，再读取 PDF、组装 MIME，于 SMTP 调用前写入 sending 与固定 Message-ID。所有重复调用（含并发请求）都仅返回已存状态，包括 PDF 未就绪、准备失败与明确拒绝；不会重新发送。同 ID 换版本或收件地址拒绝。SMTP 返回 retryable 在该入口保存为 failed，不接入原自动重试。进程中断后的 sending 超过原发送租期会记录 unknown，绝不自动重发。accepted 只表示 QQ SMTP 最终接受，不代表收件箱已收到。

原定时邮件仍要求真实 HTTPS 下载入口，契约未放宽。定时发送选择器只消费 scheduled provenance，避免今后开启定时邮件时再次投递 Owner 补发。手动报告仍进入原报告/PDF/outbox存储；其受控投递事实在 `owner_email_deliveries` 中，不能把原 outbox 的待处理状态当作一次附件发送失败。来源撤回仍阻止未发送的附件，对已接受或结果未知的外部副本记录不可远程擦除范围。

## 本次实施记录与局限

按 Owner 快速 V1 指示，没有新增测试/夹具，没有执行模型、采集、SMTP、Docker、S3、旧 Owner 数据读取或真实 PDF 生成。本子块没有实际运行证据或发送结论；Root 合并 native 子块后完成一次真实产物流程。

实现中曾执行一次 `tsc --noEmit`，未通过：现有依赖目录缺少 `@aws-sdk/client-s3`、`markdown-it`、`nodemailer`、`pdfkit`、`fontkit`，并报告既有 `shadow-evaluation.ts:110/113` 的 GitHub snapshot schemaVersion 类型错误。该检查发生在邮件子块完成前，不能证明最终代码可编译。Root 随后明确禁止后续 build/typecheck；本子块遵循该指示，只读最终代码与差异，不标注 PASS，不扩展回归矩阵。

接续收尾仅静态读取代码、差异和本说明，补齐 PDF 准备失败的持久状态与并发重复发送请求的既有状态返回；未重新运行上述检查。提交后交 Root review。
