type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
};

export function AppPageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <header className="app-page-header">
      {eyebrow ? <p className="app-eyebrow">{eyebrow}</p> : null}
      <div className="app-page-header-row">
        <div className="app-page-header-copy">
          <h1 className="app-page-title">{title}</h1>
          {subtitle ? <p className="app-page-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="app-page-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
