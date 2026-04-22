import helmet from "helmet";
import type { HelmetOptions } from "helmet";

import config from "./env.js";

const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },

  strictTransportSecurity: config.app.isProd
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,

  noSniff: true,
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  ieNoOpen: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
};

export default helmet(helmetOptions);
