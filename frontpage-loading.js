/* Bounded, cancellable preparation. Progress counts settled resource jobs, not elapsed time. */
(function (root) {
  "use strict";
  async function prepare(
    sequence,
    {
      signal,
      onProgress = () => {},
      timeout = 12000,
      budget = 20000,
      visibleMediaLimit = 3,
    } = {},
  ) {
    const windowSize =
      Number.isInteger(visibleMediaLimit) &&
      visibleMediaLimit >= 1 &&
      visibleMediaLimit <= 10
        ? visibleMediaLimit
        : 3;
    const deadline = Date.now() + budget,
      jobs = new Map(),
      results = [];
    const sources = sequence.slice(0, 20).map((source) => {
      if (
        !["video", "mp4"].includes(source.type) &&
        source.src.startsWith("https://cdn.sanity.io/images/")
      ) {
        const url = new URL(source.src);
        url.searchParams.set("w", "800");
        url.searchParams.set("h", "800");
        url.searchParams.set("fit", "max");
        url.searchParams.set("auto", "format");
        url.searchParams.set("q", "80");
        return { ...source, src: url.href };
      }
      return source;
    });
    const key = (s) => s.type + ":" + s.src;
    for (const source of sources)
      if (!jobs.has(key(source)))
        jobs.set(key(source), { source, nodes: [], status: "pending" });
    let completed = 0;
    const progress = () => onProgress(++completed / (jobs.size * 2 || 1));
    function release(node) {
      node.onload = node.onerror = node.onloadeddata = null;
      node.remove();
      node.removeAttribute("src");
      if (node.tagName === "VIDEO") {
        node.pause();
        node.load();
      }
    }
    const dispose = () => {
      for (const job of jobs.values()) job.nodes.forEach(release);
    };
    function loadNode(job) {
      return new Promise((resolve) => {
        const video = ["video", "mp4"].includes(job.source.type),
          node = root.document.createElement(video ? "video" : "img");
        job.nodes.push(node);
        let done = false;
        const finish = (status) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          node.onload = node.onerror = node.onloadeddata = null;
          if (status !== "ready") release(node);
          resolve({ status, node });
        };
        const abort = () => finish("cancelled");
        const timer = setTimeout(
          () => finish("timeout"),
          Math.max(1, Math.min(timeout, deadline - Date.now())),
        );
        signal?.addEventListener("abort", abort, { once: true });
        node.onerror = () => finish("failed");
        if (video) {
          node.muted = true;
          node.loop = true;
          node.playsInline = true;
          node.preload = "auto";
          node.onloadeddata = () => {
            if (node.videoWidth && node.readyState >= 2) finish("ready");
          };
        } else {
          node.crossOrigin = "anonymous";
          node.alt = "";
          node.draggable = false;
          node.onload = async () => {
            try {
              await node.decode();
              root.Contrast?.prepareImage?.(job.source.src, node);
              finish("ready");
            } catch {
              finish("decode-failed");
            }
          };
        }
        node.src = job.source.src;
        if (signal?.aborted) abort();
      });
    }
    async function run(items, task) {
      const queue = [...items];
      await Promise.all(
        Array.from({ length: Math.min(4, queue.length) }, async () => {
          while (queue.length && !signal?.aborted) await task(queue.shift());
        }),
      );
    }
    await run(jobs.values(), async (job) => {
      const result = await loadNode(job);
      job.status = result.status;
      const n = result.node;
      job.ratio =
        n.tagName === "VIDEO"
          ? n.videoWidth / n.videoHeight
          : n.naturalWidth / n.naturalHeight;
      progress();
    });
    let ready = sources.filter((s) => jobs.get(key(s)).status === "ready");
    // Size each pool for the largest occurrence count in any cyclic FIFO window.
    // This is calculated after failures so even one surviving item can fill the configured window.
    await run(jobs.values(), async (job) => {
      if (job.status === "ready") {
        const copies = Math.max(
          1,
          ...ready.map(
            (_, i) =>
              Array.from(
                { length: windowSize },
                (_, j) => ready[(i + j) % ready.length],
              ).filter((s) => key(s) === key(job.source)).length,
          ),
        );
        for (let i = 1; i < copies; i++) {
          const result = await loadNode(job);
          if (result.status !== "ready") {
            job.status = result.status;
            break;
          }
        }
      }
      results.push({
        src: job.source.src,
        status: job.status,
        readiness: ["video", "mp4"].includes(job.source.type)
          ? "current-frame"
          : "decoded-image",
      });
      progress();
    });
    ready = ready.filter((s) => jobs.get(key(s)).status === "ready");
    // A failed secondary preparation can shorten the loop. Drop any resource
    // whose pool cannot support that degraded loop rather than decoding on input.
    for (let pass = 0; pass < jobs.size; pass++) {
      const insufficient = new Set();
      for (const job of jobs.values())
        if (job.status === "ready") {
          const copies = Math.max(
            1,
            ...ready.map(
              (_, i) =>
                Array.from(
                  { length: windowSize },
                  (_, j) => ready[(i + j) % ready.length],
                ).filter((s) => key(s) === key(job.source)).length,
            ),
          );
          if (job.nodes.length < copies) {
            job.status = "skipped-insufficient-pool";
            insufficient.add(key(job.source));
          }
        }
      if (!insufficient.size) break;
      ready = ready.filter((s) => !insufficient.has(key(s)));
    }
    for (const result of results)
      result.status = [...jobs.values()].find(
        (j) => j.source.src === result.src,
      ).status;
    function acquire(source, active) {
      return jobs.get(key(source)).nodes.find((n) => !active.includes(n));
    }
    return {
      sequence: ready.map((s) => ({
        ...s,
        aspectRatio: jobs.get(key(s)).ratio,
      })),
      results,
      acquire,
      dispose,
      visibleMediaLimit: windowSize,
    };
  }
  function wordmark(brand) {
    const text = brand.textContent.trim(),
      split = text.lastIndexOf(" ");
    const reuse =
      brand.children.length === 2 &&
      [...brand.children].every((node) => node.tagName === "SPAN");
    const first = reuse
        ? brand.firstElementChild
        : root.document.createElement("span"),
      last = reuse
        ? brand.lastElementChild
        : root.document.createElement("span");
    first.textContent = split < 0 ? text : text.slice(0, split);
    last.textContent = split < 0 ? "" : text.slice(split + 1);
    if (!reuse)
      brand.replaceChildren(first, root.document.createTextNode(" "), last);
    brand.dataset.animating = "true";
    let current = 0,
      target = 0,
      frame = 0,
      lastTime = 0,
      span = 0,
      closed = false;
    const reduced = root.matchMedia("(prefers-reduced-motion: reduce)");
    const measure = () => {
      last.style.transform = "none";
      span = Math.max(
        0,
        root.innerWidth -
          parseFloat(
            getComputedStyle(root.document.documentElement).getPropertyValue(
              "--pad",
            ),
          ) -
          last.getBoundingClientRect().right,
      );
      last.style.transform = `translateX(${span * (1 - current)}px)`;
    };
    const draw = (time) => {
      const dt = Math.min(64, time - lastTime || 16);
      lastTime = time;
      current = reduced.matches
        ? target
        : current + (target - current) * (1 - Math.exp(-dt / 90));
      if (target === 1 && 1 - current < 0.0005) current = 1;
      last.style.transform = `translateX(${span * (1 - current)}px)`;
      if (!closed) frame = root.requestAnimationFrame(draw);
    };
    measure();
    frame = root.requestAnimationFrame(draw);
    root.addEventListener("resize", measure);
    root.visualViewport?.addEventListener("resize", measure);
    root.document.fonts?.addEventListener("loadingdone", measure);
    return {
      progress: (p) => {
        target = p;
      },
      complete: () =>
        new Promise((resolve) => {
          target = 1;
          const check = () => {
            if (closed || current === 1) resolve();
            else root.requestAnimationFrame(check);
          };
          check();
        }),
      dispose: () => {
        closed = true;
        root.cancelAnimationFrame(frame);
        root.removeEventListener("resize", measure);
        root.visualViewport?.removeEventListener("resize", measure);
        root.document.fonts?.removeEventListener("loadingdone", measure);
        last.style.transform = "";
        delete brand.dataset.animating;
      },
    };
  }
  root.FrontpageLoading = { prepare, wordmark };
})(globalThis);
