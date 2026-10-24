// Runs before first paint so the loading wordmark never flashes in the header.
if (!location.hash || /^#\/?home(?:$|\/)/.test(location.hash))
  document.documentElement.classList.add("home-pending");
