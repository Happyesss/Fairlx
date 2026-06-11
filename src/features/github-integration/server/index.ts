import { Hono } from "hono";
import repository from "./route";
import documentation from "./documentation-route";
import commits from "./commits-route";
import qa from "./qa-route";
import oauth from "./oauth-route";
import webhooks from "./webhook-route";

const app = new Hono()
  .route("/repository", repository)
  .route("/documentation", documentation)
  .route("/commits", commits)
  .route("/qa", qa)
  .route("/oauth", oauth)
  .route("/webhooks", webhooks);

export default app;

