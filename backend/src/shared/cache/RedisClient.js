import { createClient } from "redis";
import "dotenv/config";

const client = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,

  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),

    // Disable TLS
    tls: false,

    keepAlive: 5000,

    reconnectStrategy: (retries) => {
      console.log(`Redis reconnecting: ${retries}`);
      return Math.min(retries * 100, 3000);
    }
  }
});

client.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

client.on("connect", () => {
  console.log("✅ Redis connected");
});

client.on("ready", () => {
  console.log("✅ Redis ready");
});

client.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

async function connectRedis() {
  try {
    if (!client.isOpen) {
      await client.connect();
    }
  } catch (err) {
    console.log("Redis connection failed:", err);
  }
}

export { client, connectRedis };