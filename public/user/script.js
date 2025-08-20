// alert("jeio");
// home page start
function showAlert() {
    alert("Please login to continue");
};



const track = document.getElementById('carouselTrack');
const previousBtn = document.getElementById('previousBtn'); // ✅ corrected
const nextBtn = document.getElementById('nextBtn');         // ✅ corrected

const itemWidth = 220;

// Button scroll
nextBtn.addEventListener('click', () => {
  track.scrollBy({ left: itemWidth, behavior: 'smooth' });
});

previousBtn.addEventListener('click', () => {
  track.scrollBy({ left: -itemWidth, behavior: 'smooth' });
});

// Unique variables for first slider drag
let isDownMain = false;
let startXMain;
let scrollLeftMain;

track.addEventListener('mousedown', e => {
  isDownMain = true;
  startXMain = e.pageX - track.offsetLeft;
  scrollLeftMain = track.scrollLeft;
});

track.addEventListener('mouseleave', () => {
  isDownMain = false;
});

track.addEventListener('mouseup', () => {
  isDownMain = false;
});

track.addEventListener('mousemove', e => {
  if (!isDownMain) return;
  e.preventDefault();
  const x = e.pageX - track.offsetLeft;
  const walk = x - startXMain;
  track.scrollLeft = scrollLeftMain - walk;
});


  const offerTrackWrapper = document.querySelector('.offer-track-wrapper');
  const btnPrev = document.querySelector('.offer-btn-prev');
  const btnNext = document.querySelector('.offer-btn-next');

  // Step size: 90% of visible area (responsive)
  function getStep() {
    return Math.max(200, Math.round(offerTrackWrapper.clientWidth * 0.9));
  }

  // Buttons
  btnNext.addEventListener('click', () => {
    offerTrackWrapper.scrollBy({ left: getStep(), behavior: 'smooth' });
  });
  btnPrev.addEventListener('click', () => {
    offerTrackWrapper.scrollBy({ left: -getStep(), behavior: 'smooth' });
  });

  // Mouse drag / Touch drag with Pointer Events (works everywhere)
  let isDragging = false;
  let startX = 0;
  let startScrollLeft = 0;

  offerTrackWrapper.addEventListener('pointerdown', (e) => {
    isDragging = true;
    offerTrackWrapper.classList.add('is-dragging');
    startX = e.clientX;
    startScrollLeft = offerTrackWrapper.scrollLeft;
    offerTrackWrapper.setPointerCapture(e.pointerId);
  });

  offerTrackWrapper.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    offerTrackWrapper.scrollLeft = startScrollLeft - dx;
  });

  function endDrag(e) {
    isDragging = false;
    offerTrackWrapper.classList.remove('is-dragging');
    try { offerTrackWrapper.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  offerTrackWrapper.addEventListener('pointerup', endDrag);
  offerTrackWrapper.addEventListener('pointercancel', endDrag);
  offerTrackWrapper.addEventListener('pointerleave', endDrag);

  // Wheel support (shift vertical wheel to horizontal)
  offerTrackWrapper.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault(); // allow smooth horizontal on wheel
      offerTrackWrapper.scrollLeft += e.deltaY;
    }
  }, { passive: false });


  

// home page end


// product page script start
        // GSAP Animations
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize GSAP with ScrollTrigger
            gsap.registerPlugin(ScrollTrigger);
            
            // Create a timeline for the intro animation
            const introTimeline = gsap.timeline({
                onComplete: () => {
                    // After the intro, add the CSS transition for the hover effect.
                    // This prevents a conflict between the GSAP intro and CSS hover.
                    gsap.utils.toArray('.product-card').forEach(card => {
                        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
                    });
                }
            });
            
            // Add the card animation to the timeline
            introTimeline.from('.product-card', {
                opacity: 0,
                y: 30,
                duration: 0.8,
                stagger: 0.1,
                ease: "back.out(1.7)",
                delay: 0.3
            });
            
            // Discount badge animation
            gsap.to('.discount-badge', {
                y: -3,
                duration: 0.8,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut"
            });
            
            // Sun animation
            gsap.to('.sun', {
                rotation: 360,
                duration: 30,
                repeat: -1,
                ease: "none"
            });
            
            // A more realistic and smooth plant growth animation
            gsap.utils.toArray('.plant').forEach((plant, i) => {
                gsap.set(plant, { transformOrigin: "50% 100%" }); // Ensure growth is from the bottom
                
                const tl = gsap.timeline({
                    repeat: -1,
                    yoyo: true,
                    delay: i * 0.4 // Stagger the start of each plant's animation
                });

                tl.to(plant, {
                    scaleY: 1.15, // Grow slightly taller
                    skewX: (i % 2 === 0) ? 4 : -4, // Sway gently to one side
                    duration: 3 + Math.random() * 1.5, // Randomize duration for a natural look
                    ease: "sine.inOut"
                });
            });
            
            // Add parallax effect to product images
            gsap.utils.toArray('.product-card').forEach(card => {
                const image = card.querySelector('.product-image');
                gsap.fromTo(image, 
                    { yPercent: -10 }, // Start slightly up
                    {
                        yPercent: 10,  // End slightly down
                        ease: "none",
                        scrollTrigger: {
                            trigger: card,
                            scrub: true
                        }
                    }
                );
            });
            
            // --- Event Delegation for all card interactions ---
            document.body.addEventListener('click', function(e) {
                
                // Add to Cart Button Logic
                const addToCartBtn = e.target.closest('.add-to-cart-btn');
                if (addToCartBtn && !addToCartBtn.classList.contains('added')) {
                    const originalText = addToCartBtn.innerHTML;
                    const cartCountEl = document.querySelector('.cart-count');
                    
                    addToCartBtn.classList.add('added');
                    addToCartBtn.innerHTML = '<i class="fas fa-check"></i> Added ✓';
                    
                    gsap.to(addToCartBtn, { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 });

                    // Animate and update cart count
                    gsap.to('.cart-count', {
                        scale: 1.5,
                        duration: 0.2,
                        yoyo: true,
                        repeat: 1,
                        onComplete: () => {
                            cartCountEl.textContent = parseInt(cartCountEl.textContent) + 1;
                        }
                    });

                    // Reset button after 1.5 seconds
                    setTimeout(() => {
                        addToCartBtn.classList.remove('added');
                        addToCartBtn.innerHTML = originalText;
                    }, 1500);
                }

                // Wishlist Icon Logic
                const wishlistIcon = e.target.closest('.wishlist-icon');
                if (wishlistIcon) {
                    const heartIcon = wishlistIcon.querySelector('i');
                    const isWishlisted = heartIcon.classList.contains('fas');

                    if (!isWishlisted) {
                        heartIcon.classList.replace('far', 'fas');
                        wishlistIcon.classList.add('active');
                        
                        gsap.to(wishlistIcon, {
                            scale: 1.3,
                            duration: 0.3,
                            yoyo: true,
                            repeat: 1,
                            ease: "elastic.out(1, 0.5)"
                        });
                    } else {
                        heartIcon.classList.replace('fas', 'far');
                        wishlistIcon.classList.remove('active');
                        
                        gsap.to(wishlistIcon, {
                            scale: 0.8,
                            duration: 0.2,
                            yoyo: true,
                            repeat: 1
                        });
                    }
                }
            });

        });
    
// product page script end

