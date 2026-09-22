import { redirect } from "next/navigation";

/**
 * This route used to render a static demo module. The real workflow
 * lives at /intelligence, so the path now redirects there instead of
 * presenting a second, disconnected surface.
 */
export default function Page(): never {
  redirect("/intelligence");
}
