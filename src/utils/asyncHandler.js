module.exports = function asyncHandler(fn) {
  return async function wrappedHandler(request, reply) {
    try {
      return await fn(request, reply);
    } catch (error) {
      if (request?.log) {
        request.log.error({ err: error }, "Route handler failed");
      }
      throw error;
    }
  };
};
