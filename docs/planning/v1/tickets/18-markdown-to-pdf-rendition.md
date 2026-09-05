# V1-18 — Canonical Markdown 到中文 PDF

状态：ready-for-agent · 已发布：[GitHub #18](https://github.com/yiwer/Observer/issues/18)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-18 -->

规划 ID：V1-18 · 类型：implementation

## What to build

Owner 可以获取与 Canonical Markdown 同版本的中文 PDF，排版适合长文阅读，来源链接和修订语义不丢失。

## Acceptance criteria

- [ ] PDF 只由既有 Canonical Markdown 转换，不再调用研究或独立重写；产物绑定刊次、版本与正文校验信息。
- [ ] 中文字体、标题、列表、长中英混排、长链接、跨页重点故事及缺口/修订提示可读；转换不静默截断正文。
- [ ] HTML/Markdown 内容经过安全处理，转换器不读取任意本地秘密或访问内网；外部图片/资源按 Source Policy 与受控网络规则处理。
- [ ] 转换失败有独立 rendition 状态和有限重试，不能损坏已保存 MD；MD 可读与 PDF 就绪分别记录。
- [ ] 测试从固定多栏长文生成、保存再下载 PDF，核对标题、数字、来源及版本一致；保存供人工视觉检查的渲染样张，自动文本比对不能替代视觉 PASS。

## Blocked by

- #6 — V1-06 — 六栏编排、Today Overview 与唯一正文

## Scope boundary

PDF 生成与下载产物；邮件模板、附件预算及真实邮件客户端检查在对应票。

## Decisions and evidence

选择并记录 Markdown 方言、转换引擎与字体依赖，保证可在目标 Linux 环境重现。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-54、US-55。
- PRD 行为验收：AC-15。
- 参考分支：D9。
