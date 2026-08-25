/*!
 * IIMM Ayodhya — site.js
 * ---------------------------------------------------------------
 * All custom front-end behaviour for the site lives here, instead
 * of being spread across inline HTML attributes/scripts. Bootstrap
 * (js/bootstrap.bundle.js) is still used for the navbar collapse,
 * carousels, etc. Everything below is plain vanilla JS — no
 * build step, no dependencies — so it can just be dropped into
 * any page with a single <script src="js/main.js"></script> tag.
 *
 * Structure:
 *   1. Utilities
 *   2. Toast notification engine
 *   3. Preloader
 *   4. Scroll progress bar
 *   5. Sticky header + back-to-top button
 *   6. Active nav-link highlighting
 *   7. Scroll-reveal animations
 *   8. Marquee hover-pause (fixes broken inline handlers)
 *   9. Dark mode toggle
 *  10. Copy-to-clipboard for contact info
 *  11. Newsletter / subscribe forms
 *  12. Register form validation
 *  13. Login form (validation, password toggle, mock auth)
 *  14. Smooth scroll + misc polish
 *  15. Boot
 * ---------------------------------------------------------------
 */

const IIMM = (() => {
  "use strict";

  /* ============================================================
   * 1. UTILITIES
   * ==========================================================*/
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const on = (el, evt, handler, opts) => {
    if (el) el.addEventListener(evt, handler, opts);
  };

  const create = (tag, props = {}, children = []) => {
    const el = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === "class") el.className = value;
      else if (key === "html") el.innerHTML = value;
      else if (key.startsWith("data-")) el.setAttribute(key, value);
      else el[key] = value;
    });
    children.forEach((child) => el.appendChild(child));
    return el;
  };

  const debounce = (fn, wait = 100) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[6-9]\d{9}$/;           // 10-digit Indian mobile
  const PIN_RE   = /^\d{6}$/;                // 6-digit PIN code
  const NAME_RE  = /^[A-Za-z][A-Za-z .]{1,49}$/;

  const currentPage = () =>
    (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* ============================================================
   * 2. TOAST NOTIFICATION ENGINE
   * (self-contained — builds its own DOM + styles, no markup
   *  required in the HTML files)
   * ==========================================================*/
  const Toast = (() => {
    let container;

    const ensureContainer = () => {
      if (container) return container;
      container = create("div", {
        id: "iimmToastStack",
        style:
          "position:fixed;top:1rem;right:1rem;z-index:2000;" +
          "display:flex;flex-direction:column;gap:.6rem;max-width:320px;",
      });
      document.body.appendChild(container);
      return container;
    };

    const ICONS = {
      success: "fa-solid fa-circle-check",
      error: "fa-solid fa-circle-exclamation",
      info: "fa-solid fa-circle-info",
    };

    const show = (message, type = "info", timeout = 3500) => {
      const stack = ensureContainer();
      const colors = {
        success: "#198754",
        error: "#dc3545",
        info: "#0264d5",
      };

      const toast = create("div", {
        class: "iimm-toast",
        style: `
          background:#fff;border-left:5px solid ${colors[type] || colors.info};
          box-shadow:0 .5rem 1.5rem rgba(0,0,0,.15);border-radius:.4rem;
          padding:.75rem 1rem;display:flex;align-items:center;gap:.6rem;
          font-size:.92rem;color:#212529;opacity:0;
          transform:translateX(20px);transition:opacity .25s ease,transform .25s ease;
        `,
      });

      toast.appendChild(
        create("i", {
          class: ICONS[type] || ICONS.info,
          style: `color:${colors[type] || colors.info};font-size:1.1rem;`,
        })
      );
      toast.appendChild(create("span", { html: message, style: "flex:1;" }));

      const closeBtn = create("i", {
        class: "fa-solid fa-xmark",
        style: "cursor:pointer;opacity:.5;",
      });
      on(closeBtn, "click", () => dismiss(toast));
      toast.appendChild(closeBtn);

      stack.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(0)";
      });

      const timer = setTimeout(() => dismiss(toast), timeout);
      toast.addEventListener("mouseenter", () => clearTimeout(timer));
    };

    const dismiss = (toast) => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      setTimeout(() => toast.remove(), 250);
    };

    return { show };
  })();

  /* ============================================================
   * 3. PRELOADER
   * ==========================================================*/
  const initPreloader = () => {
    const loader = create("div", {
      id: "iimmPreloader",
      style: `
        position:fixed;inset:0;z-index:9999;background:#fff;
        display:flex;align-items:center;justify-content:center;
        transition:opacity .4s ease, visibility .4s ease;
      `,
    });
    loader.appendChild(
      create("div", {
        style: `
          width:52px;height:52px;border-radius:50%;
          border:5px solid rgba(2,100,213,.15);
          border-top-color:rgb(2,100,213);
          animation:iimm-spin .8s linear infinite;
        `,
      })
    );

    const style = create("style", {
      html: `@keyframes iimm-spin{to{transform:rotate(360deg);}}`,
    });
    document.head.appendChild(style);
    document.body.prepend(loader);

    const hide = () => {
      loader.style.opacity = "0";
      loader.style.visibility = "hidden";
      setTimeout(() => loader.remove(), 450);
    };

    // Whichever happens first: full load, or a short safety timeout
    // (so a slow image never traps the visitor behind the loader).
    window.addEventListener("load", hide);
    setTimeout(hide, 1800);
  };

  /* ============================================================
   * 4. SCROLL PROGRESS BAR
   * ==========================================================*/
  const initProgressBar = () => {
    const bar = create("div", {
      id: "iimmProgressBar",
      style: `
        position:fixed;top:0;left:0;height:3px;width:0%;
        background:rgb(2,100,213);z-index:2100;
        transition:width .1s ease-out;
      `,
    });
    document.body.appendChild(bar);

    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = `${pct}%`;
    };

    on(window, "scroll", debounce(update, 10));
    update();
  };

  /* ============================================================
   * 5. STICKY HEADER SHADOW + BACK-TO-TOP BUTTON
   * ==========================================================*/
  const initHeaderAndBackToTop = () => {
    const nav = $("nav.navbar");
    const backToTop = create(
      "button",
      {
        id: "iimmBackToTop",
        type: "button",
        "aria-label": "Back to top",
        html: '<i class="fa-solid fa-arrow-up"></i>',
        style: `
          position:fixed;right:1.25rem;bottom:1.25rem;z-index:1500;
          width:46px;height:46px;border-radius:50%;border:none;
          background:rgb(2,100,213);color:#fff;font-size:1.1rem;
          box-shadow:0 .4rem 1rem rgba(0,0,0,.25);
          opacity:0;visibility:hidden;transform:translateY(12px);
          transition:opacity .25s ease,transform .25s ease,visibility .25s ease;
          cursor:pointer;
        `,
      }
    );
    document.body.appendChild(backToTop);

    on(backToTop, "click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );

    const toggle = () => {
      const show = window.scrollY > 400;
      backToTop.style.opacity = show ? "1" : "0";
      backToTop.style.visibility = show ? "visible" : "hidden";
      backToTop.style.transform = show ? "translateY(0)" : "translateY(12px)";

      if (nav) {
        nav.style.boxShadow =
          window.scrollY > 20 ? "0 .3rem .8rem rgba(0,0,0,.25)" : "none";
      }
    };

    on(window, "scroll", debounce(toggle, 10));
    toggle();
  };

  /* ============================================================
   * 6. ACTIVE NAV-LINK HIGHLIGHTING
   * ==========================================================*/
  const initActiveNavLink = () => {
    const page = currentPage();
    $$(".navbar-nav .nav-link").forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      link.classList.remove("active");
      if (href === page || (page === "index.html" && href === "about.html")) {
        // (about.html is used as the "Home" link across this site)
      }
      if (href === page) link.classList.add("active");
    });
  };

  /* ============================================================
   * 7. SCROLL-REVEAL ANIMATIONS
   * ==========================================================*/
  const initScrollReveal = () => {
    const targets = $$(
      ".card, .contact-box, .cb, .icon, section, .about-img"
    );
    if (!("IntersectionObserver" in window) || targets.length === 0) return;

    const style = create("style", {
      html: `
        .iimm-reveal{opacity:0;transform:translateY(24px);
          transition:opacity .6s ease,transform .6s ease;}
        .iimm-reveal.iimm-in{opacity:1;transform:translateY(0);}
      `,
    });
    document.head.appendChild(style);

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("iimm-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach((el, i) => {
      el.classList.add("iimm-reveal");
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 80}ms`;
      io.observe(el);
    });
  };

  /* ============================================================
   * 8. MARQUEE HOVER-PAUSE
   * The original markup called onmouseover="stop()" / onmouseout=
   * "start()" — those are not valid global functions, so hovering
   * silently threw a console error instead of pausing anything.
   * This wires it up properly.
   * ==========================================================*/
  const initMarquee = () => {
    $$("marquee").forEach((m) => {
      on(m, "mouseenter", () => {
        if (typeof m.stop === "function") m.stop();
      });
      on(m, "mouseleave", () => {
        if (typeof m.start === "function") m.start();
      });
    });
  };

  /* ============================================================
   * 9. DARK MODE TOGGLE
   * ==========================================================*/
  const initDarkMode = () => {
    const STORAGE_KEY = "iimm-theme";
    const navList = $(".navbar-nav");
    if (!navList) return;

    const li = create("li", { class: "nav-item d-flex align-items-center" });
    const btn = create("button", {
      id: "iimmThemeToggle",
      type: "button",
      class: "btn btn-sm btn-outline-light ms-lg-3 my-2 my-lg-0",
      "aria-label": "Toggle dark mode",
      html: '<i class="fa-solid fa-moon"></i>',
    });
    li.appendChild(btn);
    navList.appendChild(li);

    const applyTheme = (theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      btn.innerHTML =
        theme === "dark"
          ? '<i class="fa-solid fa-sun"></i>'
          : '<i class="fa-solid fa-moon"></i>';
    };

    const saved = localStorage.getItem(STORAGE_KEY) || "light";
    applyTheme(saved);

    on(btn, "click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  };

  /* ============================================================
   * 10. COPY-TO-CLIPBOARD FOR CONTACT INFO
   * ==========================================================*/
  const initClipboardCopy = () => {
    $$(".contact-box p, footer p, .row.mt-5 p").forEach((p) => {
      const text = p.textContent.trim();
      const isEmail = EMAIL_RE.test(text.split(/\s|<br>/)[0]);
      const isPhone = /\+?\d[\d\s]{7,}\d/.test(text);
      if (!isEmail && !isPhone) return;

      p.style.cursor = "pointer";
      p.title = "Click to copy";
      on(p, "click", async () => {
        const value = p.textContent.replace(/\s+/g, " ").trim();
        try {
          await navigator.clipboard.writeText(value);
          Toast.show("Copied to clipboard", "success");
        } catch (err) {
          Toast.show("Could not copy — please copy manually", "error");
        }
      });
    });
  };

  /* ============================================================
   * 11. NEWSLETTER / SUBSCRIBE FORMS
   * (there are near-identical "Subscribe" forms in several
   *  footers across the site — handle them all generically)
   * ==========================================================*/
  const initNewsletterForms = () => {
    $$("form.d-flex").forEach((form) => {
      const emailInput = $('input[type="email"]', form);
      const button = $("button", form);
      if (!emailInput || !button) return;

      on(form, "submit", (e) => {
        e.preventDefault();
        const value = emailInput.value.trim();

        if (!EMAIL_RE.test(value)) {
          emailInput.classList.add("is-invalid");
          Toast.show("Please enter a valid email address", "error");
          return;
        }
        emailInput.classList.remove("is-invalid");

        const originalHTML = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        // Simulated network round-trip — there is no backend wired
        // up yet, so this just gives the user real feedback.
        setTimeout(() => {
          button.disabled = false;
          button.innerHTML = originalHTML;
          emailInput.value = "";
          Toast.show("Thanks for subscribing to IIMM Ayodhya!", "success");
        }, 700);
      });
    });
  };

  /* ============================================================
   * 12. REGISTER FORM VALIDATION
   * ==========================================================*/
  const initRegisterForm = () => {
    const form = $('form[action=""].shadow-lg, form.shadow-lg');
    if (!form || currentPage() !== "register.html") return;

    const fields = {
      fullName: { el: $("#fullName", form), validate: (v) => NAME_RE.test(v.trim()), msg: "Enter a valid name (letters only, 2+ chars)" },
      email: { el: $("#email", form), validate: (v) => EMAIL_RE.test(v.trim()), msg: "Enter a valid email address" },
      phone: { el: $("#phone", form), validate: (v) => PHONE_RE.test(v.trim()), msg: "Enter a valid 10-digit mobile number" },
      dob: { el: $("#dob", form), validate: (v) => !v || new Date(v) <= new Date(), msg: "Date of birth cannot be in the future" },
      pincode: { el: $("#pincode", form), validate: (v) => !v || PIN_RE.test(v.trim()), msg: "Pincode must be 6 digits" },
    };

    const showError = (field, message) => {
      field.el.classList.add("is-invalid");
      field.el.classList.remove("is-valid");
      let feedback = field.el.parentElement.querySelector(".invalid-feedback");
      if (!feedback) {
        feedback = create("div", { class: "invalid-feedback" });
        field.el.parentElement.appendChild(feedback);
      }
      feedback.textContent = message;
    };

    const showValid = (field) => {
      field.el.classList.remove("is-invalid");
      field.el.classList.add("is-valid");
    };

    const validateField = (key) => {
      const field = fields[key];
      if (!field.el) return true;
      const ok = field.validate(field.el.value);
      ok ? showValid(field) : showError(field, field.msg);
      return ok;
    };

    Object.keys(fields).forEach((key) => {
      const field = fields[key];
      if (!field.el) return;
      on(field.el, "input", () => validateField(key));
      on(field.el, "blur", () => validateField(key));
    });

    on(form, "submit", (e) => {
      e.preventDefault();
      const results = Object.keys(fields).map(validateField);
      const allValid = results.every(Boolean);

      if (!allValid) {
        Toast.show("Please fix the highlighted fields", "error");
        const firstInvalid = form.querySelector(".is-invalid");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const submitBtn = $('button[type="submit"]', form);
      const originalHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';

      // Persist the registrant locally so the login page has
      // something real to check against (no backend exists yet).
      setTimeout(() => {
        try {
          const registrants = JSON.parse(
            localStorage.getItem("iimm-registrants") || "[]"
          );
          registrants.push({
            fullName: fields.fullName.el.value.trim(),
            email: fields.email.el.value.trim().toLowerCase(),
            phone: fields.phone.el.value.trim(),
            registeredAt: new Date().toISOString(),
          });
          localStorage.setItem(
            "iimm-registrants",
            JSON.stringify(registrants)
          );
        } catch (err) {
          /* localStorage unavailable — fail silently, non-critical */
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        form.reset();
        Object.values(fields).forEach((f) => f.el && f.el.classList.remove("is-valid"));
        Toast.show(
          "Registration submitted! We'll be in touch shortly.",
          "success",
          5000
        );
      }, 900);
    });
  };

  /* ============================================================
   * 13. LOGIN FORM
   * ==========================================================*/
  const initLoginForm = () => {
    if (currentPage() !== "login.html") return;

    const emailInput = $("#form2Example11");
    const passwordInput = $("#form2Example22");
    const loginBtn = $(".btn-login");
    const createBtn = $(".btn-outline-danger");

    if (createBtn) {
      on(createBtn, "click", () => {
        window.location.href = "register.html";
      });
    }

    // Password show/hide toggle
    if (passwordInput) {
      const wrap = passwordInput.closest(".input-icon-wrap") || passwordInput.parentElement;
      wrap.style.position = wrap.style.position || "relative";
      const eye = create("i", {
        class: "fa-solid fa-eye",
        style:
          "position:absolute;right:14px;top:50%;transform:translateY(-50%);" +
          "cursor:pointer;color:#888;",
      });
      wrap.appendChild(eye);
      on(eye, "click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        eye.className = isPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
        eye.style.cssText =
          "position:absolute;right:14px;top:50%;transform:translateY(-50%);" +
          "cursor:pointer;color:#888;";
      });
    }

    if (!loginBtn) return;

    on(loginBtn, "click", () => {
      const email = (emailInput?.value || "").trim().toLowerCase();
      const password = passwordInput?.value || "";

      if (!EMAIL_RE.test(email)) {
        emailInput.classList.add("is-invalid");
        Toast.show("Enter a valid email or phone number", "error");
        emailInput.focus();
        return;
      }
      emailInput.classList.remove("is-invalid");

      if (password.length < 4) {
        passwordInput.classList.add("is-invalid");
        Toast.show("Password looks too short", "error");
        passwordInput.focus();
        return;
      }
      passwordInput.classList.remove("is-invalid");

      const originalHTML = loginBtn.innerHTML;
      loginBtn.disabled = true;
      loginBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';

      setTimeout(() => {
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalHTML;

        let knownUser = null;
        try {
          const registrants = JSON.parse(
            localStorage.getItem("iimm-registrants") || "[]"
          );
          knownUser = registrants.find((r) => r.email === email);
        } catch (err) {
          /* ignore */
        }

        // There is no real authentication backend yet, so this is a
        // front-end-only demo: recognised registrants get a
        // personalised welcome, anyone else gets a generic notice
        // explaining that a server integration is still pending.
        if (knownUser) {
          Toast.show(`Welcome back, ${knownUser.fullName}!`, "success");
        } else {
          Toast.show(
            "Login UI works, but this site has no backend yet — register first to try the demo flow.",
            "info",
            5000
          );
        }
      }, 800);
    });
  };

  /* ============================================================
   * 14. SMOOTH SCROLL + MISC POLISH
   * ==========================================================*/
  const initSmoothScroll = () => {
    on(document, "click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute("href");
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const initFooterYear = () => {
    $$("p").forEach((p) => {
      if (/Copyright\s+\d{4}/i.test(p.textContent)) {
        p.innerHTML = p.innerHTML.replace(
          /\d{4}/,
          new Date().getFullYear()
        );
      }
    });
  };

  const initImageFadeIn = () => {
    $$("img").forEach((img) => {
      img.style.transition = "opacity .35s ease";
      if (img.complete) return;
      img.style.opacity = "0";
      on(img, "load", () => (img.style.opacity = "1"));
      on(img, "error", () => (img.style.opacity = "1"));
    });
  };

  /* ============================================================
   * 15. BOOT
   * ==========================================================*/
  const init = () => {
    initPreloader();
    initProgressBar();
    initHeaderAndBackToTop();
    initActiveNavLink();
    initMarquee();
    initDarkMode();
    initImageFadeIn();
    initSmoothScroll();
    initFooterYear();
    initClipboardCopy();
    initNewsletterForms();
    initRegisterForm();
    initLoginForm();

    // Reveal animations last, once layout has settled.
    window.requestAnimationFrame(initScrollReveal);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { Toast };
})();
