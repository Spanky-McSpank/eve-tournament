import Link from "next/link"

interface BackButtonProps {
  href: string
  label: string
}

export default function BackButton({ href, label }: BackButtonProps) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: "var(--btn-height-sm)",
        padding: "0 var(--spacing-md)",
        fontSize: "var(--font-sm)",
        fontFamily: "monospace",
        fontWeight: 600,
        color: "var(--ev-gold-light)",
        background: "rgba(200,150,12,0.06)",
        border: "1px solid rgba(200,150,12,0.35)",
        borderRadius: "var(--border-radius)",
        textDecoration: "none",
        letterSpacing: 1,
        whiteSpace: "nowrap",
      }}
    >
      ← {label}
    </Link>
  )
}
