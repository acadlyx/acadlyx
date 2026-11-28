import Image from "next/image";
import Link from "next/link";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { publicMetadata } from "@/lib/seo/metadata";
import { getPublishedSiteContent } from "@/lib/publicSiteContent";

export async function generateMetadata() {
  const content = await getPublishedSiteContent();
  return publicMetadata({
    title:
      content?.seo?.title?.trim() ||
      "ACADLYX | Education ERP for Colleges and Universities",
    description:
      content?.seo?.description?.trim() ||
      "ACADLYX connects student information with admissions, academic, examination, finance and institutional workflows in one role-based Education ERP.",
    path: "/",
  });
}

const fallbackFeatures = [
  {
    title: "Admissions and enrolment",
    text: "Review applications, record admission decisions and carry student information into the academic record.",
  },
  {
    title: "Academic operations",
    text: "Manage programmes, courses, sections, timetables and the records used by academic departments and faculty.",
  },
  {
    title: "Attendance and examinations",
    text: "Keep attendance, assessments, examination schedules and results connected to the student’s academic journey.",
  },
  {
    title: "Fees and finance",
    text: "Coordinate fee structures, collections, concessions and the supporting work of finance teams.",
  },
];

export default async function HomePage() {
  const content = await getPublishedSiteContent();
  const hero = content?.hero;
  const sections = content?.sections;
  const configuredFeatures =
    sections?.features?.filter(
      (feature) => feature.title?.trim() && feature.text?.trim(),
    ) ?? [];
  const features =
    configuredFeatures.length > 0 ? configuredFeatures : fallbackFeatures;

  const media = content?.productPage?.media?.find((item) => item.url?.trim());
  const heroImageUrl = hero?.dashboardImageUrl?.trim() || media?.url || "";
  const heroImageAlt =
    hero?.dashboardImageUrl?.trim() === heroImageUrl && hero.dashboardImageAlt?.trim()
      ? hero.dashboardImageAlt
      : media?.url === heroImageUrl && media.alt?.trim()
        ? media.alt
        : "ACADLYX product interface";
  const heroCaption =
    hero?.dashboardCaption?.trim() ||
    (media?.url === heroImageUrl ? media.caption?.trim() : "") ||
    "";

  return (
    <PublicSiteShell>
      <section className="ac-home-hero" aria-labelledby="home-title">
        <div className={`public-container ac-home-hero-layout ${heroImageUrl ? "" : "ac-home-hero-layout--text-only"}`}>
          <div className="ac-home-hero-copy">
            <h1 id="home-title">
              {hero?.title?.trim() ||
                "Admissions, academics and finance, connected to the student record."}
            </h1>
            <p>
              {hero?.description?.trim() ||
                "ACADLYX is an Education ERP for colleges and universities. It connects student information with the academic, administrative and financial workflows used across an institution."}
            </p>
            <Link href="/about-acadlyx" className="public-button ac-home-action">
              Learn More About ACADLYX
            </Link>
          </div>

          {heroImageUrl ? (
            <figure className="ac-home-media">
              <Image
                src={heroImageUrl}
                alt={heroImageAlt}
                width={1440}
                height={960}
                sizes="(max-width: 820px) 100vw, 48vw"
                priority
                unoptimized
              />
              {heroCaption ? <figcaption>{heroCaption}</figcaption> : null}
            </figure>
          ) : null}
        </div>
      </section>

      <section className="ac-home-workflow" aria-labelledby="workflow-title">
        <div className="public-container ac-home-workflow-layout">
          <div className="ac-home-section-intro">
            <h2 id="workflow-title">
              {sections?.capabilitiesTitle?.trim() ||
                "The work that keeps an institution running."}
            </h2>
            <p>
              {sections?.capabilitiesDescription?.trim() ||
                "Admissions, student records, teaching activity, attendance, examinations and finance depend on the same institutional information. ACADLYX keeps those workflows in context."}
            </p>
          </div>

          <dl className="ac-home-workflow-list">
            {features.map((feature, index) => (
              <div key={feature.title || index}>
                <dt>{feature.title}</dt>
                <dd>{feature.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="ac-home-responsibility" aria-labelledby="responsibility-title">
        <div className="public-container ac-home-responsibility-layout">
          <h2 id="responsibility-title">
            {sections?.rolesTitle?.trim() ||
              "A student record, shared across the right teams."}
          </h2>
          <p>
            {sections?.rolesDescription?.trim() ||
              "Students, faculty, academic departments, administration, leadership and finance each work with different parts of the student record. ACADLYX gives each role a separate workspace and limits access to the information and actions their work requires."}
          </p>
        </div>
      </section>
    </PublicSiteShell>
  );
}
