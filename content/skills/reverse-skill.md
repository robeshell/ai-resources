---
{
  "id": "reverse-skill",
  "slug": "reverse-skill",
  "blockType": "skill",
  "title": "Reverse-Skill",
  "status": "active",
  "category": "coding",
  "tags": [
    "self-host",
    "china",
    "free",
    "cli"
  ],
  "sourceUrl": "https://github.com/zhaoxuya520/reverse-skill",
  "payload": {
    "summary": {
      "en": "Routes reverse-engineering and pentest skills to coding agents, bootstrapping missing tools on demand.",
      "zh": "按任务自动路由逆向/渗透技能，缺工具时自装，经验自动沉淀复用"
    },
    "body": "## 它解决什么问题\n\n给 Claude Code、Kiro、Cursor、Cline 这类编码 Agent 补一套逆向、授权渗透测试与安全研究技能。不用它时，Agent 遇到逆向任务常不知道调哪个工具、缺依赖也不知道装，半路就卡住。这个包把技能按任务类型组织成路由表，命中后自动选对应技能并补齐运行环境。\n\n## 怎么使用\n\n以技能包形式装进 AI 编码客户端：仓库自带 `skills` 目录以及 `AGENTS.md`、`CLAUDE.md` 等配置文件，把仓库目录指给支持的客户端即可启用。README 没有给出单一安装命令，各客户端的技能加载方式以各自文档为准；克隆仓库后按客户端要求接入 `skills` 目录即可。\n\n## 输入与结果\n\n给它一个逆向、渗透或安全研究任务描述，Agent 按路由匹配技能；需要时按需自举工具链，例如调用 Kali 相关工具链、Burp MCP 等配套组件。任务过程与结论会沉淀到 `reports` 目录，形成自进化的经验库，同类任务后续直接复用。\n\n## 适合谁\n\n常做二进制逆向、CTF 或授权渗透测试的人，想把这些任务里重复的侦察、环境准备与工具链配置交给编码 Agent 完成。\n\n## 使用边界\n\n> 注意：仓库名与描述明确限定为\"授权\"渗透测试与安全研究，不要拿它打未授权的目标。\n\n技能包本身开源免费，可本地部署进自己的 Agent；实际能力取决于所挂载的编码 Agent，以及本地是否备好 Kali、Burp 等外部工具，不是所有技能开箱即用。",
    "links": [
      {
        "label": "GitHub 仓库",
        "url": "https://github.com/zhaoxuya520/reverse-skill",
        "kind": "repository"
      }
    ]
  }
}
---

## 它解决什么问题

给 Claude Code、Kiro、Cursor、Cline 这类编码 Agent 补一套逆向、授权渗透测试与安全研究技能。不用它时，Agent 遇到逆向任务常不知道调哪个工具、缺依赖也不知道装，半路就卡住。这个包把技能按任务类型组织成路由表，命中后自动选对应技能并补齐运行环境。

## 怎么使用

以技能包形式装进 AI 编码客户端：仓库自带 `skills` 目录以及 `AGENTS.md`、`CLAUDE.md` 等配置文件，把仓库目录指给支持的客户端即可启用。README 没有给出单一安装命令，各客户端的技能加载方式以各自文档为准；克隆仓库后按客户端要求接入 `skills` 目录即可。

## 输入与结果

给它一个逆向、渗透或安全研究任务描述，Agent 按路由匹配技能；需要时按需自举工具链，例如调用 Kali 相关工具链、Burp MCP 等配套组件。任务过程与结论会沉淀到 `reports` 目录，形成自进化的经验库，同类任务后续直接复用。

## 适合谁

常做二进制逆向、CTF 或授权渗透测试的人，想把这些任务里重复的侦察、环境准备与工具链配置交给编码 Agent 完成。

## 使用边界

> 注意：仓库名与描述明确限定为"授权"渗透测试与安全研究，不要拿它打未授权的目标。

技能包本身开源免费，可本地部署进自己的 Agent；实际能力取决于所挂载的编码 Agent，以及本地是否备好 Kali、Burp 等外部工具，不是所有技能开箱即用。
