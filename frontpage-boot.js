// Keep the normal Frontpage header position from the first paint.
if (!location.hash || /^#\/?home(?:$|\/)/.test(location.hash))
  document.documentElement.classList.add("home-pending");
