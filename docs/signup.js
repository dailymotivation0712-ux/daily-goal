// Signup forms and the giant "wordmark" letters. Shared by index.html and archive.html.
//
// Forms post to Buttondown in the background, so visitors stay on this page.
// Buttondown doesn't let other sites read its reply (no CORS), so the request
// goes out "no-cors": a network failure still rejects, and then the form falls
// back to a normal post. Buttondown emails a confirmation link either way.
//
// fx.js (Motion) supplies the animations through window.signupFx. Without it
// the form simply swaps to its "check your inbox" message.

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sendSignup(form) {
  return fetch(form.action, {
    method: "POST",
    mode: "no-cors",
    body: new URLSearchParams(new FormData(form)),
  });
}

function setupSignup(block) {
  const form = block.querySelector("form");
  const input = form.querySelector('input[type="email"]');
  const message = block.querySelector(".signup-msg");
  const done = block.querySelector(".signup-done");
  const fx = () => window.signupFx || {};

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.state === "sending" || form.dataset.state === "sent") return;

    const email = input.value.trim();
    if (!EMAIL_OK.test(email)) {
      message.textContent = email ? "That doesn't look like an email yet." : "Add your email first.";
      fx().invalid?.(form);
      input.focus();
      return;
    }

    message.textContent = "";
    form.dataset.state = "sending";
    input.readOnly = true;
    const intro = fx().start ? fx().start(block) : Promise.resolve();
    try {
      await sendSignup(form);
    } catch {
      form.submit(); // couldn't reach Buttondown in the background: post the normal way
      return;
    }
    await intro;

    form.dataset.state = "sent";
    block.querySelector(".signup-email").textContent = email; // textContent: never parsed as HTML
    if (fx().done) fx().done(block); // shows the message once the envelope has flown
    else done.hidden = false;
  });

  block.querySelector(".signup-reset").addEventListener("click", () => {
    form.dataset.state = "";
    input.readOnly = false;
    done.hidden = true;
    fx().reset?.(block);
    input.select();
  });
}

// ---------- Wordmark: each line of big letters stretched to fill the band ----------

function setWordmark(wordmark, lines) {
  // One <span> per letter so fx.js can drop them in and out one by one.
  wordmark.replaceChildren(...lines.map((text) => {
    const line = document.createElement("div");
    line.className = "wm-line";
    for (const char of text) {
      const letter = document.createElement("span");
      letter.className = "wm-letter";
      letter.textContent = char === " " ? " " : char;
      line.append(letter);
    }
    return line;
  }));
  fitWordmark(wordmark);
  return [...wordmark.querySelectorAll(".wm-letter")];
}

function fitWordmark(wordmark) {
  // Every line shares one size: the longest line spans the full width.
  const lines = [...wordmark.querySelectorAll(".wm-line")];
  lines.forEach((line) => (line.style.fontSize = "100px"));
  const longest = Math.max(...lines.map((line) => line.scrollWidth));
  const size = `${(100 * wordmark.clientWidth) / longest}px`;
  lines.forEach((line) => (line.style.fontSize = size));
  wordmark.parentElement.style.setProperty("--wm-size", size); // phones space the card by it
}

document.querySelectorAll(".signup-block").forEach(setupSignup);

document.querySelectorAll(".wordmark").forEach((wordmark) => {
  setWordmark(wordmark, wordmark.dataset.lines.split("|"));
  // Refit once the display font has loaded, and whenever the width changes.
  document.fonts?.ready.then(() => fitWordmark(wordmark));
  new ResizeObserver(() => fitWordmark(wordmark)).observe(wordmark);
});
