// Convex Auth provider config — validates tokens issued by this deployment.
// CONVEX_SITE_URL is provided automatically by the Convex deployment.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
