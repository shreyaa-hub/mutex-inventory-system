import Redis from "ioredis";

// same singleton trick as prisma to avoid connection leaks in dev
declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

const redis =
  global.redis ??
  new Redis({
    // host: "knowing-sailfish-92825.upstash.io",
    host: "inviting-kitten-100872.upstash.io",
    port: 6379,
    password: "gQAAAAAAAYoIAAIgcDE0Njg2YTRlYTY4Njc0YzcwYmFhOGUxNjY1ODFhZjE1OQ",
    tls: {},
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.redis = redis;
}

export default redis;