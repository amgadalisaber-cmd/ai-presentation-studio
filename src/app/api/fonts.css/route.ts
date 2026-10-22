import { getCurrentUser } from "@/lib/auth";
import { userFontCss } from "@/lib/fonts";
export async function GET() {
  const user = await getCurrentUser();
  const css = user ? await userFontCss(user.id, false) : "";
  return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "private, no-cache" } });
}
