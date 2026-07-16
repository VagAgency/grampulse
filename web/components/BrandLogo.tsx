import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string;
  size?: number;
  showName?: boolean;
  className?: string;
};

export function BrandLogo({ href = "/", size = 32, showName = true, className = "" }: Props) {
  const content = (
    <span className={`brand-logo${className ? ` ${className}` : ""}`}>
      <Image
        src="/logo.png"
        alt="GramPulse"
        width={size}
        height={size}
        className="brand-logo-image"
        priority
      />
      {showName && <span className="brand-logo-name gradient-text">GramPulse</span>}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="brand-logo-link">
      {content}
    </Link>
  );
}
