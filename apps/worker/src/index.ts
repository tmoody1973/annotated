import Fastify from "fastify";

const PORT = Number(process.env.PORT ?? 8080);

const fastify = Fastify({ logger: true });

fastify.get("/health", async () => ({ status: "ok" }));

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
