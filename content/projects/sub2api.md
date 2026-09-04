---
{
  "id": "sub2api",
  "slug": "sub2api",
  "blockType": "project",
  "title": "Sub2API",
  "status": "active",
  "category": "infra",
  "tags": [
    "self-host",
    "china",
    "free",
    "api"
  ],
  "sourceUrl": "https://github.com/Wei-Shaw/sub2api",
  "payload": {
    "summary": {
      "en": "Self-hosted gateway that redistributes AI subscriptions as token-billed API keys, with upstream ToS risk on the user.",
      "zh": "自托管网关，把订阅额度按 token 拆成 API Key 共享，上游封号风险自负。"
    },
    "body": {
      "zh": "## 它是什么\n\nSub2API 是一个把 Claude、OpenAI、Gemini、Grok 等 AI 产品订阅转成 API 服务的开源网关。README 把它定位为「订阅额度分发」平台：上游挂一份官方订阅账号，网关生成一批平台 API Key，统一做认证、计费、负载均衡和请求转发，多个用户就能共用同一份订阅。技术栈是 Go 后端加 Vue 前端，数据落在 PostgreSQL 和 Redis，官方提供 Docker 部署。\n\n## 怎么运行\n\n项目自带 Dockerfile、Makefile 和 deploy 目录，README 没有给出完整启动命令序列，具体配置以仓库 deploy 目录为准。运行依赖三样：PostgreSQL 15+、Redis 7+ 和 Docker。启动后网关同时提供后端 API 与 Vue 管理面板，订阅账号和 API Key 都在面板里管理。\n\n## 核心机制\n\n- **订阅额度分发**：支持 OAuth 与 API Key 两类上游账号，一份订阅的额度按请求拆分给多个平台用户。\n- **token 级计费**：按 token 用量记录并计算成本，内置支付系统，方便自己搭一个按量收费的小型中转。\n- **智能调度**：自动挑选上游账号并保持粘性会话，另有按用户、按账号的双层并发限制和可配置的请求、token 限流。\n- **协议对接**：对外暴露兼容 OpenAI 等协议的接口，Claude Code、Codex 这类原生工具换掉 Base URL 即可接入。\n\n## 适合谁\n\n手里有 Claude 或 ChatGPT 订阅、想把额度拆给团队一起用的人；想自建 API 中转站、对用户按量计费的开发者同样合适，支付和限流都已经替你做好。\n\n## 使用边界\n\n项目声明使用它可能违反 Anthropic 等上游服务商的用户协议，账号封禁、服务中断等风险一律由使用者自负；官方只认可技术学习与研究用途，并明确从未授权任何形式的商业运营。自托管意味着后端、数据库和部署都要自己维护，配套的代理、充值类第三方服务在 README 里是赞助商而非必需件。",
      "en": "## What it is\n\nSub2API is an open-source gateway that turns AI product subscriptions — Claude, OpenAI, Gemini, Grok and others — into an API service. The README positions it as a \"subscription quota distribution\" platform: you attach an official subscription account upstream, the gateway issues a batch of platform API keys, and it handles authentication, billing, load balancing and request forwarding in one place, so several users can share a single subscription. The stack is a Go backend with a Vue frontend, data in PostgreSQL and Redis, and Docker deployment is provided.\n\n## How to run it\n\nThe project ships a Dockerfile, a Makefile and a deploy directory. The README gives no complete startup command sequence — take the repository's deploy directory as the source of truth for configuration. Running it depends on three things: PostgreSQL 15+, Redis 7+ and Docker. Once started, the gateway serves both the backend API and the Vue admin panel, and subscription accounts and API keys are both managed from that panel.\n\n## How it works\n\n- **Subscription quota distribution**: supports both OAuth and API key upstream accounts, splitting one subscription's quota across multiple platform users request by request.\n- **Token-level billing**: records and costs usage by token, with a built-in payment system, which makes it practical to run your own metered relay.\n- **Smart scheduling**: picks an upstream account automatically and keeps sessions sticky, with two layers of concurrency limits — per user and per account — plus configurable request and token rate limits.\n- **Protocol compatibility**: exposes OpenAI-compatible and similar interfaces, so native tools like Claude Code and Codex connect by swapping the base URL.\n\n## Who it's for\n\nPeople holding a Claude or ChatGPT subscription who want to split the quota across a team; equally, developers who want to run their own API relay and bill users by usage, since payments and rate limiting are already built.\n\n## Limits\n\nThe project states that using it may violate the terms of service of Anthropic and other upstream providers, and that account bans, service interruptions and similar risks are entirely the user's own. The maintainers endorse only technical study and research use, and state explicitly that they have never authorized commercial operation of any kind. Self-hosting means the backend, the database and the deployment are yours to maintain; the proxy and top-up third-party services in the README are sponsors, not requirements."
    },
    "links": [
      {
        "label": "GitHub 仓库",
        "url": "https://github.com/Wei-Shaw/sub2api",
        "kind": "official"
      },
      {
        "label": "中文 README",
        "url": "https://github.com/Wei-Shaw/sub2api/blob/main/README_CN.md",
        "kind": "docs"
      }
    ]
  }
}
---

## 它是什么

Sub2API 是一个把 Claude、OpenAI、Gemini、Grok 等 AI 产品订阅转成 API 服务的开源网关。README 把它定位为「订阅额度分发」平台：上游挂一份官方订阅账号，网关生成一批平台 API Key，统一做认证、计费、负载均衡和请求转发，多个用户就能共用同一份订阅。技术栈是 Go 后端加 Vue 前端，数据落在 PostgreSQL 和 Redis，官方提供 Docker 部署。

## 怎么运行

项目自带 Dockerfile、Makefile 和 deploy 目录，README 没有给出完整启动命令序列，具体配置以仓库 deploy 目录为准。运行依赖三样：PostgreSQL 15+、Redis 7+ 和 Docker。启动后网关同时提供后端 API 与 Vue 管理面板，订阅账号和 API Key 都在面板里管理。

## 核心机制

- **订阅额度分发**：支持 OAuth 与 API Key 两类上游账号，一份订阅的额度按请求拆分给多个平台用户。
- **token 级计费**：按 token 用量记录并计算成本，内置支付系统，方便自己搭一个按量收费的小型中转。
- **智能调度**：自动挑选上游账号并保持粘性会话，另有按用户、按账号的双层并发限制和可配置的请求、token 限流。
- **协议对接**：对外暴露兼容 OpenAI 等协议的接口，Claude Code、Codex 这类原生工具换掉 Base URL 即可接入。

## 适合谁

手里有 Claude 或 ChatGPT 订阅、想把额度拆给团队一起用的人；想自建 API 中转站、对用户按量计费的开发者同样合适，支付和限流都已经替你做好。

## 使用边界

项目声明使用它可能违反 Anthropic 等上游服务商的用户协议，账号封禁、服务中断等风险一律由使用者自负；官方只认可技术学习与研究用途，并明确从未授权任何形式的商业运营。自托管意味着后端、数据库和部署都要自己维护，配套的代理、充值类第三方服务在 README 里是赞助商而非必需件。
