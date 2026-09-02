"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NotFound() {
  const english = (usePathname() || "").startsWith("/en");
  return <main className="public-not-found">
    <div className="public-not-found-inner">
      <span className="public-not-found-code">404 / NOT FOUND</span>
      <h1>{english ? "Nothing is published here" : "这里没有这条内容"}</h1>
      <p>{english ? "The link may have changed, or the content is not public yet. Return to the library and keep looking." : "链接可能已经变更，或者内容还没有公开。返回资源库继续查找。"}</p>
      <Link href={english ? "/en/" : "/zh/"}>{english ? "Back to library" : "返回资源库"} →</Link>
    </div>
  </main>;
}
