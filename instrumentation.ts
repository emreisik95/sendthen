export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("./lib/queue");
    startWorker();
    const { startSmtpListener } = await import("./lib/smtp-listener");
    startSmtpListener();
  }
}
