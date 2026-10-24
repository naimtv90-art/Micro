/**
 * Micro Hearing Aid Centre - Client-Side Interactive Logic
 * Zero dependencies, blazing fast, lightweight
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initAppointmentModal();
  initProductFilters();
  initBookingForms();
  initHeroCarousel();
});

// Mobile Drawer Navigation
function initMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-menu-btn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const closeBtn = document.getElementById('closeMobileDrawer');
  const overlay = document.getElementById('mobileDrawerOverlay');

  if (!toggleBtn || !mobileDrawer) return;

  function openDrawer() {
    mobileDrawer.classList.add('open');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    mobileDrawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // Submenu toggles in mobile drawer
  const dropdownToggles = mobileDrawer.querySelectorAll('.drawer-has-sub > a');
  dropdownToggles.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const parent = link.parentElement;
      parent.classList.toggle('sub-open');
    });
  });
}

// Appointment Modal
function initAppointmentModal() {
  const modal = document.getElementById('appointmentModal');
  const openButtons = document.querySelectorAll('[data-open-appointment]');
  const closeBtn = document.getElementById('closeAppointmentModal');

  if (!modal) return;

  function openModal(branch = 'uttara') {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    const branchSelect = modal.querySelector('select[name="branch"]');
    if (branchSelect) {
      branchSelect.value = branch;
    }
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const branch = btn.getAttribute('data-branch') || 'uttara';
      openModal(branch);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

// Product Filter on Products Page
function initProductFilters() {
  const searchInput = document.getElementById('productSearchInput');
  const brandButtons = document.querySelectorAll('[data-filter-brand]');
  const typeButtons = document.querySelectorAll('[data-filter-type]');
  const productCards = document.querySelectorAll('.product-card');

  if (!productCards.length) return;

  let activeBrand = 'all';
  let activeType = 'all';
  let searchQuery = '';

  function applyFilters() {
    let visibleCount = 0;
    productCards.forEach(card => {
      const cardBrand = (card.getAttribute('data-brand') || '').toLowerCase();
      const cardType = (card.getAttribute('data-type') || '').toLowerCase();
      const cardTitle = (card.getAttribute('data-title') || '').toLowerCase();

      const matchesBrand = (activeBrand === 'all' || cardBrand === activeBrand);
      const matchesType = (activeType === 'all' || cardType.includes(activeType));
      const matchesSearch = (!searchQuery || cardTitle.includes(searchQuery) || cardBrand.includes(searchQuery));

      if (matchesBrand && matchesType && matchesSearch) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    const noResults = document.getElementById('noProductsNotice');
    if (noResults) {
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      applyFilters();
    });
  }

  brandButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      brandButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeBrand = btn.getAttribute('data-filter-brand').toLowerCase();
      applyFilters();
    });
  });

  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeType = btn.getAttribute('data-filter-type').toLowerCase();
      applyFilters();
    });
  });
}

// Interactive Booking Form Submission (AJAX)
function initBookingForms() {
  const forms = document.querySelectorAll('form[data-booking-form]');

  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerText : 'Submit';
      
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Submitting...';
      }

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        const res = await fetch('/api/appointment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
          form.innerHTML = `
            <div style="text-align: center; padding: 24px 10px;">
              <div style="width: 56px; height: 56px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 14px;">✓</div>
              <h3 style="color: #0f172a; margin-bottom: 8px;">Appointment Request Sent!</h3>
              <p style="color: #475569; font-size: 0.95rem; line-height: 1.5; margin-bottom: 16px;">${result.message}</p>
              <a href="https://wa.me/8801787519995?text=Hello%2C%20I%20just%20booked%20an%20appointment%20online" target="_blank" class="btn btn-whatsapp btn-sm">Message on WhatsApp</a>
            </div>
          `;
        } else {
          alert(result.error || 'Submission failed. Please call our helpline.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
          }
        }
      } catch (err) {
        alert('Could not connect to server. Please call 01787 51 999 5 directly.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = originalText;
        }
      }
    });
  });
}

// Hero Product Slider Carousel
function initHeroCarousel() {
  const el = document.querySelector('.ahcc-ps');
  if (!el) return;

  const vp = el.querySelector('.ahcc-ps-viewport');
  const prev = el.querySelector('.ahcc-ps-prev');
  const next = el.querySelector('.ahcc-ps-next');
  const cards = el.querySelectorAll('.ahcc-ps-card');
  if (!vp || !cards.length) return;

  const speed = parseInt(el.getAttribute('data-speed'), 10) || 2500;
  let timer = null;
  let resumeTimer = null;

  function step() {
    return cards.length > 1 ? (cards[1].offsetLeft - cards[0].offsetLeft) : 220;
  }

  function atEnd() {
    return vp.scrollLeft + vp.clientWidth >= vp.scrollWidth - 10;
  }

  function go(dir) {
    const s = step();
    if (dir > 0) {
      if (atEnd()) {
        vp.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        vp.scrollBy({ left: s, behavior: 'smooth' });
      }
    } else {
      if (vp.scrollLeft <= 10) {
        vp.scrollTo({ left: vp.scrollWidth, behavior: 'smooth' });
      } else {
        vp.scrollBy({ left: -s, behavior: 'smooth' });
      }
    }
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    clearTimeout(resumeTimer);
  }

  function start() {
    stop();
    timer = setInterval(() => {
      if (!document.hidden) {
        go(1);
      }
    }, speed);
  }

  if (prev) {
    prev.addEventListener('click', (e) => {
      e.preventDefault();
      go(-1);
      start();
    });
  }

  if (next) {
    next.addEventListener('click', (e) => {
      e.preventDefault();
      go(1);
      start();
    });
  }

  el.addEventListener('mouseenter', stop);
  el.addEventListener('mouseleave', start);
  el.addEventListener('touchstart', stop, { passive: true });
  el.addEventListener('touchend', () => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(start, 3500);
  }, { passive: true });

  start();
}

