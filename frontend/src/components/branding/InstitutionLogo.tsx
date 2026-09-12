interface InstitutionLogoProps {
  name: string;
  logoUrl: string | null;
  size?: number;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Renders the institution's logo when one has been configured
 * (Institution.logoUrl, set through institution branding config —
 * never hard-coded here). Falls back to a monogram derived from the
 * institution name so the UI never has to invent a logo asset.
 */
export function InstitutionLogo({ name, logoUrl, size = 40 }: InstitutionLogoProps) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="rounded-md object-contain"
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-md bg-acadlyx-primary font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-label={`${name} logo placeholder`}
    >
      {initials(name)}
    </div>
  );
}
