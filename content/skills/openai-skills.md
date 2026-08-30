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
      "en": "Instruction folders that teach Codex specialized tasks; the repo is deprecated in favor of OpenAI Plugins.",
      "zh": "把指令和脚本打包成技能装进 Codex，仓库已弃用转 Plugins。"
    },
    "body": "## 解决什么问题\n\nCodex 默认什么都会一点、什么都不精。这个仓库把「做好某件专项活」的指令、脚本和参考资料打包成文件夹（Agent Skills 格式，见 [agentskills.io](https://agentskills.io/) 的开放标准），装进 Codex 后它在对应任务上表现更稳，比如处理 GitHub issue 评论、写执行计划这类有固定套路的活。\n\n## 内容与分区\n\n仓库按安装方式分三类：\n\n- `.system` — 新版 Codex 自带，无需手动装\n- `.curated` — 按名字装，例如 `$skill-installer gh-address-comments`\n- `.experimental` — 需要给出具体文件夹路径或 GitHub 目录 URL\n\n## 适用场景\n\n- 团队里有重复性的专项流程（代码评审、发布检查、文档格式），想固化成 Codex 每次照做的指令\n- 不想每次都手写长 prompt，希望技能随仓库版本管理\n\n## 输入输出\n\n输入是技能文件夹本身（SKILL.md 指令 + 附带脚本/资源）；输出是 Codex 会话中按技能约定完成的工作产物。装完要**重启 Codex** 才会加载新技能。\n\n## 使用边界\n\n- **仓库已弃用**：页面横幅写明「This repository is deprecated」，后续技能示例统一搬到 [OpenAI Plugins](https://github.com/openai/plugins)，自定义技能改走 [Build plugins](https://developers.openai.com/codex/plugins/build) 这条路。当参考实现读没问题，新收录内容不该再指向这里。\n- 只面向 Codex，不是通用 Agent 技能市场\n- 仓库整体没有统一 license，每个技能的许可看其目录内的 `LICENSE.txt`\n- 无收费，代码开源可读，但实际使用需要 Codex 环境",
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
      },
      {
        "label": "Agent Skills 开放标准",
        "url": "https://agentskills.io/",
        "kind": "reference"
      }
    ]
  }
}
---

## 解决什么问题

Codex 默认什么都会一点、什么都不精。这个仓库把「做好某件专项活」的指令、脚本和参考资料打包成文件夹（Agent Skills 格式，见 [agentskills.io](https://agentskills.io/) 的开放标准），装进 Codex 后它在对应任务上表现更稳，比如处理 GitHub issue 评论、写执行计划这类有固定套路的活。

## 内容与分区

仓库按安装方式分三类：

- `.system` — 新版 Codex 自带，无需手动装
- `.curated` — 按名字装，例如 `$skill-installer gh-address-comments`
- `.experimental` — 需要给出具体文件夹路径或 GitHub 目录 URL

## 适用场景

- 团队里有重复性的专项流程（代码评审、发布检查、文档格式），想固化成 Codex 每次照做的指令
- 不想每次都手写长 prompt，希望技能随仓库版本管理

## 输入输出

输入是技能文件夹本身（SKILL.md 指令 + 附带脚本/资源）；输出是 Codex 会话中按技能约定完成的工作产物。装完要**重启 Codex** 才会加载新技能。

## 使用边界

- **仓库已弃用**：页面横幅写明「This repository is deprecated」，后续技能示例统一搬到 [OpenAI Plugins](https://github.com/openai/plugins)，自定义技能改走 [Build plugins](https://developers.openai.com/codex/plugins/build) 这条路。当参考实现读没问题，新收录内容不该再指向这里。
- 只面向 Codex，不是通用 Agent 技能市场
- 仓库整体没有统一 license，每个技能的许可看其目录内的 `LICENSE.txt`
- 无收费，代码开源可读，但实际使用需要 Codex 环境
