import type { ReactNode } from 'react';

interface PageHeadProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  headerSlot?: ReactNode;
}

export function PageHead({ eyebrow, title, subtitle, headerSlot }: PageHeadProps) {
  return (
    <div className="page-head">
      {headerSlot ? (
        <div className="head-row">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h1>{title}</h1>
            {subtitle ? <p className="sub">{subtitle}</p> : null}
          </div>
          <div>{headerSlot}</div>
        </div>
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
