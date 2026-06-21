export function StatusBadge({
  status,
  subtle = false,
}: {
  status: string | null | undefined;
  subtle?: boolean;
}) {
  const clean = status || "unknown";
  const cls =
    clean.toLowerCase() === "ok"
      ? "badge badge-ok"
      : clean.toLowerCase().includes("error") || clean.toLowerCase().includes("fail")
        ? "badge badge-bad"
        : subtle
          ? "badge badge-subtle"
          : "badge badge-warn";

  return <span className={cls}>{clean}</span>;
}
