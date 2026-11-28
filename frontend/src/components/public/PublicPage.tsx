import Link from "next/link";
import { ReactNode } from "react";
import { PublicSiteShell } from "./PublicSiteShell";

export function PublicPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) { return <PublicSiteShell><section className="public-page-hero"><div className="public-container"><h1>{title}</h1><p>{intro}</p></div></section>{children}</PublicSiteShell>; }
export function InfoGrid({ items }: { items: { id?: string; title: string; text: string; detail?: string }[] }) { return <section className="public-page-section"><div className="public-container public-info-grid">{items.map((item) => <article id={item.id} key={item.title}><h2>{item.title}</h2><p>{item.text}</p>{item.detail ? <p className="public-info-detail">{item.detail}</p> : null}</article>)}</div></section>; }
export function PageCallout({ title, text }: { title: string; text: string }) { return <section className="public-section public-section-soft"><div className="public-container public-page-callout"><div><h2>{title}</h2><p>{text}</p></div><Link href="/request-demo" className="public-button">Request a demo</Link></div></section>; }
