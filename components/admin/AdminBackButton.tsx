import Link from "next/link"

export default function AdminBackButton() {
  return (
    <Link
      href="/admin"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: "var(--btn-height-sm)",
        padding: "0 var(--spacing-md)",
        fontSize: "var(--font-base)",
        fontFamily: "monospace",
        fontWeight: 600,
        color: "var(--ev-gold-light)",
        background: "rgba(200,150,12,0.08)",
        border: "1px solid var(--ev-gold-light)",
        borderRadius: "var(--border-radius)",
        textDecoration: "none",
        letterSpacing: 1,
      }}
    >
      ← Admin Panel
    </Link>
  )
}
