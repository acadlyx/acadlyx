# ACADLYX Google Search Console readiness

## Canonical site

The production canonical URL is configured through `NEXT_PUBLIC_SITE_URL`. For the current Vercel deployment it is `https://acadlyx-orcin.vercel.app`. Change that one environment variable before deployment if a verified custom domain becomes canonical; do not use a preview deployment URL.

## Add the property

1. Open [Google Search Console](https://search.google.com/search-console/).
2. Add a URL-prefix property for the exact canonical URL, including `https://`.
3. Complete Google’s offered verification method. Do not add an unverified token to source control.
4. Confirm that `https://acadlyx-orcin.vercel.app/robots.txt` and `https://acadlyx-orcin.vercel.app/sitemap.xml` are publicly available.

## Submit and inspect

1. Submit `https://acadlyx-orcin.vercel.app/sitemap.xml` in **Sitemaps**.
2. Use **URL inspection** for `/`, `/education-erp`, `/features`, `/institutional-intelligence`, and `/contact`.
3. Request indexing only after production deployment and successful inspection.
4. Monitor **Page indexing** for excluded, blocked, duplicate, or “Crawled - currently not indexed” URLs. Improve the affected page’s unique content and internal links; do not repeatedly submit unchanged URLs.

## Ongoing monitoring

- Review **Performance** for branded queries such as `ACADLYX`, `ACADLYX ERP`, and `ACADLYX Education ERP`, then relevant non-branded queries.
- Review **Core Web Vitals** after field data becomes available. Lighthouse is diagnostic; Search Console reports real-user data.
- Keep dashboards, authentication pages, tenant routes, and APIs out of the sitemap. These receive `X-Robots-Tag: noindex, nofollow, noarchive` but must remain protected by normal server-side authorization.
- Re-submit the sitemap only when public URL inventory changes. Google indexing and rankings are not guaranteed.
