const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const typingText = document.getElementById("typingText");
const revealItems = document.querySelectorAll(".reveal");
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");
const scrollProgress = document.getElementById("scrollProgress");
const navAnchors = navLinks ? [...navLinks.querySelectorAll("a[href^='#']")] : [];
const heroMockup = document.getElementById("heroMockup");
const projectHighlightLinks = document.querySelectorAll('a[href="#kissanmitra-project"]');
const kissanmitraProject = document.getElementById("kissanmitra-project");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("show");
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("show");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const words = [
  "Python coding and automation",
  "Data analysis and insights",
  "AI and machine learning basics",
  "Real-world engineering projects"
];

let wordIndex = 0;
let charIndex = 0;
let deleting = false;

function runTypingEffect() {
  if (!typingText) return;

  const currentWord = words[wordIndex];
  typingText.textContent = currentWord.substring(0, charIndex);

  if (!deleting && charIndex < currentWord.length) {
    charIndex += 1;
    setTimeout(runTypingEffect, 80);
  } else if (deleting && charIndex > 0) {
    charIndex -= 1;
    setTimeout(runTypingEffect, 45);
  } else {
    deleting = !deleting;

    if (!deleting) {
      wordIndex = (wordIndex + 1) % words.length;
    }

    setTimeout(runTypingEffect, deleting ? 1200 : 300);
  }
}

runTypingEffect();

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
      }
    });
  },
  {
    threshold: 0.14
  }
);

revealItems.forEach((item) => observer.observe(item));

function updateScrollProgress() {
  if (!scrollProgress) return;

  const scrollTop = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  scrollProgress.style.width = `${progress}%`;
}

function updateActiveNav() {
  if (!navAnchors.length) return;

  const sections = navAnchors
    .map((anchor) => document.querySelector(anchor.getAttribute("href")))
    .filter(Boolean);

  let currentId = "";

  sections.forEach((section) => {
    const top = section.offsetTop - 140;
    const bottom = top + section.offsetHeight;

    if (window.scrollY >= top && window.scrollY < bottom) {
      currentId = section.id;
    }
  });

  navAnchors.forEach((anchor) => {
    const isActive = anchor.getAttribute("href") === `#${currentId}`;
    anchor.classList.toggle("is-active", isActive);
  });
}

updateScrollProgress();
updateActiveNav();

window.addEventListener("scroll", () => {
  updateScrollProgress();
  updateActiveNav();
});

if (heroMockup) {
  heroMockup.addEventListener("mousemove", (event) => {
    const rect = heroMockup.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const rotateY = ((offsetX / rect.width) - 0.5) * 10;
    const rotateX = ((offsetY / rect.height) - 0.5) * -10;

    heroMockup.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  heroMockup.addEventListener("mouseleave", () => {
    heroMockup.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  });
}

if (projectHighlightLinks.length && kissanmitraProject) {
  projectHighlightLinks.forEach((link) => {
    link.addEventListener("click", () => {
      kissanmitraProject.classList.remove("project-highlighted");

      // Re-trigger the glow even if the card was already highlighted before.
      requestAnimationFrame(() => {
        kissanmitraProject.classList.add("project-highlighted");
      });

      window.setTimeout(() => {
        kissanmitraProject.classList.remove("project-highlighted");
      }, 2600);
    });
  });
}

if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector('button[type="submit"]');
    const formData = new FormData(contactForm);
    const payload = {
      name: formData.get("name")?.toString().trim(),
      email: formData.get("email")?.toString().trim(),
      message: formData.get("message")?.toString().trim()
    };

    if (formMessage) {
      formMessage.classList.remove("is-success", "is-error");
    }

    if (!payload.name || !payload.email || !payload.message) {
      if (formMessage) {
        formMessage.textContent = "Please fill in all fields before sending your message.";
        formMessage.classList.add("is-error");
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to save your message right now.");
      }

      if (formMessage) {
        const emailSuffix = result.emailNotification
          ? " An email notification was also sent."
          : " It has been saved to the website database.";

        formMessage.textContent = `Thanks for your message.${emailSuffix}`;
        formMessage.classList.add("is-success");
      }

      contactForm.reset();
    } catch (error) {
      if (formMessage) {
        formMessage.textContent =
          error.message || "Something went wrong while saving your message.";
        formMessage.classList.add("is-error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Send Message";
      }
    }
  });
}
