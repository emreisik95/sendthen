/** HTTP-ready error thrown by send/quota paths. */
export class SendError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
