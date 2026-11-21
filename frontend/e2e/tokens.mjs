// Resolve a design token (CSS custom property from src/shared/styles/tokens.css) to the browser's
// computed colour string, so specs assert "uses the accent token" instead of a pinned RGB value.
export async function tokenColor(page, name) {
  return page.evaluate(variable => {
    const probe = document.createElement("span");
    probe.style.color = `var(${variable})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}
