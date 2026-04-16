import axios from "axios";
import http from "http";
import https from "https";
import logger from "../config/logger.js";

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000,
});

const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  httpAgent: httpAgent,
  httpsAgent: httpsAgent,
});

axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    logger.error({ err: error }, "[API Request Error]");
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      logger.error(
        {
          url: error.config?.url,
          status: error.response.status,
          data: error.response.data,
        },
        "[API Error]",
      );
    } else if (error.request) {
      logger.error({ err: error }, "[API Error] No response received");
    } else {
      logger.error({ err: error }, "[API Error]");
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
