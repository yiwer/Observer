# V1-11 元数据补充：language、created_at、topics

日期：2026-09-06（UTC）。仅支持既有“#11 可重用 Repository Snapshot → #12 消费者”交接，不定义评分或 cohort 规则。已保留并遵循本轮完整读取的 research skill。

本次只读取官方文档与固定 revision 的官方 API 定义；无真实候选/API/认证调用，无秘密读取，无产品、测试、配置或权限变更。唯一写入是本 ignored 补充文件；原 241 行报告 `github-api-contract-2026-09-06.md`（SHA-256 `DD2400936F28D6AB8C353D09CAFA7DBB2630507DC7DB111F3A9AFCA4E08922CF`）未修改。

## 固定官方 schema

来源：[GitHub 官方版本化 OpenAPI JSON](https://github.com/github/rest-api-description/blob/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json)，[同 revision 原始定义](https://raw.githubusercontent.com/github/rest-api-description/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json)。revision 为 `3cef12e8a02d612ad032473d4fb87266f2befeae`，API 日期版本为 `2026-03-10`，OpenAPI 格式为 3.0.3。

已在内存中直接核对 `required` 与 `properties`，不依赖 response example：

- Search：`GET /search/repositories` → 200 JSON `items[]` → `#/components/schemas/repo-search-result-item`。
- Get：`GET /repos/{owner}/{repo}` → 200 JSON → `#/components/schemas/full-repository`。

| 字段 | Search required | Get required | 两种 schema 中的类型及 nullable |
|---|---|---|---|
| `language` | 是 | 是 | `string`，`nullable: true` |
| `created_at` | 是 | 是 | `string`，`format: date-time`；未声明 nullable |
| `topics` | 否 | 否 | `array`，元素为 `string`；数组和元素均未声明 nullable |

上述六项结论均可在固定官方定义的 `#/components/schemas/{schema-name}/required` 与 `#/components/schemas/{schema-name}/properties/{field-name}` 核对。

因此，`language: null` 是合法未知语言，不能等同于缺少 required 字段；`created_at` 缺失、null 或错误类型不满足该字段契约；`topics` 省略是合法的未提供元数据，`topics: []` 是明确的空列表，`topics: null` 不属于该 schema 允许值。两种 schema 没有给 topics 声明 `minItems/maxItems/uniqueItems`，不能把网站编辑界面的约束伪称为这份 API schema 的验证规则。[固定 schema](https://github.com/github/rest-api-description/blob/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json)

## 三个字段的语义

**language：仓库主要代码语言，允许未知。** REST repository search 的官方示例明确使用 primary language；GitHub 通过 Linguist 识别文件语言并形成仓库统计，默认分支 push 后统计会更新，且识别可能不准确。该单个字段不表示仓库全部语言、自然语言或维护者国籍；合法 null 应保留为 unknown，不能猜成某种语言。[REST primary-language example](https://docs.github.com/en/rest/search/search#search-repositories)，[About repository languages](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-repository-languages)

**created_at：这个仓库对象的创建时间。** 官方仓库搜索把 repository creation 与 pushed 更新时间明确分开，Repository 的官方语义参考也将 createdAt 描述为对象创建日期时间。它不表示 Release 发布日、最近 push、首次被 Observer 发现或项目在 GitHub 之外开始研发的日期；不能将这些时间相互替换。[Repository creation versus pushed](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories#search-by-when-a-repository-was-created-or-last-updated)，[Repository field reference](https://docs.github.com/en/graphql/reference/repos#repository-2)

**topics：由仓库管理员管理的分类标签。** 官方说明管理员可以任意添加 topics；GitHub 也会为公共仓库生成建议，由管理员接受或拒绝。它们可表达用途、领域、社区或语言。由此推论：topics 是项目分类声明，不是 GitHub 对质量、安全或真实性的认证；省略字段、空列表与实际标签值应保持可区分。[Classifying repositories with topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics#about-topics)

## 证据边界

本补充确认的是官方字段契约和语义。没有检查当前 WIP 是否已保留这些字段，没有运行实现测试，没有确认任意真实候选的字段值或缺失率；也没有提出评分公式、语言/年龄分桶、小样本或兴趣权重。后续消费者只能使用实际保留的观测元数据及其未知状态，不能将本调查视为真实快照证据。
