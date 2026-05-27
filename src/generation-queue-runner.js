function createGenerationQueueRunner({
  concurrency = 1,
  estimateSeconds = 90,
  onBeforeRun = null,
  onError = console.error
} = {}) {
  const queue = [];
  const jobs = new Map();
  let running = 0;

  function snapshot(requestId) {
    const pendingIds = queue.map((job) => job.id);
    const runningIds = [...jobs.values()]
      .filter((job) => job.status === "running")
      .map((job) => job.id);
    const queueTotal = pendingIds.length + runningIds.length;
    const pendingIndex = pendingIds.indexOf(requestId);
    const queuePosition = pendingIndex >= 0 ? pendingIndex + 1 : runningIds.includes(requestId) ? 0 : null;
    return {
      queuePosition,
      queueTotal,
      estimatedWaitSeconds: queuePosition && queuePosition > 0 ? queuePosition * estimateSeconds : 0
    };
  }

  function drain() {
    while (running < concurrency && queue.length) {
      const job = queue.shift();
      const current = jobs.get(job.id);
      if (!current) continue;
      current.status = "running";
      current.abortController = new AbortController();
      running += 1;
      Promise.resolve()
        .then(() => (onBeforeRun ? onBeforeRun(current) : null))
        .then(() => current.run({ signal: current.abortController.signal }))
        .catch((error) => onError(error))
        .finally(() => {
          running = Math.max(0, running - 1);
          jobs.delete(current.id);
          drain();
        });
    }
  }

  function enqueue(job) {
    if (!job?.id || typeof job.run !== "function") {
      throw new Error("queue job requires id and run");
    }
    if (jobs.has(job.id)) return snapshot(job.id);
    jobs.set(job.id, { ...job, status: "pending" });
    queue.push(jobs.get(job.id));
    drain();
    return snapshot(job.id);
  }

  function cancel(id) {
    const index = queue.findIndex((job) => job.id === id);
    if (index !== -1) {
      queue.splice(index, 1);
      jobs.delete(id);
      return "queued";
    }
    const current = jobs.get(id);
    if (current?.status !== "running") return false;
    current.status = "cancelled";
    current.abortController?.abort(new Error("client cancelled"));
    return "running";
  }

  function cancelQueued(id) {
    return cancel(id);
  }

  function has(id) {
    return jobs.has(id);
  }

  return {
    enqueue,
    cancel,
    cancelQueued,
    snapshot,
    drain,
    has
  };
}

module.exports = {
  createGenerationQueueRunner
};
