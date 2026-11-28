import { PublicPage } from "@/components/public/PublicPage";
import { EnquiryForm } from "@/components/public/EnquiryForm";
import { publicMetadata } from "@/lib/seo/metadata";
export const metadata = publicMetadata({ title: "Request a demo", description: "Request an ACADLYX demonstration for your educational institution.", path: "/request-demo" });
export default function RequestDemoPage() { return <PublicPage title="See ACADLYX in the context of your institution." intro="Share a few details about your institution and the work you would like to improve."><section className="public-page-section public-section-soft"><div className="public-container public-form-layout"><div><h2>Request a demonstration</h2><p>We will use the information you provide to understand your requirements before responding.</p></div><EnquiryForm demo /></div></section></PublicPage>; }
