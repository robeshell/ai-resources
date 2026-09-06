import styles from "@/components/CatalogLoading.module.css";

// This boundary belongs only to the directory, never to a detail route.
export default function Loading() {
  return <div className={styles.grid} aria-busy="true" aria-hidden="true">
    {Array.from({ length: 4 }, (_, group) => <div key={group}>
      <span className={styles.heading} />
      {Array.from({ length: 4 }, (_, row) => <div className={styles.row} key={row}>
        <span className={styles.logo} /><span className={styles.line} />
      </div>)}
    </div>)}
  </div>;
}
