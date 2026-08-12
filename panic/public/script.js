/* Hope Beyond Gambling Ministry - Interactive JavaScript */
/* Anti-Gambling Christian Ministry by Holliday Bertram */

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // ========== SMOOTH SCROLLING FOR ANCHOR LINKS ==========
    function initSmoothScrolling() {
        const links = document.querySelectorAll('a[href^="#"]');
        
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    const navHeight = document.querySelector('nav').offsetHeight;
                    const targetPosition = targetElement.offsetTop - navHeight - 20;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ========== SCROLL ANIMATIONS ==========
    function initScrollAnimations() {
        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                        entry.target.classList.add('animated');
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });

            animatedElements.forEach(element => {
                element.style.opacity = '0';
                element.style.transform = 'translateY(30px)';
                element.style.transition = 'all 0.6s ease-out';
                observer.observe(element);
            });
        }
    }

    // ========== HERO SECTION ANIMATIONS ==========
    function initHeroAnimations() {
        const heroTitle = document.querySelector('.hero h1');
        const heroSubtitle = document.querySelector('.hero .hero-subtitle');
        const heroButtons = document.querySelector('.hero-buttons');
        
        // Animate hero title
        if (heroTitle) {
            heroTitle.style.opacity = '0';
            heroTitle.style.transform = 'translateY(50px)';
            setTimeout(() => {
                heroTitle.style.opacity = '1';
                heroTitle.style.transform = 'translateY(0)';
                heroTitle.style.transition = 'all 0.8s ease-out';
            }, 300);
        }
        
        // Animate hero subtitle
        if (heroSubtitle) {
            heroSubtitle.style.opacity = '0';
            heroSubtitle.style.transform = 'translateY(30px)';
            setTimeout(() => {
                heroSubtitle.style.opacity = '1';
                heroSubtitle.style.transform = 'translateY(0)';
                heroSubtitle.style.transition = 'all 0.8s ease-out';
            }, 600);
        }
        
        // Animate hero buttons
        if (heroButtons) {
            heroButtons.style.opacity = '0';
            heroButtons.style.transform = 'translateY(30px)';
            setTimeout(() => {
                heroButtons.style.opacity = '1';
                heroButtons.style.transform = 'translateY(0)';
                heroButtons.style.transition = 'all 0.8s ease-out';
            }, 900);
        }
    }

    // ========== ENHANCED BUTTON INTERACTIONS ==========
    function initButtonEffects() {
        const buttons = document.querySelectorAll('.btn');
        
        buttons.forEach(button => {
            button.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            
            button.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-3px) scale(1.02)';
                this.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.15)';
            });
            
            button.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
            });
            
            button.addEventListener('mousedown', function() {
                this.style.transform = 'translateY(-1px) scale(0.98)';
            });
            
            button.addEventListener('mouseup', function() {
                this.style.transform = 'translateY(-3px) scale(1.02)';
            });
        });
    }

    // ========== CARD HOVER EFFECTS ==========
    function initCardEffects() {
        const cards = document.querySelectorAll('.danger-card, .help-card, .resource-card, .testimony');
        
        cards.forEach(card => {
            card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-8px)';
                this.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.1)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.05)';
            });
        });
    }

    // ========== NAVIGATION SCROLL EFFECTS ==========
    function initNavigationScrollEffect() {
        const nav = document.querySelector('nav');
        if (!nav) return;

        let lastScrollTop = 0;
        let ticking = false;
        
        nav.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        function updateNavigation() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // Hide/show navigation based on scroll direction
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                nav.style.transform = 'translateY(-100%)';
            } else {
                nav.style.transform = 'translateY(0)';
            }
            
            // Change background opacity based on scroll position
            if (scrollTop > 50) {
                nav.style.background = 'rgba(44, 62, 80, 0.95)';
                nav.style.backdropFilter = 'blur(15px)';
                nav.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
            } else {
                nav.style.background = 'rgba(44, 62, 80, 0.9)';
                nav.style.backdropFilter = 'blur(10px)';
                nav.style.borderBottom = '1px solid transparent';
            }
            
            lastScrollTop = scrollTop;
            ticking = false;
        }
        
        window.addEventListener('scroll', function() {
            if (!ticking) {
                requestAnimationFrame(updateNavigation);
                ticking = true;
            }
        });
    }

    // ========== TESTIMONIAL ROTATION ==========
    function initTestimonialRotation() {
        const testimonies = document.querySelectorAll('.testimony');
        if (testimonies.length <= 1) return;

        let currentIndex = 0;
        
        // Set initial state
        testimonies.forEach((testimony, index) => {
            testimony.style.opacity = index === 0 ? '1' : '0';
            testimony.style.transition = 'opacity 0.6s ease-in-out';
            if (index !== 0) {
                testimony.style.position = 'absolute';
                testimony.style.top = '0';
                testimony.style.left = '0';
                testimony.style.right = '0';
            }
        });

        // Rotate testimonies every 6 seconds
        setInterval(() => {
            const current = testimonies[currentIndex];
            currentIndex = (currentIndex + 1) % testimonies.length;
            const next = testimonies[currentIndex];
            
            current.style.opacity = '0';
            setTimeout(() => {
                next.style.opacity = '1';
            }, 300);
        }, 6000);
    }

    // ========== EMERGENCY HELP HIGHLIGHT ==========
    function initEmergencyHighlight() {
        const emergencyCards = document.querySelectorAll('.emergency-card');
        
        emergencyCards.forEach(card => {
            let pulseInterval;
            
            function startPulse() {
                pulseInterval = setInterval(() => {
                    card.style.boxShadow = '0 0 25px rgba(220, 53, 69, 0.4)';
                    card.style.transform = 'scale(1.02)';
                    
                    setTimeout(() => {
                        card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.05)';
                        card.style.transform = 'scale(1)';
                    }, 1200);
                }, 4000);
            }
            
            function stopPulse() {
                clearInterval(pulseInterval);
            }
            
            card.style.transition = 'all 0.3s ease';
            startPulse();
            
            card.addEventListener('mouseenter', () => {
                stopPulse();
                card.style.boxShadow = '0 15px 35px rgba(220, 53, 69, 0.2)';
                card.style.transform = 'translateY(-5px)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.05)';
                card.style.transform = 'translateY(0)';
                startPulse();
            });
        });
    }

    // ========== ACCESSIBILITY ENHANCEMENTS ==========
    function initAccessibilityEnhancements() {
        // Enhanced focus indicators
        const focusableElements = document.querySelectorAll('a, button, input, textarea, select');
        
        focusableElements.forEach(element => {
            element.addEventListener('focus', function() {
                this.style.outline = '3px solid #d4af37';
                this.style.outlineOffset = '2px';
                this.style.borderRadius = '4px';
            });
            
            element.addEventListener('blur', function() {
                this.style.outline = 'none';
            });
        });

        // Screen reader announcements
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.style.cssText = `
            position: absolute !important;
            left: -10000px !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
        `;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            announcement.textContent = 'Hope Beyond Gambling Ministry website loaded successfully. Use tab key to navigate through content and resources.';
        }, 1500);
    }

    // ========== PROGRESSIVE ENHANCEMENT ==========
    function initProgressiveEnhancements() {
        // Check for modern browser features
        if ('IntersectionObserver' in window) {
            initScrollAnimations();
        }
        
        if (CSS.supports('backdrop-filter', 'blur(10px)')) {
            document.body.classList.add('supports-backdrop-filter');
        }
        
        // Respect user's motion preferences
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const style = document.createElement('style');
            style.textContent = `
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                    scroll-behavior: auto !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add page loaded class for CSS transitions
        document.body.classList.add('page-loaded');
    }

    // ========== PHONE NUMBER CLICK TRACKING ==========
    function initPhoneTracking() {
        const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
        
        phoneLinks.forEach(link => {
            link.addEventListener('click', function() {
                console.log('Emergency helpline clicked:', this.href);
                // Analytics tracking could be added here
            });
        });
    }

    // ========== PERFORMANCE OPTIMIZATION ==========
    function initPerformanceOptimizations() {
        // Lazy load images if any are added later
        if ('loading' in HTMLImageElement.prototype) {
            const images = document.querySelectorAll('img[data-src]');
            images.forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
        
        // Preload critical resources
        const criticalResources = [
            'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
            'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = resource;
            document.head.appendChild(link);
        });
    }

    // ========== INITIALIZE ALL FUNCTIONS ==========
    function init() {
        console.log('🙏 Hope Beyond Gambling Ministry - Initializing interactive features...');
        
        // Core functionality
        initSmoothScrolling();
        initHeroAnimations();
        initButtonEffects();
        initCardEffects();
        initNavigationScrollEffect();
        
        // Enhanced features
        initTestimonialRotation();
        initEmergencyHighlight();
        initAccessibilityEnhancements();
        initPhoneTracking();
        
        // Progressive enhancements
        initProgressiveEnhancements();
        initPerformanceOptimizations();
        
        console.log('✅ Hope Beyond Gambling Ministry - All interactive features loaded successfully!');
    }

    // Start initialization
    init();
});

// ========== UTILITY FUNCTIONS ==========

// Debounce function for performance optimization
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Throttle function for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}
