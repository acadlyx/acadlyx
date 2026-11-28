import Link from "next/link";
import Image from "next/image";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { publicMetadata } from "@/lib/seo/metadata";
import { getPublishedProductPage } from "@/lib/publicSiteContent";

export const metadata = publicMetadata({
  title: "ACADLYX | Education ERP & Institutional Intelligence Platform",
  description:
    "ACADLYX is an integrated Education ERP and Institutional Intelligence Platform that helps colleges and universities manage admissions, academics, attendance, examinations, fees, faculty, placements and institutional operations.",
  path: "/",
});

const capabilities = [
  ["Student information", "A connected student record across the institutional lifecycle."],
  ["Admissions", "Application review, admission decisions and enrolment handled in one workflow."],
  ["Academic management", "Programmes, courses, timetables and academic records managed together."],
  ["Attendance and examinations", "Attendance, assessments, examination schedules and results with the right controls."],
  ["Fees and finance", "Fee structures, collections, concessions and financial operations in one place."],
  ["People and operations", "Faculty, HR, library, placements, communication and institutional services."],
];

export default async function HomePage() {
  const cms = await getPublishedProductPage();
  const media = cms?.media?.filter((item) => item.url) || [];

  return (
    <PublicSiteShell>
      <section className="home-hero">
        <div className="public-container home-hero-copy">
          <h1>Software for the way institutions actually work.</h1>
          <p>
            ACADLYX brings student records, academic processes, finance and
            institutional operations into one connected education platform.
          </p>
          <Link href="/about-acadlyx" className="public-button home-primary-action">
            Learn More About ACADLYX
          </Link>
        </div>
      </section>

      <section className="home-section home-challenge" aria-labelledby="challenge-title">
        <div className="public-container home-editorial-grid">
          <h2 id="challenge-title">Institutional work crosses departments every day.</h2>
          <div>
            <p>
              A student record touches admissions, academics, examinations,
              accounts and administration. When those teams work in separate
              systems, people spend time reconciling information instead of
              moving the work forward.
            </p>
            <p>
              ACADLYX keeps those connected processes in the same operational
              environment, with access shaped by each person’s role.
            </p>
          </div>
        </div>
      </section>

      <section className="home-section home-capabilities" aria-labelledby="capabilities-title">
        <div className="public-container">
          <div className="home-capabilities-intro">
            <h2 id="capabilities-title">The systems an institution depends on.</h2>
            <p>
              From a student’s first application to academic records and
              financial operations, the work stays connected without treating
              every department as if it does the same job.
            </p>
          </div>
          <ul className="capability-ledger">
            {capabilities.map(([title, description]) => (
              <li key={title}>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section home-intelligence" aria-labelledby="intelligence-title">
        <div className="public-container home-intelligence-layout">
          <h2 id="intelligence-title">A clearer view of the institution.</h2>
          <div>
            <p>
              Operational information is useful when it can be understood in
              context. ACADLYX brings records and reporting closer to the
              processes that create them, helping authorized teams review
              activity and make informed decisions.
            </p>
            <p>
              Each workspace is organized around the responsibilities of the
              people who use it.
            </p>
          </div>
        </div>
      </section>

      {media.length > 0 ? (
        <section className="home-section home-experience" aria-labelledby="experience-title">
          <div className="public-container">
            <div className="home-experience-layout">
              <div>
                <h2 id="experience-title">Inside ACADLYX.</h2>
                <p>
                  A look at the product, published by the ACADLYX team.
                </p>
              </div>
              <figure className="home-cms-media">
                <Image
                  src={media[0].url}
                  alt={media[0].alt || "ACADLYX product interface"}
                  width={1200}
                  height={760}
                  sizes="(max-width: 820px) 100vw, 55vw"
                />
                {media[0].caption ? <figcaption>{media[0].caption}</figcaption> : null}
              </figure>
            </div>
          </div>
        </section>
      ) : null}

      <section className="home-closing">
        <div className="public-container">
          <h2>See how ACADLYX fits your institution.</h2>
          <p>
            Explore the platform, its workflows and the teams it brings
            together.
          </p>
          <Link href="/about-acadlyx" className="public-button home-primary-action">
            Learn More About ACADLYX
          </Link>
        </div>
      </section>
    </PublicSiteShell>
  );
}
