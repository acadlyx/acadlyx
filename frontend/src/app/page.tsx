import Image from "next/image";
import Link from "next/link";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { publicMetadata } from "@/lib/seo/metadata";
import { getPublishedProductPage } from "@/lib/publicSiteContent";

export const metadata = publicMetadata({
  title: "ACADLYX | Education ERP for Colleges and Universities",
  description:
    "ACADLYX connects student information with admissions, academic, examination, finance and institutional workflows in one role-based Education ERP.",
  path: "/",
});

const institutionalWork = [
  {
    title: "Admissions and enrolment",
    description:
      "Review applications, record admission decisions and carry student information into the institution’s academic records.",
  },
  {
    title: "Academic operations",
    description:
      "Manage programmes, courses, sections, timetables and the records used by academic departments and faculty.",
  },
  {
    title: "Attendance and examinations",
    description:
      "Keep attendance, assessments, examination schedules and results connected to the student’s academic journey.",
  },
  {
    title: "Fees and institutional services",
    description:
      "Coordinate fee structures, collections, concessions and the supporting work of finance and administrative teams.",
  },
];

export default async function HomePage() {
  const cms = await getPublishedProductPage();
  const featuredMedia = cms?.media?.find((item) => Boolean(item.url));

  return (
    <PublicSiteShell>
      <section className="ac-home-hero" aria-labelledby="home-title">
        <div
          className={`public-container ac-home-hero-layout ${featuredMedia ? "" : "ac-home-hero-layout--text-only"}`}
        >
          <div className="ac-home-hero-copy">
            <h1 id="home-title">
              Admissions, academics and finance, connected to the student record.
            </h1>
            <p>
              ACADLYX is an Education ERP for colleges and universities. It
              connects student information with the academic, administrative
              and financial workflows used across an institution.
            </p>
            <Link href="/about-acadlyx" className="public-button ac-home-action">
              Learn more about ACADLYX
            </Link>
          </div>

          {featuredMedia ? (
            <figure className="ac-home-media">
              <Image
                src={featuredMedia.url}
                alt={featuredMedia.alt?.trim() || "ACADLYX product interface"}
                width={1440}
                height={960}
                sizes="(max-width: 820px) 100vw, 48vw"
                priority
              />
              {featuredMedia.caption?.trim() ? (
                <figcaption>{featuredMedia.caption}</figcaption>
              ) : null}
            </figure>
          ) : null}
        </div>
      </section>

      <section className="ac-home-workflow" aria-labelledby="workflow-title">
        <div className="public-container ac-home-workflow-layout">
          <div className="ac-home-section-intro">
            <h2 id="workflow-title">Institutional work moves across teams.</h2>
            <p>
              A student’s journey touches admissions, academic departments,
              faculty, examinations and finance. ACADLYX keeps the related
              records and processes in one system instead of making each team
              reconstruct the same information.
            </p>
          </div>

          <dl className="ac-home-workflow-list">
            {institutionalWork.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="ac-home-responsibility" aria-labelledby="responsibility-title">
        <div className="public-container ac-home-responsibility-layout">
          <h2 id="responsibility-title">
            Shared institutional information. Role-appropriate access.
          </h2>
          <div>
            <p>
              Students, faculty, academic departments, administration,
              leadership and finance teams do not need the same workspace.
              ACADLYX organises work around each role and applies permissions
              to the information and actions available to that user.
            </p>
            <p>
              The result is one institutional system with clear responsibility
              across the people who use it.
            </p>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
