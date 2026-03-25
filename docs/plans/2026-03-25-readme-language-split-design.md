# README Language Split Design

## Goal

将仓库首页 README 从“中英混排单文件”调整为“英文主 README + 中文独立 README”，提高 GitHub 首页可读性，并保持中英文内容同步。

## Decision

- `README.md` 作为 GitHub 默认首页文档，保留纯英文内容。
- 新增 `README.zh-CN.md` 作为简体中文文档，保留纯中文内容。
- 两个文件顶部互相链接，方便读者切换语言。
- 内容结构保持一致，只做语言拆分，不引入新的章节或功能承诺。

## Scope

- 改写 `README.md`
- 新增 `README.zh-CN.md`
- 不改动代码、脚本、构建配置和其他文档索引

## Validation

- 检查两个 README 文件都存在
- 检查两份文档顶部都有语言切换链接
- 检查 `README.md` 为英文主文档，`README.zh-CN.md` 为中文主文档
