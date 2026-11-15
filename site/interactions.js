(function (global, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!global || !global.document) return;
  global.WeddingInteractions = api;
  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', () => api.init(global.document), {once:true});
  } else {
    api.init(global.document);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parseCalendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }

  function escapeCalendarText(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  }

  // RFC 5545 folds at 75 octets, without dividing a UTF-8 character.
  function foldCalendarLine(value) {
    const encoder = new TextEncoder();
    let output = '';
    let octets = 0;
    for (const character of value) {
      const length = encoder.encode(character).length;
      if (octets + length > 75) {
        output += '\r\n ';
        octets = 1;
      }
      output += character;
      octets += length;
    }
    return output;
  }

  function createCalendar(config, options) {
    config = config || {};
    options = options || {};
    const date = parseCalendarDate(config.date);
    if (!date) return null;
    const end = new Date(date.getTime());
    end.setUTCDate(end.getUTCDate() + 1);
    const compactDate = value => value.toISOString().slice(0,10).replace(/-/g,'');
    const now = options.now instanceof Date ? options.now : new Date();
    if (Number.isNaN(now.getTime())) return null;
    const stamp = now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Paul & Audrey//Save the Date//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:paul-audrey-' + compactDate(date) + '@wedding.local',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + compactDate(date),
      'DTEND;VALUE=DATE:' + compactDate(end),
      'SUMMARY:' + escapeCalendarText(config.summary || 'Paul & Audrey’s wedding'),
      'DESCRIPTION:' + escapeCalendarText(config.description || 'A formal invitation will follow.')
    ];
    if (typeof config.location === 'string' && config.location.trim()) {
      lines.push('LOCATION:' + escapeCalendarText(config.location.trim()));
    }
    lines.push('END:VEVENT','END:VCALENDAR');
    return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
  }

  function readConfig(doc) {
    try {
      const node = doc.getElementById('wedding-config');
      const config = node ? JSON.parse(node.textContent) : {};
      return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
    } catch (_) {
      return {};
    }
  }

  function setupCalendar(doc, win) {
    const button = doc.getElementById('add-calendar');
    const status = doc.getElementById('calendar-status');
    if (!button) return;
    if (status) {
      status.setAttribute('aria-live','polite');
      button.setAttribute('aria-describedby',status.id);
    }
    button.addEventListener('click', () => {
      const calendar = createCalendar(readConfig(doc));
      if (!calendar) {
        if (status) status.textContent = 'We’ll add the calendar invitation once the date is confirmed.';
        return;
      }
      const url = win.URL.createObjectURL(new win.Blob([calendar], {type:'text/calendar;charset=utf-8'}));
      const link = doc.createElement('a');
      link.href = url;
      link.download = 'paul-audrey-save-the-date.ics';
      link.hidden = true;
      doc.body.append(link);
      link.click();
      link.remove();
      // Give iOS time to hand the file to Calendar before releasing it.
      win.setTimeout(() => win.URL.revokeObjectURL(url), 60000);
      if (status) status.textContent = 'Your calendar invitation is ready.';
    });
  }

  function setupLightbox(doc, win) {
    const triggers = Array.from(doc.querySelectorAll('button[data-gallery-index]'));
    const dialog = doc.getElementById('photo-dialog');
    const image = doc.getElementById('lightbox-image');
    const caption = doc.getElementById('lightbox-caption');
    const count = doc.getElementById('lightbox-count');
    if (!triggers.length || !dialog || !image || !caption || !count) return;
    const closeButton = dialog.querySelector('[data-lightbox-close]');
    const previous = dialog.querySelector('[data-lightbox-prev]');
    const next = dialog.querySelector('[data-lightbox-next]');
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const previewReduced = new URLSearchParams(win.location.search).get('motion') === 'reduce';
    const canAnimate = () => !previewReduced && !reduced.matches && typeof image.animate === 'function';
    const easing = 'cubic-bezier(.16,1,.3,1)';
    const unique = new Map();
    triggers.forEach((button, position) => {
      const key = Number.isFinite(Number(button.dataset.galleryIndex)) ? Number(button.dataset.galleryIndex) : position;
      if (unique.has(key)) return;
      const thumbnail = button.querySelector('img');
      unique.set(key, {
        key, thumbnail,
        src:button.dataset.fullSrc || (thumbnail && (thumbnail.currentSrc || thumbnail.src)) || '',
        caption:button.dataset.caption || '[Place name] / [Coordinates]',
        alt:button.dataset.alt || (thumbnail && thumbnail.alt) || 'Paul and Audrey together.'
      });
    });
    const items = Array.from(unique.values()).sort((a,b) => a.key - b.key);
    const animations = new Set();
    let current = 0, openingIndex = 0;
    let opened = false, closing = false, navigated = false;
    let opener = null, clone = null, phase = null;
    let savedScroll = {x:0,y:0};
    let savedOverflow = null;
    let loadRequest = 0, transitionId = 0;
    let touch = null;
    dialog.classList.add('gallery-motion');

    function emit(type) {
      doc.dispatchEvent(new win.CustomEvent(type, {detail:{index:current}}));
    }

    function animate(element, frames, options) {
      const animation = element.animate(frames,options);
      animations.add(animation);
      // Retain filled effects until the next transition cancels them; otherwise
      // a completed closing fade could leave the next dialog opening invisible.
      animation.finished.catch(() => {});
      return animation;
    }

    function cancelVisuals() {
      transitionId++;
      animations.forEach(animation => animation.cancel());
      animations.clear();
      if (clone) clone.remove();
      clone = null;
      phase = null;
      dialog.classList.remove('is-morphing');
    }

    // Keep the entire transformed thumbnail geometry, then clip to the pixels
    // actually visible inside its frame, rail, and viewport.
    function thumbnailGeometry(button) {
      const thumbnail = button && button.querySelector('img');
      if (!thumbnail || !thumbnail.complete || !thumbnail.naturalWidth || !button.isConnected) return null;
      const rect = thumbnail.getBoundingClientRect();
      const frame = (button.querySelector('.gallery-photo') || thumbnail).getBoundingClientRect();
      const rail = button.closest('.gallery-rail');
      const bounds = rail ? rail.getBoundingClientRect() : {left:0,top:0,right:win.innerWidth,bottom:win.innerHeight};
      const visible = {
        left:Math.max(rect.left,frame.left,bounds.left,0),
        right:Math.min(rect.right,frame.right,bounds.right,win.innerWidth),
        top:Math.max(rect.top,frame.top,bounds.top,0),
        bottom:Math.min(rect.bottom,frame.bottom,bounds.bottom,win.innerHeight)
      };
      if (visible.right - visible.left < 24 || visible.bottom - visible.top < 24 || rect.width < 1 || rect.height < 1) return null;
      const inset = [visible.top - rect.top,rect.right - visible.right,rect.bottom - visible.bottom,visible.left - rect.left];
      const clip = 'inset(' + inset.map((value,index) => (value / (index % 2 ? rect.width : rect.height) * 100) + '%').join(' ') + ')';
      return {rect,clip,src:thumbnail.currentSrc || thumbnail.src,width:thumbnail.naturalWidth,height:thumbnail.naturalHeight};
    }

    function containedRect(width, height) {
      const bounds = image.getBoundingClientRect();
      if (!width || !height || !bounds.width || !bounds.height) return null;
      const scale = Math.min(bounds.width / width,bounds.height / height);
      const w = width * scale, h = height * scale;
      return {left:bounds.left + (bounds.width - w) / 2,top:bounds.top + (bounds.height - h) / 2,width:w,height:h};
    }

    function morph(geometry, opening, onComplete) {
      const contained = containedRect(geometry.width,geometry.height);
      if (!contained) return false;
      const token = ++transitionId;
      phase = opening ? 'opening' : 'closing';
      const duration = opening ? 900 : 650;
      clone = doc.createElement('img');
      clone.className = 'lightbox-transition-image';
      clone.alt = '';
      clone.setAttribute('aria-hidden','true');
      clone.src = opening ? geometry.src : image.currentSrc || image.src;
      clone.style.width = contained.width + 'px';
      clone.style.height = contained.height + 'px';
      dialog.append(clone);
      dialog.classList.add('is-morphing');
      const small = {
        transform:'translate3d(' + geometry.rect.left + 'px,' + geometry.rect.top + 'px,0) scale(' + geometry.rect.width / contained.width + ',' + geometry.rect.height / contained.height + ')',
        clipPath:geometry.clip
      };
      const large = {transform:'translate3d(' + contained.left + 'px,' + contained.top + 'px,0) scale(1)',clipPath:'inset(0% 0% 0% 0%)'};
      const background = win.getComputedStyle(dialog).backgroundColor;
      animate(dialog,opening ? [{backgroundColor:'transparent'},{backgroundColor:background}] : [{backgroundColor:background},{backgroundColor:'transparent'}],{duration,easing,fill:'both'});
      [caption,dialog.querySelector('.lightbox-controls')].filter(Boolean).forEach(element => {
        animate(element,opening ? [{opacity:0},{opacity:1}] : [{opacity:1},{opacity:0}],{duration:opening ? 280 : 180,delay:opening ? 720 : 0,easing,fill:'both'});
      });
      const flight = animate(clone,opening ? [small,large] : [large,small],{duration,easing,fill:'both'});
      flight.finished.then(() => {
        if (token !== transitionId || !opened) return;
        if (clone) clone.remove();
        clone = null;
        phase = null;
        dialog.classList.remove('is-morphing');
        onComplete();
      },() => {});
      return true;
    }

    function showPhoto(index, initial) {
      if (!opened || closing) return;
      const nextIndex = (index + items.length) % items.length;
      if (!initial) {
        if (nextIndex !== current) navigated = true;
        cancelVisuals();
      }
      current = nextIndex;
      const item = items[current];
      const request = ++loadRequest;
      const position = (current + 1) + ' / ' + items.length;
      const thumbnail = item.thumbnail;
      const preview = thumbnail && (thumbnail.currentSrc || thumbnail.src);
      caption.textContent = item.caption;
      count.textContent = position + ' — Loading photo…';
      image.alt = item.alt;
      // The cached thumbnail remains visible throughout the full-resolution load.
      image.src = preview || item.src;
      image.style.opacity = '1';
      dialog.dataset.loading = 'true';
      dialog.setAttribute('aria-busy','true');
      const loader = new win.Image();
      loader.decoding = 'async';
      loader.onload = async () => {
        if (typeof loader.decode === 'function') {
          try { await loader.decode(); } catch (_) { /* onload verified the file. */ }
        }
        if (request !== loadRequest || !opened || closing) return;
        image.src = item.src;
        count.textContent = position;
        dialog.dataset.loading = 'false';
        dialog.setAttribute('aria-busy','false');
      };
      loader.onerror = () => {
        if (request !== loadRequest || !opened || closing) return;
        count.textContent = position + (preview ? ' — Preview shown' : ' — Photo unavailable');
        dialog.dataset.loading = 'false';
        dialog.setAttribute('aria-busy','false');
      };
      loader.src = item.src;
    }

    function openPhoto(index, button) {
      if (opened) return;
      const geometry = canAnimate() ? thumbnailGeometry(button) : null;
      cancelVisuals();
      opener = button;
      openingIndex = index;
      navigated = false;
      closing = false;
      savedScroll = {x:win.scrollX,y:win.scrollY};
      savedOverflow = {body:doc.body.style.overflow,html:doc.documentElement.style.overflow};
      opened = true;
      doc.body.classList.add('lightbox-open');
      doc.body.style.overflow = 'hidden';
      doc.documentElement.style.overflow = 'hidden';
      current = index;
      emit('wedding:modal-open');
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else {
        dialog.setAttribute('open','');
        dialog.setAttribute('aria-modal','true');
        dialog.setAttribute('role','dialog');
      }
      showPhoto(index,true);
      if (geometry) morph(geometry,true,() => {});
      if (closeButton) closeButton.focus({preventScroll:true});
    }

    function finishClose() {
      if (!opened) return;
      opened = false;
      closing = false;
      loadRequest++;
      touch = null;
      cancelVisuals();
      dialog.dataset.loading = 'false';
      dialog.setAttribute('aria-busy','false');
      doc.body.classList.remove('lightbox-open');
      if (savedOverflow) {
        doc.body.style.overflow = savedOverflow.body;
        doc.documentElement.style.overflow = savedOverflow.html;
      }
      win.scrollTo(savedScroll.x,savedScroll.y);
      emit('wedding:modal-close');
      if (opener && opener.isConnected) opener.focus({preventScroll:true});
    }

    function closeImmediately() {
      cancelVisuals();
      if (typeof dialog.close === 'function') dialog.close();
      else { dialog.removeAttribute('open'); finishClose(); }
    }

    function closePhoto() {
      if (!opened || closing) return;
      const wasOpening = phase === 'opening';
      closing = true;
      loadRequest++;
      cancelVisuals();
      if (!canAnimate()) { closeImmediately(); return; }
      const geometry = !wasOpening && !navigated && current === openingIndex ? thumbnailGeometry(opener) : null;
      if (geometry && morph(geometry,false,closeImmediately)) return;
      // A different photograph must never collapse into the original thumbnail.
      const token = transitionId;
      phase = 'closing';
      const fade = animate(dialog,[{opacity:1},{opacity:0}],{duration:220,easing:'ease-out',fill:'both'});
      fade.finished.then(() => { if (token === transitionId && opened) closeImmediately(); },() => {});
    }

    function settleMotion() {
      if (!opened) return;
      if (closing) closeImmediately();
      else cancelVisuals();
    }
    reduced.addEventListener('change',settleMotion);
    win.addEventListener('resize',settleMotion,{passive:true});
    if (win.visualViewport) win.visualViewport.addEventListener('resize',settleMotion,{passive:true});

    triggers.forEach(button => {
      button.setAttribute('aria-haspopup','dialog');
      button.setAttribute('aria-controls',dialog.id);
      button.addEventListener('click', () => {
        const index = items.findIndex(item => item.key === Number(button.dataset.galleryIndex));
        if (index >= 0) openPhoto(index,button);
      });
    });
    if (closeButton) closeButton.addEventListener('click',closePhoto);
    if (previous) previous.addEventListener('click',() => showPhoto(current - 1));
    if (next) next.addEventListener('click',() => showPhoto(current + 1));
    dialog.addEventListener('close',finishClose);
    dialog.addEventListener('cancel',event => { event.preventDefault(); closePhoto(); });
    dialog.addEventListener('click',event => { if (event.target === dialog) closePhoto(); });
    doc.addEventListener('keydown',event => {
      if (!opened) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        showPhoto(current + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closePhoto();
      } else if (event.key === 'Tab') {
        const controls = Array.from(dialog.querySelectorAll('button:not([disabled]),a[href]'));
        const first = controls[0], last = controls[controls.length - 1];
        const activeIndex = controls.indexOf(doc.activeElement);
        if (!first) { event.preventDefault(); return; }
        if (activeIndex === -1 || (event.shiftKey && activeIndex === 0) || (!event.shiftKey && doc.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({preventScroll:true});
        }
      }
    });
    dialog.addEventListener('touchstart',event => {
      if (closing || event.touches.length !== 1 || event.target.closest('button')) { touch = null; return; }
      const point = event.touches[0];
      if (point.clientX < 20 || point.clientX > win.innerWidth - 20) { touch = null; return; }
      touch = {x:point.clientX,y:point.clientY,time:Date.now()};
    },{passive:true});
    dialog.addEventListener('touchend',event => {
      if (!touch || event.changedTouches.length !== 1) return;
      const point = event.changedTouches[0];
      const x = point.clientX - touch.x;
      const y = point.clientY - touch.y;
      const elapsed = Date.now() - touch.time;
      touch = null;
      if (Math.abs(x) >= 52 && Math.abs(x) > Math.abs(y) * 1.35 && elapsed < 1000) showPhoto(current + (x < 0 ? 1 : -1));
    },{passive:true});
    dialog.addEventListener('touchcancel',() => { touch = null; },{passive:true});
  }

  function setupGalleryRail(doc, win) {
    const rail = doc.getElementById('favorites-rail');
    if (!rail) return;
    const photos = Array.from(rail.querySelectorAll('button[data-gallery-index]'));
    if (!photos.length) return;
    const previous = doc.querySelector('[data-gallery-prev]');
    const next = doc.querySelector('[data-gallery-next]');
    const count = doc.getElementById('gallery-count');
    const narrow = win.matchMedia('(max-width: 700px)');
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const previewReduced = new URLSearchParams(win.location.search).get('motion') === 'reduce';
    let current = 0, frame = 0, viewportWidth = 0, padding = 0;
    let geometry = [];
    let needsMeasure = true;

    function measure() {
      const bounds = rail.getBoundingClientRect();
      viewportWidth = rail.clientWidth;
      padding = parseFloat(win.getComputedStyle(rail).paddingLeft) || 0;
      geometry = photos.map(photo => {
        const rect = photo.getBoundingClientRect();
        const left = rect.left - bounds.left + rail.scrollLeft;
        return {photo,left,center:left + rect.width / 2};
      });
      needsMeasure = false;
    }

    function update() {
      frame = 0;
      if (needsMeasure) measure();
      const drift = narrow.matches && !reduced.matches && !previewReduced;
      rail.classList.toggle('has-drift',drift);
      const center = rail.scrollLeft + viewportWidth / 2;
      if (narrow.matches) {
        let distance = Infinity;
        geometry.forEach((item,index) => {
          const delta = Math.abs(item.center - center);
          if (delta < distance) { current = index; distance = delta; }
        });
      }
      geometry.forEach((item,index) => {
        item.photo.classList.toggle('is-current',narrow.matches && index === current);
        if (drift) {
          const position = Math.max(-1,Math.min(1,(item.center - center) / Math.max(1,viewportWidth)));
          item.photo.style.setProperty('--gallery-drift',(-position * 8).toFixed(2) + 'px');
        } else item.photo.style.removeProperty('--gallery-drift');
      });
      const nextCount = String(current + 1).padStart(2,'0') + ' / ' + String(photos.length).padStart(2,'0');
      if (count && count.textContent !== nextCount) count.textContent = nextCount;
      if (previous) previous.setAttribute('aria-disabled',String(current === 0));
      if (next) next.setAttribute('aria-disabled',String(current === photos.length - 1));
    }

    function schedule(remeasure) {
      if (remeasure) needsMeasure = true;
      if (!frame) frame = win.requestAnimationFrame(update);
    }

    function move(direction) {
      if (!narrow.matches) return;
      if (frame) { win.cancelAnimationFrame(frame); frame = 0; }
      update();
      const control = direction < 0 ? previous : next;
      if (control && control.getAttribute('aria-disabled') === 'true') return;
      const index = Math.max(0,Math.min(photos.length - 1,current + direction));
      rail.scrollTo({left:geometry[index].left - padding,behavior:reduced.matches || previewReduced ? 'auto' : 'smooth'});
    }

    if (previous) { previous.setAttribute('aria-controls',rail.id); previous.addEventListener('click',() => move(-1)); }
    if (next) { next.setAttribute('aria-controls',rail.id); next.addEventListener('click',() => move(1)); }
    rail.addEventListener('scroll',() => schedule(false),{passive:true});
    rail.addEventListener('load',() => schedule(true),true);
    narrow.addEventListener('change',() => schedule(true));
    reduced.addEventListener('change',() => schedule(false));
    win.addEventListener('resize',() => schedule(true),{passive:true});
    if (win.ResizeObserver) new win.ResizeObserver(() => schedule(true)).observe(rail);
    update();
  }

  function init(doc) {
    if (!doc || !doc.defaultView || doc.documentElement.dataset.weddingInteractions === 'ready') return;
    doc.documentElement.dataset.weddingInteractions = 'ready';
    const win = doc.defaultView;
    setupCalendar(doc,win);
    setupLightbox(doc,win);
    setupGalleryRail(doc,win);
  }

  return {init,createCalendar,parseCalendarDate,escapeCalendarText,foldCalendarLine};
});
