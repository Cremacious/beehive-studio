import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeadProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  headerSlot?: ReactNode;
  back?: { href: string; label: string };
}

export function PageHead({ eyebrow, title, subtitle, headerSlot, back }: PageHeadProps) {
  return (
    <div className="page-head">
      {back ? (
        <Link href={back.href} className="back">
          <span className="icn"><ArrowLeft /></span>
          <span>Back to {back.label}</span>
        </Link>
      ) : null}
      {headerSlot ? (
        <>
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          <div className="head-row">
            {subtitle ? <p className="sub">{subtitle}</p> : <span />}
            <div>{headerSlot}</div>
          </div>
        </>
      ) : (
        <>
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="sub">{subtitle}</p> : null}
        </>
      )}
    </div>
  );
}
