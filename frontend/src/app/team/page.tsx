"use client";

import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

type TeamMember = {
  name: string;
  role: string;
  bio: string;
  imageUrl?: string;
};

export default function TeamPage() {
  const content = usePublicSiteContent();
  const page = content.pages.team || {};
  const members: TeamMember[] = Array.isArray(page.members) ? page.members : [];

  return (
    <PublicSiteShell>
      <section className="public-page-section">
        <header className="public-page-intro">
          <h1>{page.title || "The ACADLYX team"}</h1>
        </header>
        {members.length ? (
          <div className="public-team-list">
            {members.map((member, index) => {
              const initials = (member.name || "")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase();
              return (
                <article key={member.name + "-" + index} className="public-team-row">
                  <div className="public-team-photo">
                    {member.imageUrl ? (
                      <img src={member.imageUrl} alt={member.name} />
                    ) : (
                      <span aria-hidden="true">{initials || "—"}</span>
                    )}
                  </div>
                  <div className="public-team-copy">
                    <h2>{member.name}</h2>
                    <p className="public-team-role">{member.role}</p>
                    <p>{member.bio}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="public-empty-message">No team profiles have been published.</p>
        )}
      </section>
    </PublicSiteShell>
  );
}
