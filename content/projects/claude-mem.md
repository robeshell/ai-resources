---
{
  "id": "claude-mem",
  "slug": "claude-mem",
  "blockType": "project",
  "title": "Claude-Mem",
  "status": "active",
  "category": "infra",
  "tags": [
    "self-host",
    "free",
    "cli"
  ],
  "sourceUrl": "https://github.com/thedotmack/claude-mem",
  "payload": {
    "summary": {
      "en": "Records agent sessions, compresses with AI, and pulls relevant context back into later ones.",
      "zh": "自动记录会话并用 AI 压缩，下次开会话时找回相关上下文。"
    },
    "body": {
      "zh": "## 它是什么\n\n安装并重启 Agent 后，Claude-Mem 会在每次会话中监听生命周期节点和工具调用，把改过的代码、排查过程和项目背景压成语义摘要，连同原始记录存进本地 SQLite；下次新会话启动时，它把相关记录按需放回上下文，不用重新解释代码库现状和既有决策，就能接着上次的工作继续。它跑在本地，是给编码 Agent 补跨会话记忆的一层，最初围绕 Claude Code 构建，现在也接入 OpenCode、Codex、Gemini、OpenClaw、Hermes、Copilot 等。\n\n和手工维护文档或整段粘贴聊天记录相比，采集与检索都随会话自动进行，读取是分层的：先给紧凑索引，需要时再展开时间线和完整记录，而非把整段历史一次性塞进上下文。\n\n## 怎么运行\n\n需要 Node.js 20 或更高版本。Claude Code 与 OpenCode 通过安装器接入：\n\n```bash\nnpx claude-mem install\nnpx claude-mem install --ide opencode\n```\n\n安装器会注册插件钩子并启动 Worker；全局执行 `npm install -g claude-mem` 只装 SDK，不完成这些接入步骤。装完要重启对应 Agent，新会话才会自动读取已有记忆。\n\n## 核心机制\n\n- **生命周期采集**：在会话开始、提交提示、工具调用后、停止和结束等节点记录活动。\n- **本地持久化**：Worker 作为本地 HTTP 服务运行，SQLite 保存会话、观察记录和摘要。\n- **混合检索**：全文检索加 Chroma 向量搜索，从历史记录里找相关内容。\n- **分层读取**：先返回紧凑索引，再按需查看时间线，最后通过 ID 读取完整记录，控制注入上下文的信息量。\n\n## 适合谁\n\n适合长期维护同一代码库、频繁切换会话的个人开发者，也适合让多个兼容 Agent 延续项目决策、故障排查过程和实现细节的团队。搜索结果附带观察记录 ID，可以追查某项改动所依据的历史。\n\n## 使用边界\n\n运行依赖 Node.js；Bun 和向量搜索所需的 `uv` 由安装流程处理。数据默认存在本机，但敏感内容不会自动排除，需要主动用 `<private>` 标签阻止存储。项目采用 Apache-2.0 许可，本地记忆不依赖托管服务；云同步属于可选入口。",
      "en": "## What it is\n\nOnce it is installed and the agent restarted, Claude-Mem listens to lifecycle events and tool calls in every session, compresses the code you changed, the debugging you did and the project background into semantic summaries, and stores them alongside the raw records in a local SQLite database. When a new session starts it puts the relevant records back into context on demand, so you continue where you left off without re-explaining the state of the codebase and the decisions already made. It runs locally, as a cross-session memory layer for coding agents; it was built around Claude Code first and now also plugs into OpenCode, Codex, Gemini, OpenClaw, Hermes and Copilot.\n\nCompared with maintaining notes by hand or pasting whole chat logs, both capture and retrieval happen automatically as the session runs, and reading is layered: a compact index first, then the timeline and the full records when you need them, rather than pushing the entire history into context at once.\n\n## How to run it\n\nNeeds Node.js 20 or newer. Claude Code and OpenCode are wired up through the installer:\n\n```bash\nnpx claude-mem install\nnpx claude-mem install --ide opencode\n```\n\nThe installer registers the plugin hooks and starts the worker; a global `npm install -g claude-mem` installs only the SDK and does none of that wiring. Restart the agent after installing, or new sessions will not pick up existing memory.\n\n## How it works\n\n- **Lifecycle capture**: records activity at session start, prompt submission, after tool calls, on stop and at the end.\n- **Local persistence**: the worker runs as a local HTTP service, with SQLite holding sessions, observations and summaries.\n- **Hybrid retrieval**: full-text search plus Chroma vector search to find relevant material in the history.\n- **Layered reads**: a compact index first, then the timeline on demand, then full records by ID, which keeps the volume injected into context under control.\n\n## Who it's for\n\nSolo developers who maintain one codebase over a long stretch and switch sessions often, and teams who want several compatible agents to carry project decisions, debugging trails and implementation details forward. Search results carry observation IDs, so you can trace the history a given change was based on.\n\n## Limits\n\nIt needs Node.js to run; Bun and the `uv` that vector search requires are handled by the install flow. Data stays on your machine by default, but sensitive content is not excluded automatically — you have to use a `<private>` tag to keep it from being stored. The project is Apache-2.0 licensed and local memory depends on no hosted service; cloud sync is an optional entry point."
    },
    "links": [
      {
        "label": "GitHub Repository",
        "url": "https://github.com/thedotmack/claude-mem",
        "kind": "repository"
      },
      {
        "label": "Documentation",
        "url": "https://docs.claude-mem.ai/",
        "kind": "docs"
      },
      {
        "label": "Official Website",
        "url": "https://claude-mem.ai/",
        "kind": "official"
      }
    ]
  }
}
---

## 它是什么

安装并重启 Agent 后，Claude-Mem 会在每次会话中监听生命周期节点和工具调用，把改过的代码、排查过程和项目背景压成语义摘要，连同原始记录存进本地 SQLite；下次新会话启动时，它把相关记录按需放回上下文，不用重新解释代码库现状和既有决策，就能接着上次的工作继续。它跑在本地，是给编码 Agent 补跨会话记忆的一层，最初围绕 Claude Code 构建，现在也接入 OpenCode、Codex、Gemini、OpenClaw、Hermes、Copilot 等。

和手工维护文档或整段粘贴聊天记录相比，采集与检索都随会话自动进行，读取是分层的：先给紧凑索引，需要时再展开时间线和完整记录，而非把整段历史一次性塞进上下文。

## 怎么运行

需要 Node.js 20 或更高版本。Claude Code 与 OpenCode 通过安装器接入：

```bash
npx claude-mem install
npx claude-mem install --ide opencode
```

安装器会注册插件钩子并启动 Worker；全局执行 `npm install -g claude-mem` 只装 SDK，不完成这些接入步骤。装完要重启对应 Agent，新会话才会自动读取已有记忆。

## 核心机制

- **生命周期采集**：在会话开始、提交提示、工具调用后、停止和结束等节点记录活动。
- **本地持久化**：Worker 作为本地 HTTP 服务运行，SQLite 保存会话、观察记录和摘要。
- **混合检索**：全文检索加 Chroma 向量搜索，从历史记录里找相关内容。
- **分层读取**：先返回紧凑索引，再按需查看时间线，最后通过 ID 读取完整记录，控制注入上下文的信息量。

## 适合谁

适合长期维护同一代码库、频繁切换会话的个人开发者，也适合让多个兼容 Agent 延续项目决策、故障排查过程和实现细节的团队。搜索结果附带观察记录 ID，可以追查某项改动所依据的历史。

## 使用边界

运行依赖 Node.js；Bun 和向量搜索所需的 `uv` 由安装流程处理。数据默认存在本机，但敏感内容不会自动排除，需要主动用 `<private>` 标签阻止存储。项目采用 Apache-2.0 许可，本地记忆不依赖托管服务；云同步属于可选入口。
