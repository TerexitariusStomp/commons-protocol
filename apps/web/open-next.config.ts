import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});
// workerd condition pulls in emotion "edge-light" files that NFT tracing
// never copies; default conditions resolve the files that were traced.
config.cloudflare = { ...config.cloudflare, useWorkerdCondition: false };
export default config;
