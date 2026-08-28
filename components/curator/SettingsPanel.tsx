"use client";

import { FormEvent, useEffect, useState } from "react";
import { curatorRequest } from "@/lib/curator-client";

export function SettingsPanel() {
  const [rankingUrl, setRankingUrl] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    curatorRequest<{ rankingUrl: string; updatedAt: string }>("/site")
      .then((site) => {
        setRankingUrl(site.rankingUrl);
        setUpdatedAt(site.updatedAt);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "无法读取设置"));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const site = await curatorRequest<{ updatedAt: string }>("/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankingUrl }),
      });
      setUpdatedAt(site.updatedAt);
      setMessage("已保存站点设置");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="curator-shell">
      <div className="curator-intro">
        <p className="curator-kicker">CURATOR / 设置</p>
        <h1>站点配置</h1>
        <p>评测站地址写在 site.json。最近更新日期会随资源保存自动更新。</p>
      </div>
      <form className="curator-composer" onSubmit={save}>
        <label>
          模型对比站
          <input value={rankingUrl} onChange={(event) => setRankingUrl(event.target.value)} required />
        </label>
        <p className="curator-setting-meta">最近写入 {updatedAt || "—"}</p>
        <div className="curator-composer-footer">
          <span>Agent 和模型选择在「收录」页，保存在本机浏览器。</span>
          <button type="submit" disabled={busy}>{busy ? "正在保存…" : "保存设置"}</button>
        </div>
      </form>
      {message ? <p className="curator-message">{message}</p> : null}
    </section>
  );
}
