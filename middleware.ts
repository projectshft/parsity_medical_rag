import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only the LMS routes are gated. The medical-rag app (/, /upload, and all
// /api/* routes) get Clerk context but are NOT blocked, because we only
// call auth.protect() for /learn and /admin.
const isLmsRoute = createRouteMatcher(["/learn(.*)", "/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isLmsRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API/trpc routes
    "/(api|trpc)(.*)",
  ],
};
