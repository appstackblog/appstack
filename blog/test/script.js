document.addEventListener("DOMContentLoaded", () => {
  const tagline = document.querySelector(".tagline");
  if (!tagline) return;

  const text = tagline.textContent?.trim() || "";
  if (!text) return;

  tagline.textContent = "";

  const fragment = document.createDocumentFragment();
  Array.from(text).forEach((ch, idx) => {
    const span = document.createElement("span");
    span.className = "char";
    span.style.setProperty("--i", idx);
    span.textContent = ch === " " ? "\u00A0" : ch;
    fragment.appendChild(span);
  });

  tagline.appendChild(fragment);
});
