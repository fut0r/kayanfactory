/* 
   Kayan Al Khalij - Rebuilt Professional JavaScript Logic
   Pure Vanilla JS - Senior Developer Coding Standards
*/

document.addEventListener('DOMContentLoaded', () => {
  // 1. Language Translation System
  const langToggle = document.getElementById('lang-toggle');
  const langDropdown = document.getElementById('lang-dropdown');
  const langOptions = document.querySelectorAll('.lang-option');
  
  let currentLang = localStorage.getItem('selectedLanguage') || 'ar';
  
  // Set initial language
  setLanguage(currentLang);
  
  if (langToggle && langDropdown) {
    langToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      langDropdown.classList.toggle('show');
    });
    
    document.addEventListener('click', () => {
      langDropdown.classList.remove('show');
    });
    
    langOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const lang = opt.getAttribute('data-lang');
        currentLang = lang;
        setLanguage(lang);
        langDropdown.classList.remove('show');
      });
    });
  }

  function setLanguage(lang) {
    localStorage.setItem('selectedLanguage', lang);
    
    fetch('translations.json')
      .then(res => res.json())
      .then(data => {
        const t = data[lang];
        if (!t) return;
        
        // Translate elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.getAttribute('data-i18n');
          const val = t[key];
          if (!val) return;
          
          // Check if element contains icon child to preserve it
          const icon = el.querySelector('i');
          if (icon) {
            // Re-build element with icon + translated text
            el.innerHTML = '';
            el.appendChild(icon);
            el.appendChild(document.createTextNode(' ' + val));
          } else {
            el.textContent = val;
          }
        });
        
        // Update document attributes
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        
        // Restart marquee animation after dir change
        const marqueeContent = document.querySelector('.marquee-content');
        if (marqueeContent) {
          marqueeContent.style.animation = 'none';
          marqueeContent.offsetHeight; // Force reflow
          marqueeContent.style.animation = '';
        }
        
        // Update browser tab title
        const titleEl = document.querySelector('title[data-i18n]');
        if (titleEl) {
          const titleKey = titleEl.getAttribute('data-i18n');
          if (t[titleKey]) {
            document.title = t[titleKey];
          }
        }
        
        // Toggle language-specific blocks in HTML directly
        document.querySelectorAll('.lang-ar').forEach(el => {
          el.style.display = lang === 'ar' ? 'block' : 'none';
        });
        document.querySelectorAll('.lang-en').forEach(el => {
          el.style.display = lang === 'en' ? 'block' : 'none';
        });
        
        // Update active flag UI in toggle button if present
        const activeFlag = document.querySelector('.lang-btn .flag');
        const activeLangText = document.querySelector('.lang-btn span:not(.flag)');
        if (activeFlag && activeLangText) {
          activeFlag.textContent = lang === 'ar' ? '🇸🇦' : '🇬🇧';
          activeLangText.textContent = lang === 'ar' ? 'العربية' : 'English';
        }
      })
      .catch(err => console.error('Translation loading failed:', err));
  }

  // 2. Mobile Menu Navigation
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mainNav = document.querySelector('.main-nav');
  
  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = mainNav.classList.contains('mobile-active');
      mainNav.classList.toggle('mobile-active');
      mobileMenuBtn.classList.toggle('active');
      mobileMenuBtn.setAttribute('aria-expanded', !isActive);
    });
    
    // Close menu when clicking links
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('mobile-active');
        mobileMenuBtn.classList.remove('active');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        mainNav.classList.remove('mobile-active');
        mobileMenuBtn.classList.remove('active');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // 3. Homepage Showcase Carousel (Single Slide Scrolling)
  (function initShowcaseCarousel() {
    const track = document.querySelector('.carousel .carousel-track');
    const slides = document.querySelectorAll('.carousel .carousel-slide');
    const prevBtn = document.querySelector('.carousel .carousel-control.prev');
    const nextBtn = document.querySelector('.carousel .carousel-control.next');
    const dotsContainer = document.querySelector('.carousel .carousel-dots');
    
    if (!track || slides.length === 0) return;
    
    let currentIndex = 0;
    let autoplayTimer = null;
    
    // Create dots
    dotsContainer.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => {
        goToSlide(i);
        resetAutoplay();
      });
      dotsContainer.appendChild(dot);
    });
    
    const dots = dotsContainer.querySelectorAll('button');
    
    function updateCarousel() {
      track.style.transform = `translateX(${currentIndex * 100}%)`;
      dots.forEach((dot, i) => {
        dot.setAttribute('aria-selected', i === currentIndex ? 'true' : 'false');
      });
    }
    
    function goToSlide(index) {
      // In LTR slide index works as negative translate, in RTL it is positive
      const isRTL = document.documentElement.dir === 'rtl';
      currentIndex = index;
      const offset = isRTL ? index * 100 : index * -100;
      track.style.transform = `translateX(${offset}%)`;
      dots.forEach((dot, i) => {
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
    }
    
    function nextSlide() {
      let index = (currentIndex + 1) % slides.length;
      goToSlide(index);
    }
    
    function prevSlide() {
      let index = (currentIndex - 1 + slides.length) % slides.length;
      goToSlide(index);
    }
    
    if (nextBtn && prevBtn) {
      nextBtn.addEventListener('click', () => {
        nextSlide();
        resetAutoplay();
      });
      prevBtn.addEventListener('click', () => {
        prevSlide();
        resetAutoplay();
      });
    }
    
    // Autoplay
    function startAutoplay() {
      autoplayTimer = setInterval(nextSlide, 5000);
    }
    
    function stopAutoplay() {
      if (autoplayTimer) clearInterval(autoplayTimer);
    }
    
    function resetAutoplay() {
      stopAutoplay();
      startAutoplay();
    }
    
    track.addEventListener('mouseenter', stopAutoplay);
    track.addEventListener('mouseleave', startAutoplay);
    
    startAutoplay();
  })();

  // 4. Hero Background slideshow
  (function initHeroSlideshow() {
    const heroSlides = document.querySelectorAll('.hero-bg img');
    if (heroSlides.length <= 1) return;
    
    let currentSlide = 0;
    setInterval(() => {
      heroSlides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % heroSlides.length;
      heroSlides[currentSlide].classList.add('active');
    }, 6000);
  })();

  // 5. Stats Counters Animation
  (function initStatsCounter() {
    const statsNumbers = document.querySelectorAll('.stat-number');
    if (statsNumbers.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-count') || '0', 10);
          if (target > 0) {
            let current = 0;
            const step = Math.ceil(target / 50);
            const timer = setInterval(() => {
              current += step;
              if (current >= target) {
                el.textContent = target + (el.textContent.includes('+') ? '+' : '');
                clearInterval(timer);
              } else {
                el.textContent = current + (el.textContent.includes('+') ? '+' : '');
              }
            }, 30);
          }
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.1 });
    
    statsNumbers.forEach(stat => observer.observe(stat));
  })();

  // 6. Header Scroll Styling
  const mainHeader = document.querySelector('.main-header');
  if (mainHeader) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        mainHeader.classList.add('scrolled');
      } else {
        mainHeader.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // 7. Back To Top Button
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('show');
      } else {
        backToTopBtn.classList.remove('show');
      }
    }, { passive: true });
    
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // 8. Testimonials Form and local storage integration
  const reviewForm = document.getElementById('testimonial-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('testimonial-name').value.trim();
      const service = document.getElementById('testimonial-service').value;
      const rating = document.querySelector('input[name="rating"]:checked')?.value || '5';
      const message = document.getElementById('testimonial-message').value.trim();
      
      if (!name || !message || !service) {
        alert(currentLang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
        return;
      }
      
      const newReview = {
        name,
        service,
        rating: parseInt(rating, 10),
        message,
        date: new Date().toISOString()
      };
      
      // Save reviews locally
      const reviews = JSON.parse(localStorage.getItem('testimonials') || '[]');
      reviews.unshift(newReview);
      localStorage.setItem('testimonials', JSON.stringify(reviews));
      
      // Reset form
      reviewForm.reset();
      
      alert(currentLang === 'ar' ? 'تم تقديم تقييمك بنجاح! شكراً لك.' : 'Your review was submitted successfully! Thank you.');
      
      // Reload testimonials list if we are on comments page or home page
      loadLocalTestimonials();
    });
  }

  function loadLocalTestimonials() {
    const grid = document.querySelector('.testimonials-grid');
    if (!grid) return;
    
    const localTestimonials = JSON.parse(localStorage.getItem('testimonials') || '[]');
    
    // If we have local reviews, display them alongside default reviews
    if (localTestimonials.length > 0) {
      // Create HTML elements for local reviews
      const html = localTestimonials.map(t => `
        <div class="testimonial-card">
          <div class="testimonial-content">
            <div class="rating-stars">
              ${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}
            </div>
            <p>"${t.message}"</p>
            <div class="testimonial-author">
              <strong>${t.name}</strong>
              <span>${t.service}</span>
            </div>
          </div>
        </div>
      `).join('');
      
      // We prepend them or add them. To preserve existing, we can append the rest.
      // For simplicity, we just insert them in the front.
      const defaultReviews = Array.from(grid.querySelectorAll('.testimonial-card:not(.local-review)'));
      
      // Clear grid first
      grid.innerHTML = '';
      
      // Insert local reviews
      grid.innerHTML = html;
      
      // Re-append defaults
      defaultReviews.forEach(card => {
        grid.appendChild(card);
      });
    }
  }

  // Load testimonials on startup
  loadLocalTestimonials();
});