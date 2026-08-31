---
{
  "id": "openai-skills",
  "slug": "openai-skills",
  "blockType": "skill",
  "title": "OpenAI Skills",
  "status": "active",
  "tags": [],
  "sourceUrl": "https://github.com/openai/skills",
  "payload": {
    "summary": {
      "en": "Instruction folders that teach Codex specialized tasks; deprecated, succeeded by OpenAI Plugins.",
      "zh": "指令打包成技能装进 Codex，仓库已弃用转 Plugins。"
    },
    "body": "## 它解决什么问题\n\nCodex 默认什么都会一点、什么都不精。这个仓库把做好某一类专项活的指令、脚本和参考资料打包成文件夹（Agent Skills 格式，遵循 agentskills.io 的开放标准），装进 Codex 后，它在处理 GitHub issue 评论、写执行计划这类有固定套路的任务时表现更稳，团队也不用每次手写长 prompt。\n\n## 怎么使用\n\n仓库按安装方式分三类：\n\n- `.system`：新版 Codex 自带，无需手动装；\n- `.curated`：在 Codex 里按名字装，例如 `$skill-installer gh-address-comments`；\n- `.experimental`：需要给出技能文件夹的具体路径或 GitHub 目录 URL。\n\n装完要重启 Codex 才会加载新技能。\n\n## 输入与结果\n\n输入是一个技能文件夹：`SKILL.md` 里的指令加上附带的脚本与资源。输出是 Codex 会话里按该技能约定完成的工作产物。技能本身只是指令与资料，不会主动改动你的仓库，实际行为由 Codex 执行时决定。\n\n## 适合谁\n\n- 团队有固定的专项流程（代码评审、发布检查、文档格式），想固化成 Codex 每次照做的指令；\n- 已经在用 Codex、不想每次都敲长 prompt，希望技能随仓库版本管理。\n\n## 使用边界\n\n- 页面横幅写明仓库已弃用，技能示例整体搬到 OpenAI Plugins，新建技能改走 develop 的 Build plugins 文档；当参考实现读没问题，新收录内容别再指向这里。\n- 只面向 Codex，不是通用 Agent 技能市场。\n- 仓库没有统一 license，每个技能的许可见各自目录内的 `LICENSE.txt`。\n- 技能本身免费可读，但实际使用需要 Codex 环境。",
    "links": [
      {
        "label": "GitHub 仓库",
        "url": "https://github.com/openai/skills",
        "kind": "repository"
      },
      {
        "label": "后继仓库：OpenAI Plugins",
        "url": "https://github.com/openai/plugins",
        "kind": "reference"
      },
      {
        "label": "Codex Skills 文档",
        "url": "https://developers.openai.com/codex/skills",
        "kind": "docs"
      }
    ]
  }
}
---

## 它解决什么问题

Codex 默认什么都会一点、什么都不精。这个仓库把做好某一类专项活的指令、脚本和参考资料打包成文件夹（Agent Skills 格式，遵循 agentskills.io 的开放标准），装进 Codex 后，它在处理 GitHub issue 评论、写执行计划这类有固定套路的任务时表现更稳，团队也不用每次手写长 prompt。

## 怎么使用

仓库按安装方式分三类：

- `.system`：新版 Codex 自带，无需手动装；
- `.curated`：在 Codex 里按名字装，例如 `$skill-installer gh-address-comments`；
- `.experimental`：需要给出技能文件夹的具体路径或 GitHub 目录 URL。

装完要重启 Codex 才会加载新技能。

## 输入与结果

输入是一个技能文件夹：`SKILL.md` 里的指令加上附带的脚本与资源。输出是 Codex 会话里按该技能约定完成的工作产物。技能本身只是指令与资料，不会主动改动你的仓库，实际行为由 Codex 执行时决定。

## 适合谁

- 团队有固定的专项流程（代码评审、发布检查、文档格式），想固化成 Codex 每次照做的指令；
- 已经在用 Codex、不想每次都敲长 prompt，希望技能随仓库版本管理。

## 使用边界

- 页面横幅写明仓库已弃用，技能示例整体搬到 OpenAI Plugins，新建技能改走 develop 的 Build plugins 文档；当参考实现读没问题，新收录内容别再指向这里。
- 只面向 Codex，不是通用 Agent 技能市场。
- 仓库没有统一 license，每个技能的许可见各自目录内的 `LICENSE.txt`。
- 技能本身免费可读，但实际使用需要 Codex 环境。
