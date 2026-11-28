import type { Metadata } from "next";
import { PublicPage } from "@/components/public/PublicPage";
import { EnquiryForm } from "@/components/public/EnquiryForm";
export const metadata: Metadata = { title: "Request a demo | ACADLYX", description: "Request an ACADLYX demonstration for your educational institution." };
export default function RequestDemoPage() { return <PublicPage title="See ACADLYX in the context of your institution." intro="Share a few details about your institution and the work you would like to improve."><section className="public-page-section public-section-soft"><div className="public-container public-form-layout"><div><h2>Request a demonstration</h2><p>We will use the information you provide to understand your requirements before responding.</p></div><EnquiryForm demo /></div></section></PublicPage>; }
