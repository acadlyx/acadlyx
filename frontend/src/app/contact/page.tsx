import { PublicPage } from "@/components/public/PublicPage";
import { EnquiryForm } from "@/components/public/EnquiryForm";
import { publicMetadata } from "@/lib/seo/metadata";
export const metadata = publicMetadata({ title: "Contact sales", description: "Contact the ACADLYX team about institutional technology and product demonstrations.", path: "/contact" });
export default function ContactPage() { return <PublicPage title="Talk to the ACADLYX team." intro="Tell us what your institution is working towards and we will direct your enquiry appropriately."><section className="public-page-section public-section-soft"><div className="public-container public-form-layout"><div><h2>Contact sales</h2><p>For product, partnership and implementation conversations, send us a message.</p><p className="public-contact-note">Contact details are published by the institution when available. No public sales address is configured in this deployment.</p></div><EnquiryForm /></div></section></PublicPage>; }
