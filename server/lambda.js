// AWS Lambda entry point — exposes the Express app through a Lambda
// Function URL. Handler to configure on the function: lambda.handler
import serverless from "serverless-http";
import app from "./index.js";

export const handler = serverless(app);
