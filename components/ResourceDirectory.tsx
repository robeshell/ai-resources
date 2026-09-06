"use client";

import { ToolLogo } from "@/components/ToolLogo";
import { categoriesForBlock, categoryOf } from "@/lib/tags";
import type { Locale } from "@/lib/types";
import styles from "./ResourceDirectory.module.css";

type DirectoryItem = {
  id: string;
  name: string;
  logo?: string;
  category?: string;
  tags?: readonly string[];
};

// Read down each column, with related categories next to one another.
const toolColumns = [["coding", "infra"], ["chat", "agent"], ["image", "video"], ["audio", "research", "automation"]];
const toolOrder = toolColumns.flat();

export function ResourceDirectory<T extends DirectoryItem>({
  items, block, locale, onSelect,
}: {
  items: T[];
  block: "tool" | "site";
  locale: Locale;
  onSelect: (item: T) => void;
}) {
  const groups = categoriesForBlock(block).map((category) => ({
    id: category.id,
    label: category.label[locale],
    items: items.filter((item) => categoryOf(item, block) === category.id),
  })).filter((group) => group.items.length);
  if (block === "tool") {
    const rank = (id: string) => toolOrder.includes(id) ? toolOrder.indexOf(id) : toolOrder.length;
    groups.sort((a, b) => rank(a.id) - rank(b.id));
  }
  const uncategorized = items.filter((item) => !categoryOf(item, block));
  if (uncategorized.length) {
    const group = { id: "uncategorized", label: locale === "zh" ? "未分类" : "Other", items: uncategorized };
    if (block === "site") groups.unshift(group);
    else groups.push(group);
  }

  const columns: Array<typeof groups> = [[], [], [], []];
  groups.forEach((group, index) => {
    const preferred = block === "tool" ? toolColumns.findIndex((ids) => ids.includes(group.id)) : index;
    const column = preferred >= 0 && preferred < columns.length ? preferred : index % columns.length;
    columns[column].push(group);
  });

  return (
    <div className={styles.directory}>
      {columns.filter((column) => column.length).map((column) => (
        <div className={styles.column} key={column[0].id}>
        {column.map((group) => (
        <section className={styles.group} key={group.id} aria-labelledby={`${block}-group-${group.id}`}>
          <h2 id={`${block}-group-${group.id}`} className={styles.heading}>{group.label}</h2>
          <ul className={styles.list}>
            {group.items.map((item) => (
              <li key={item.id}>
                <button type="button" className={styles.row} onClick={() => onSelect(item)} aria-haspopup="dialog">
                  <span className={styles.logo}><ToolLogo tool={item} size={22} /></span>
                  <span className={styles.name}>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        ))}
        </div>
      ))}
    </div>
  );
}
