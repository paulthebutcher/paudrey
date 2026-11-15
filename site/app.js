(() => {
  'use strict';
  const root = document.getElementById('wedding-site');
  const openingVeil = root.querySelector('.opening-veil');
  const heroImage = root.querySelector('.hero-image');
  const userMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const previewReducedMotion = new URLSearchParams(location.search).get('motion') === 'reduce';
  const reduceMotion = previewReducedMotion ? {matches:true,addEventListener:() => {},removeEventListener:() => {}} : userMotionPreference;
  const mobile = window.matchMedia('(max-width: 700px)');
  let lenis;
  const gsap = window.gsap;

  // Keep a usable, ungated page if animation libraries cannot load.
  if (!gsap || !window.ScrollTrigger || !window.CustomEase) return;
  gsap.registerPlugin(window.ScrollTrigger, window.CustomEase);
  window.CustomEase.create('reveal', '.16,1,.3,1');
  gsap.defaults({ease:'reveal',duration:1.2});
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0,0);

  function configureSmoothScroll() {
    if (lenis) { lenis.destroy(); lenis = undefined; }
    if (!reduceMotion.matches && !mobile.matches && window.Lenis) {
      lenis = new window.Lenis({duration:1.05,smoothWheel:true,syncTouch:false});
      lenis.on('scroll',window.ScrollTrigger.update);
    }
  }
  gsap.ticker.add(time => { if (lenis) lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);
  configureSmoothScroll();
  reduceMotion.addEventListener('change',configureSmoothScroll);
  mobile.addEventListener('change',configureSmoothScroll);

  // The page is usable immediately. This is a short opening flourish, not a gate.
  const openingNames = root.querySelectorAll('.hero-names > span');
  const openingDetails = root.querySelectorAll('.hero-topline,.hero-bottomline');
  let opening;
  let openingFinished = false;
  function finishOpening() {
    if (openingFinished) return;
    openingFinished = true;
    if (opening) opening.kill();
    openingVeil.hidden = true;
    gsap.set(heroImage,{clearProps:'transform'});
    gsap.set([...openingNames,...openingDetails],{clearProps:'transform,opacity'});
    window.removeEventListener('scroll',finishOpening);
    window.removeEventListener('pointerdown',finishOpening);
    window.removeEventListener('keydown',finishOpening);
    mobile.removeEventListener('change',finishOpening);
    reduceMotion.removeEventListener('change',finishOpening);
  }
  if (!reduceMotion.matches) {
    openingVeil.hidden = false;
    gsap.set(heroImage,{scale:1.045});
    gsap.set(openingNames,{opacity:0,y:18});
    gsap.set(openingDetails,{opacity:0,y:8});
    window.addEventListener('scroll',finishOpening,{passive:true});
    window.addEventListener('pointerdown',finishOpening,{passive:true});
    window.addEventListener('keydown',finishOpening);
    mobile.addEventListener('change',finishOpening);
    reduceMotion.addEventListener('change',finishOpening);
    // Wait briefly for real image/font readiness; slow assets never hold up the page.
    const imageReady = heroImage.decode ? heroImage.decode().catch(() => {}) : Promise.resolve();
    Promise.race([
      Promise.all([document.fonts.ready,imageReady]),
      new Promise(resolve => setTimeout(resolve,600))
    ]).then(() => {
      if (openingFinished) return;
      opening = gsap.timeline({onComplete:finishOpening});
      opening.to('.opening-mark',{opacity:0,y:-6,duration:.35},.4)
        .to(openingVeil,{opacity:0,duration:.8},.55)
        .to(heroImage,{scale:1,duration:1.15},.55)
        .to(openingNames,{opacity:1,y:0,duration:.85,stagger:.08},.75)
        .to(openingDetails,{opacity:1,y:0,duration:.65},.95);
    });
  } else finishOpening();

  root.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click',event => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.setAttribute('tabindex','-1');
      target.focus({preventScroll:true});
      if (lenis) lenis.scrollTo(target,{duration:1.3});
      else target.scrollIntoView({behavior:reduceMotion.matches ? 'auto' : 'smooth'});
    });
  });

  const stage = root.querySelector('.convergence-stage');
  const chapterIndex = root.querySelector('.chapter-index');
  const progressBar = chapterIndex.querySelector('.index-track > span');
  const chapters = [...root.querySelectorAll('[data-chapter]')];
  const motion = gsap.matchMedia();
  document.addEventListener('wedding:modal-open',() => { if (lenis) lenis.stop(); });
  document.addEventListener('wedding:modal-close',() => { if (lenis) lenis.start(); });

  motion.add({desktop:'(min-width: 701px)',mobile:'(max-width: 700px)',reduce:'(prefers-reduced-motion: reduce)'},context => {
    const {desktop} = context.conditions;
    const reduce = context.conditions.reduce || previewReducedMotion;
    const galleryRail = root.querySelector('.gallery-rail');
    let finishGallery;
    const paths = root.querySelectorAll('.path-photo');
    const shared = root.querySelector('.joined-scene');
    const sharedMask = root.querySelector('.shared-mask');
    const sharedPhoto = root.querySelector('.shared-photo');
    const save = root.querySelector('.split-save');
    const date = root.querySelector('.split-date');
    const caption = root.querySelector('.shared-photo figcaption');
    document.body.classList.toggle('scroll-choreography',desktop && !reduce);
    document.body.classList.toggle('no-motion',reduce);

    document.body.classList.toggle('mobile-choreography',!desktop && !reduce);

    if (!reduce) {
      // Keep the photo behind the full text width throughout the exit.
      // Only the photo drifts; a shrinking mask exposed cream text on cream paper.
      const hero = root.querySelector('.hero');
      gsap.fromTo(root.querySelector('.hero-image-wrap'),
        {y:0},
        {y:() => hero.clientHeight * .08,ease:'none',
          scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:.45,invalidateOnRefresh:true}});

      // Short, one-time reveals finish even if the visitor stops scrolling.
      // Animate within existing spacing; text never travels a full line height.
      root.querySelectorAll('.story-copy,.day-details,.favorites-heading').forEach(group => {
        const labels = group.querySelectorAll(':scope > .label,:scope > div > .label');
        const lines = group.querySelectorAll('.line-mask > span');
        const copy = group.querySelectorAll(':scope > .body-copy');
        const reveal = gsap.timeline({scrollTrigger:{trigger:group,start:'top 88%',once:true},defaults:{ease:'reveal'}});
        if (labels.length) reveal.from(labels,{opacity:0,y:8,duration:.6},0);
        if (lines.length) reveal.from(lines,{opacity:0,y:14,duration:.85,stagger:.1},.08);
        if (copy.length) reveal.from(copy,{opacity:0,y:10,duration:.75},.24);
      });
      gsap.from('.story-aside',{opacity:0,y:12,duration:.85,scrollTrigger:{trigger:'.story-aside',start:'top 92%',once:true}});

      // Fixed photo frames: only the mask and image move, so they cannot cross copy.
      root.querySelectorAll('.story-photo .editorial-mask').forEach((mask,index) => {
        const photo = gsap.timeline({defaults:{ease:'none'},scrollTrigger:{trigger:mask,start:'top 96%',end:'top 42%',scrub:.35}});
        photo.fromTo(mask,{clipPath:index ? 'inset(16% 0% 0% 0%)' : 'inset(0% 8% 8% 0%)'},
          {clipPath:'inset(0% 0% 0% 0%)',duration:1},0)
          .fromTo(mask.querySelector('img'),{scale:1.075},{scale:1,duration:1},0);
      });

      // Reveal the complete date within its own frame. Independent digit travel
      // allowed the 5 to cross September and the following copy mid-scroll.
      const dateSet = gsap.timeline({defaults:{ease:'reveal'},scrollTrigger:{trigger:'.day-date',start:'top 90%',once:true}});
      dateSet.from('.date-month',{opacity:0,y:10,duration:.7},0)
        .fromTo('.date-digits',{clipPath:'inset(0% 0% 100% 0%)',opacity:0},
          {clipPath:'inset(0% 0% 0% 0%)',opacity:1,duration:1},.1)
        .from('.date-year',{opacity:0,duration:.6},.35);

      const galleryReveal = gsap.fromTo('.gallery-photo',{clipPath:'inset(8% 0% 8% 0%)',opacity:0},
        {clipPath:'inset(0% 0% 0% 0%)',opacity:1,duration:.95,stagger:.06,
          scrollTrigger:{trigger:'.gallery-rail',start:'top 92%',once:true}});
      // A tap or keyboard focus settles the thumbnail before the lightbox measures it.
      finishGallery = () => galleryReveal.progress(1);
      galleryRail.addEventListener('pointerdown',finishGallery);
      galleryRail.addEventListener('focusin',finishGallery);

    }

    if (desktop && !reduce) {
      const distance = () => Math.max(0,stage.clientWidth / 2 - paths[0].offsetWidth - stage.clientWidth * .042);
      gsap.set(paths[0],{x:() => -distance()});
      gsap.set(paths[1],{x:() => distance()});
      gsap.set(shared,{autoAlpha:0});
      gsap.set(sharedMask,{clipPath:'inset(0% 50% 0% 50%)'});
      gsap.set(sharedMask.querySelector('img'),{scale:1.08});
      const photoOffset = () => {
        const leftEdge = stage.clientWidth * .042 + save.offsetWidth;
        const rightEdge = stage.clientWidth * .958 - date.offsetWidth;
        return (leftEdge + rightEdge) / 2 - stage.clientWidth / 2;
      };
      const arrangeTitle = () => {
        const gutter = stage.clientWidth * .042;
        gsap.set(save,{x:gutter - save.offsetLeft});
        gsap.set(date,{x:stage.clientWidth - gutter - date.offsetWidth - date.offsetLeft});
        const available = stage.clientWidth - gutter * 2 - save.offsetWidth - date.offsetWidth - 48;
        gsap.set(sharedPhoto,{width:Math.min(stage.clientWidth * .43,Math.max(100,available)),x:photoOffset()});
      };
      arrangeTitle();
      gsap.set(save,{x:() => stage.clientWidth * .042 - save.offsetLeft,opacity:0});
      gsap.set(date,{x:() => stage.clientWidth * .958 - date.offsetWidth - date.offsetLeft,opacity:0});
      gsap.set([caption,root.querySelector('.together-date')],{opacity:0});
      const convergence = gsap.timeline({defaults:{ease:'none'},scrollTrigger:{trigger:stage,start:'top top',end:() => '+=' + window.innerHeight * .85,pin:true,scrub:.65,invalidateOnRefresh:true,onRefresh:arrangeTitle}});
      convergence.fromTo(paths[0],{x:() => -distance()},{x:0,duration:1.35},0)
        .fromTo(paths[1],{x:() => distance()},{x:0,duration:1.35},0)
        .set(shared,{autoAlpha:1},1.65)
        .to(paths,{opacity:0,duration:.45},1.65)
        .to(root.querySelectorAll('.path-photo figcaption'),{opacity:0,duration:.15},1.65)
        .to(paths[0],{clipPath:'inset(0% 100% 0% 0%)',x:-25,duration:.75,ease:'reveal'},1.65)
        .to(paths[1],{clipPath:'inset(0% 0% 0% 100%)',x:25,duration:.75,ease:'reveal'},1.65)
        .to([save,date],{opacity:1,duration:.45},2.2)
        .fromTo(sharedMask,{clipPath:'inset(0% 50% 0% 50%)'},{clipPath:'inset(0% 0% 0% 0%)',duration:.95,ease:'reveal'},1.65)
        .to(sharedMask.querySelector('img'),{scale:1,duration:.95,ease:'reveal'},1.65)
        .to([caption,root.querySelector('.together-date')],{opacity:1,duration:.35},2.35)
        .to({}, {duration:.35},2.7);
    } else if (!reduce) {
      // One transforming composition in ordinary phone flow: the two images
      // meet, part like curtains, and become the shared portrait. No pin.
      const pairTop = () => sharedPhoto.offsetTop + (sharedMask.offsetHeight - paths[0].querySelector('.photo-mask').offsetHeight) / 2;
      gsap.set(paths,{top:pairTop});
      gsap.set([sharedMask,caption,root.querySelector('.together-date')],{autoAlpha:0});
      const converge = gsap.timeline({defaults:{ease:'none'},scrollTrigger:{trigger:stage,start:'top 80%',end:'top 2%',scrub:.35,invalidateOnRefresh:true,onRefresh:() => gsap.set(paths,{top:pairTop()})}});
      converge.fromTo(paths[0],{xPercent:-32,y:22},{xPercent:0,y:0,duration:.43},0)
        .fromTo(paths[1],{xPercent:32,y:-22},{xPercent:0,y:0,duration:.43},0)
        .fromTo(root.querySelectorAll('.photo-mask img'),{scale:1.07},{scale:1,duration:.43},0)
        .set(sharedMask,{autoAlpha:1},.7)
        .to(paths,{opacity:0,duration:.22},.7)
        .to(root.querySelectorAll('.path-photo figcaption'),{opacity:0,duration:.08},.7)
        .fromTo(sharedMask,{clipPath:'inset(24% 48% 24% 48%)'},{clipPath:'inset(0% 0% 0% 0%)',duration:.3},.7)
        .fromTo(sharedMask.querySelector('img'),{scale:1.12},{scale:1,duration:.3},.7)
        .to(paths[0],{clipPath:'inset(0% 100% 0% 0%)',xPercent:-8,duration:.3},.7)
        .to(paths[1],{clipPath:'inset(0% 0% 0% 100%)',xPercent:8,duration:.3},.7)
        .to([caption,root.querySelector('.together-date')],{autoAlpha:1,duration:.13},.91)
        .to({}, {duration:.04},1);
    }

    function selectChapter(chapter) {
      chapterIndex.classList.toggle('is-light',chapter.id !== 'together');
      chapterIndex.querySelectorAll('a').forEach(link => {
        if (link.dataset.index === chapter.dataset.chapter) link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    }
    chapters.forEach(chapter => window.ScrollTrigger.create({trigger:chapter,start:'top 45%',end:'bottom 45%',onEnter:() => selectChapter(chapter),onEnterBack:() => selectChapter(chapter)}));
    const chapterProgress = window.ScrollTrigger.create({trigger:chapters[0],start:'top 45%',endTrigger:root.querySelector('.together'),end:'bottom 45%',onUpdate:self => {
      chapterIndex.hidden = !self.isActive;
      gsap.set(progressBar,{scaleX:self.progress});
    },onToggle:self => {chapterIndex.hidden = !self.isActive;}});

    return () => {
      if (finishGallery) {
        galleryRail.removeEventListener('pointerdown',finishGallery);
        galleryRail.removeEventListener('focusin',finishGallery);
      }
      chapterProgress.kill();
      chapterIndex.hidden = true;
      document.body.classList.remove('scroll-choreography','mobile-choreography','no-motion');
    };
  });
  const cursor = document.querySelector('.view-cursor');
  const finePointer = window.matchMedia('(hover:hover) and (pointer:fine)');
  const cursorX = gsap.quickSetter(cursor,'left','px');
  const cursorY = gsap.quickSetter(cursor,'top','px');
  root.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('pointerenter',event => {
      cursorX(event.clientX); cursorY(event.clientY);
      if(finePointer.matches) cursor.classList.add('is-visible');
    });
    item.addEventListener('pointerleave',() => cursor.classList.remove('is-visible'));
    item.addEventListener('pointermove',event => {cursorX(event.clientX);cursorY(event.clientY);});
    item.addEventListener('click',() => cursor.classList.remove('is-visible'));
  });
  document.fonts.ready.then(() => {
    window.ScrollTrigger.refresh();
  });
})();
