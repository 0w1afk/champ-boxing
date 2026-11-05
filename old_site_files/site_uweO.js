$(function () {
    initCollapseIcons();
    initGalleryLightbox();

    $('#mobileNavigationMenu').find('.menu-nav-link').on('click', () => {
        $('#mobileNavigationMenu').offcanvas('hide');
    });
});

function initCollapseIcons() {
    $('[data-bs-toggle="collapse"]').each((i, el) => {
        var trigger = $(el);
        var targetSelector = trigger.attr('data-bs-target') || trigger.attr('href');
        var target = $(targetSelector);
        var icon = trigger.find('i').first();

        target.on('show.bs.collapse', () => {
            trigger.attr('aria-expanded', 'true');
            icon.removeClass('bi-plus-lg').addClass('bi-dash-lg');
        });

        target.on('hide.bs.collapse', () => {
            trigger.attr('aria-expanded', 'false');
            icon.removeClass('bi-dash-lg').addClass('bi-plus-lg');
        });
    });
}

function initGalleryLightbox() {
    var images = $('.gallery-item img').map((i, el) => ({
        src: $(el).attr('src'),
        alt: $(el).attr('alt') || ''
    })).get();

    if (!images.length) {
        return;
    }

    var currentIndex = 0;
    var lightbox = $('.gallery-lightbox');
    var lightboxImage = lightbox.find('img');

    function showImage(index) {
        currentIndex = (index + images.length) % images.length;
        lightboxImage.attr('src', images[currentIndex].src);
        lightboxImage.attr('alt', images[currentIndex].alt);
    }

    function openLightbox(index) {
        showImage(index);
        lightbox.addClass('is-open').attr('aria-hidden', 'false');
        $('body').css('overflow', 'hidden');
    }

    function closeLightbox() {
        lightbox.removeClass('is-open').attr('aria-hidden', 'true');
        $('body').css('overflow', '');
    }

    $('.gallery-item').on('click', function () {
        openLightbox(Number($(this).attr('data-gallery-index')) || 0);
    });

    $('.gallery-lightbox-next').on('click', (event) => {
        event.stopPropagation();
        showImage(currentIndex + 1);
    });

    $('.gallery-lightbox-prev').on('click', (event) => {
        event.stopPropagation();
        showImage(currentIndex - 1);
    });

    $('.gallery-lightbox-close').on('click', closeLightbox);

    lightbox.on('click', (event) => {
        if ($(event.target).is('.gallery-lightbox')) {
            closeLightbox();
        }
    });

    $(document).on('keydown', (event) => {
        if (!lightbox.hasClass('is-open')) {
            return;
        }

        if (event.key === 'Escape') {
            closeLightbox();
        } else if (event.key === 'ArrowRight') {
            showImage(currentIndex + 1);
        } else if (event.key === 'ArrowLeft') {
            showImage(currentIndex - 1);
        }
    });
}
