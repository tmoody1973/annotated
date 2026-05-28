export default {
  providers: [
    // Dev instance — kept during the Clerk production migration so existing
    // dev-issued sessions keep working; remove once fully cut over to prod.
    {
      domain: "https://elegant-slug-68.clerk.accounts.dev",
      applicationID: "convex",
    },
    // Production instance (clerk.annotated.sh).
    {
      domain: "https://clerk.annotated.sh",
      applicationID: "convex",
    },
  ],
};
