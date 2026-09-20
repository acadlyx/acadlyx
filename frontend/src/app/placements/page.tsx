import { redirect } from "next/navigation";

/**
 * This route used to render a static module whose tiles were not backed
 * by any placement data and whose buttons led nowhere. Career and
 * outcome analytics live at /intelligence, so the path redirects there
 * rather than presenting a second, disconnected surface.
 */
export default function Page(): never {
  redirect("/intelligence");
}
