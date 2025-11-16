let viz, mapViz, sections, currentSectionIndex, popupCompany, closeCompany, popupGuide, closeGuide;

Promise.all([
    d3.csv("dataset/cleaned/Company-salary.csv"),
    d3.csv("dataset/cleaned/Company-info.csv")
]).then(([salaryData, companyInfo]) => {
    viz = new SlopeChart("#canvas", salaryData, companyInfo);
    // expose for parent to control via postMessage
    window.SLOPE_VIZ = viz;
    // If opened with a ticker query param, focus that company
    const params = new URLSearchParams(window.location.search);
    const qTicker = params.get('ticker');
    if (qTicker) {
        viz.viewMode = 'company';
        viz.selectedCompany = decodeURIComponent(qTicker);
    }
    viz.wrangleData();

    // allow parent frame to focus a company via postMessage
    window.addEventListener('message', (ev) => {
        const msg = ev && ev.data;
        if (!msg || !msg.type) return;
        if (msg.type === 'focusCompany' && msg.ticker) {
            try {
                viz.viewMode = 'company';
                viz.selectedCompany = msg.ticker;
                viz.wrangleData();
            } catch (e) { console.error(e); }
        }
    }, false);

    mapViz = new MapVis();

}).catch(error => {
    console.error("Error loading data:", error);
});

// Combined view now only hosts the map iframe full-bleed. The map itself
// shows a small popup for details/roles and handles navigation. No right
// panel is used here to avoid the white area on the right.
document.addEventListener('DOMContentLoaded', () => {
    // Get all the sections that can be navigated
    sections = document.querySelectorAll('.section');
    currentSectionIndex = 0;
    
    popupGuide = document.getElementById('guide-popup');
    closeGuide = document.getElementById('close-guide-popup');
    popupCompany = document.getElementById('company-detail-popup');
    closeCompany = document.getElementById('close-company-detail-popup');

    // Add keyboard event listener to the whole document
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault(); // Prevent default browser scrolling
            scrollToSection(currentSectionIndex + 1);
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault(); // Prevent default browser scrolling
            scrollToSection(currentSectionIndex - 1);
        }
    });

    document.getElementById('scrollDownButton').addEventListener('click', function() {
        scrollToSection(1);
    });

    // Carousel functionality
    const guideImages = [
        'dataset/guide-images/1.png',
        'dataset/guide-images/2.png',
        'dataset/guide-images/3.png',
        'dataset/guide-images/4.png'
    ].sort(); // Sort by filename to ensure correct order
    
    let currentImageIndex = 0;
    let autoAdvanceTimer = null;
    let isPaused = false;
    const AUTO_ADVANCE_DELAY = 7000; // 7 seconds
    const carouselImage = document.getElementById('carousel-image');
    const carouselDotsContainer = document.getElementById('carousel-dots');
    const prevButton = document.querySelector('.carousel-prev');
    const nextButton = document.querySelector('.carousel-next');
    const playPauseButton = document.getElementById('carousel-play-pause');
    const pauseIcon = playPauseButton.querySelector('.pause-icon');
    const playIcon = playPauseButton.querySelector('.play-icon');

    function startAutoAdvance() {
        // Don't auto-advance if only one image or if paused
        if (guideImages.length <= 1 || isPaused) {
            return;
        }
        
        // Clear any existing timer
        if (autoAdvanceTimer) {
            clearTimeout(autoAdvanceTimer);
        }
        
        // Set up next auto-advance
        autoAdvanceTimer = setTimeout(() => {
            // Move to next slide, or loop back to start
            if (currentImageIndex < guideImages.length - 1) {
                currentImageIndex++;
            } else {
                currentImageIndex = 0;
            }
            updateCarousel();
        }, AUTO_ADVANCE_DELAY);
    }

    function stopAutoAdvance() {
        if (autoAdvanceTimer) {
            clearTimeout(autoAdvanceTimer);
            autoAdvanceTimer = null;
        }
    }

    function togglePlayPause() {
        isPaused = !isPaused;
        
        // Update button appearance
        if (isPaused) {
            pauseIcon.style.display = 'none';
            playIcon.style.display = 'block';
            playPauseButton.setAttribute('aria-label', 'Play slideshow');
            stopAutoAdvance();
        } else {
            pauseIcon.style.display = 'block';
            playIcon.style.display = 'none';
            playPauseButton.setAttribute('aria-label', 'Pause slideshow');
        }
        
        // Update the carousel to reflect the new pause state
        updateCarousel();
    }

    function updateCarousel() {
        // Update image
        carouselImage.src = guideImages[currentImageIndex];
        
        // Add error handling for image loading
        carouselImage.onerror = function() {
            console.error('Failed to load image:', guideImages[currentImageIndex]);
            carouselImage.alt = 'Image failed to load: ' + guideImages[currentImageIndex];
        };
        
        carouselImage.onload = function() {
            console.log('Successfully loaded image:', guideImages[currentImageIndex]);
        };
        
        // Update dots and their progress bars
        const dots = carouselDotsContainer.querySelectorAll('.carousel-dot');
        dots.forEach((dot, index) => {
            // Remove all state classes
            dot.classList.remove('active', 'completed', 'inactive');
            const progress = dot.querySelector('.carousel-dot-progress');
            
            if (index < currentImageIndex) {
                dot.classList.add('completed');
                progress.style.animation = 'none';
                progress.style.width = '100%';
            } else if (index === currentImageIndex) {
                dot.classList.add('active');
                
                if (isPaused) {
                    // If paused, don't animate - show empty progress bar
                    progress.style.animation = 'none';
                    progress.style.width = '0%';
                } else {
                    // If not paused, restart the animation
                    progress.style.width = '0%';
                    progress.style.animation = 'none';
                    void progress.offsetWidth; // Trigger reflow
                    progress.style.animation = null;
                }
            } else {
                dot.classList.add('inactive');
                progress.style.animation = 'none';
                progress.style.width = '0%';
            }
        });
        
        // Update arrow states (keep enabled for looping)
        prevButton.disabled = false;
        nextButton.disabled = false;
        
        // Restart auto-advance timer only if not paused
        if (!isPaused) {
            startAutoAdvance();
        }
    }

    function initCarousel() {
        // Create dots with progress bars
        carouselDotsContainer.innerHTML = '';
        guideImages.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot';
            dot.setAttribute('aria-label', `Go to image ${index + 1}`);
            
            // Create progress bar inside dot
            const progress = document.createElement('div');
            progress.className = 'carousel-dot-progress';
            dot.appendChild(progress);
            
            dot.addEventListener('click', () => {
                currentImageIndex = index;
                updateCarousel();
            });
            carouselDotsContainer.appendChild(dot);
        });
        
        // Hide navigation if only one image
        const hasMultipleImages = guideImages.length > 1;
        prevButton.style.display = hasMultipleImages ? 'flex' : 'none';
        nextButton.style.display = hasMultipleImages ? 'flex' : 'none';
        carouselDotsContainer.style.display = hasMultipleImages ? 'flex' : 'none';
        playPauseButton.style.display = hasMultipleImages ? 'flex' : 'none';
        
        // Reset pause state
        isPaused = false;
        pauseIcon.style.display = 'block';
        playIcon.style.display = 'none';
        playPauseButton.setAttribute('aria-label', 'Pause slideshow');
        
        // Set initial state
        currentImageIndex = 0;
        updateCarousel();
    }

    document.getElementById('guideButton').addEventListener('click', function() {
        initCarousel();
        popupGuide.showModal();
    });

    // Play/Pause button handler
    playPauseButton.addEventListener('click', () => {
        togglePlayPause();
    });

    closeGuide.addEventListener('click', () => {
        stopAutoAdvance();
        popupGuide.close();
    });

    popupGuide.addEventListener('click', (event) => {
        // Check if the click target is the dialog element itself, not a child
        if (event.target === popupGuide) {
            stopAutoAdvance();
            popupGuide.close();
        }
    });

    // Stop auto-advance when modal closes
    popupGuide.addEventListener('close', () => {
        stopAutoAdvance();
    });

    prevButton.addEventListener('click', () => {
        // Loop to end if at start
        if (currentImageIndex > 0) {
            currentImageIndex--;
        } else {
            currentImageIndex = guideImages.length - 1;
        }
        updateCarousel();
    });

    nextButton.addEventListener('click', () => {
        // Loop to start if at end
        if (currentImageIndex < guideImages.length - 1) {
            currentImageIndex++;
        } else {
            currentImageIndex = 0;
        }
        updateCarousel();
    });

    // Note: Removed hover-to-pause functionality since users can now use the play/pause button
    // This simplifies the interaction model and avoids conflicts

    // Keyboard navigation
    popupGuide.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
            prevButton.click();
        } else if (event.key === 'ArrowRight') {
            nextButton.click();
        } else if (event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault(); // Prevent page scroll
            togglePlayPause();
        } else if (event.key === 'Escape') {
            stopAutoAdvance();
            popupGuide.close();
        }
    });

    closeCompany.addEventListener('click', () => {
        popupCompany.close();
    });

    document.getElementById('pay-progression-popup').addEventListener('click', () => {
        if (window.currentScatterCompany) {
            popupCompany.close();
            navigateToSlopeMap(window.currentScatterCompany);
        }
    });

    popupCompany.addEventListener('click', (event) => {
        // Check if the click target is the dialog element itself, not a child
        if (event.target === popupCompany) {
            popupCompany.close();
        }
    });
});

function navigateToSlopeMap(ticker) {
    try {
        viz.viewMode = 'company';
        viz.selectedCompany = ticker;
        viz.wrangleData();
    } catch (e) { console.error(e); }
    scrollToSection(3);
};

// Function to scroll to a specific section index
const scrollToSection = (index) => {
    // Ensure the index is within the valid range
    if (index >= 0 && index < sections.length) {
        sections[index].scrollIntoView({ 
            behavior: 'smooth' 
        });
        currentSectionIndex = index;
    }
};
