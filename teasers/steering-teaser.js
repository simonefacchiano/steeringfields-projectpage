/* Reusable, dependency-free figure. Asset paths resolve relative to this script. */
(() => {
  const assetRoot = new URL('.', document.currentScript.src);
  const NS = 'http://www.w3.org/2000/svg';
  const colors = { source: '#bd4b0b', steering: '#ba9000', target: '#23752b' };
  const playbackSpeed = 1.03;
  const cycle = 16;
  const duration = cycle * 1000 / playbackSpeed;

  class SteeringTeaser extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) { this.observe(); return; }
      this.attachShadow({ mode: 'open' });
      this.animations = [];
      this.paused = false;
      this.visible = false;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; width:100%; aspect-ratio:1220/750; position:relative; background:#fff; }
          svg { display:block; width:100%; height:auto; }
          button { position:absolute; right:1%; bottom:1%; padding:6px 10px; border:1px solid #dadce0;
            border-radius:4px; background:#fff; color:#5f6368; font:12px system-ui,sans-serif; cursor:pointer; }
          button:hover { color:#202124; border-color:#9aa0a6; }
          button:focus-visible { outline:2px solid #2563eb; outline-offset:3px; }
          button[hidden] { display:none; }
        </style>
        <svg viewBox="0 0 1220 750" role="img" aria-labelledby="title description">
          <title id="title">Steering Fields</title>
          <desc id="description">Noise evolves along a dashed trajectory through a vector field. Orange source arrows lead to the upper, censored source-only portrait. The first red source and green target arrows appear next. The gold steering arrow then appears as their sum. The lower trajectory then unfolds toward the clothed portrait. The legend identifies the latent state and each field.</desc>
          <defs></defs>
          <g id="scene"></g>
        </svg>
        <button type="button" aria-label="Pause teaser animation">Pause</button>`;
      this.svg = this.shadowRoot.querySelector('svg');
      this.scene = this.shadowRoot.querySelector('#scene');
      this.defs = this.shadowRoot.querySelector('defs');
      this.button = this.shadowRoot.querySelector('button');
      this.build();
      this.button.addEventListener('click', () => {
        this.paused = !this.paused;
        this.button.textContent = this.paused ? 'Play' : 'Pause';
        this.button.setAttribute('aria-label', `${this.paused ? 'Play' : 'Pause'} teaser animation`);
        this.sync();
      });
      this.onVisibility = () => this.sync();
      this.onMotion = () => this.sync();
      this.observe();
    }

    node(tag, attributes = {}, parent = this.scene) {
      const node = document.createElementNS(NS, tag);
      for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
      parent.append(node);
      return node;
    }

    // All reveals share one clock; the final composition holds until 14.5 s.
    reveal(node, start, length = 0.6, grow = false) {
      const hidden = { opacity: 0, ...(grow ? { transform: 'scale(0.01)' } : {}) };
      const shown = { opacity: 1, ...(grow ? { transform: 'scale(1)' } : {}) };
      const animation = node.animate([
        { ...hidden, offset: 0 },
        { ...hidden, offset: start / cycle, easing: 'cubic-bezier(.4,0,.2,1)' },
        { ...shown, offset: (start + length) / cycle },
        { ...shown, offset: 14.5 / cycle, easing: 'ease-in-out' },
        { ...hidden, offset: 15.4 / cycle },
        { ...hidden, offset: 1 }
      ], { duration, iterations: Infinity, fill: 'both' });
      animation.pause();
      animation.currentTime = 0;
      this.animations.push(animation);
      return node;
    }

    arrow(parent, x, y, dx, dy, color, width = 4, start = null) {
      const anchor = this.node('g', { transform: `translate(${x} ${y})` }, parent);
      const g = this.node('g', {}, anchor);
      const length = Math.hypot(dx, dy);
      const ux = dx / length, uy = dy / length;
      const head = width * 3.5, wing = width * 1.7;
      this.node('path', { d: `M0 0 L${dx - ux * head * .55} ${dy - uy * head * .55}`,
        stroke: color, 'stroke-width': width, fill: 'none' }, g);
      this.node('path', { d: `M${dx} ${dy} L${dx - ux * head - uy * wing} ${dy - uy * head + ux * wing} L${dx - ux * head * .72} ${dy - uy * head * .72} L${dx - ux * head + uy * wing} ${dy - uy * head - ux * wing} Z`, fill: color }, g);
      if (start !== null) this.reveal(g, start, .55, true);
      return g;
    }

    trajectory(d, color, start, length, name) {
      const mask = this.node('mask', { id: name, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1220, height: 750 }, this.defs);
      const brush = this.node('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 14, pathLength: 1,
        'stroke-dasharray': 1, 'stroke-dashoffset': 0 }, mask);
      const animation = brush.animate([
        { strokeDashoffset: 1, offset: 0 },
        { strokeDashoffset: 1, offset: start / cycle },
        { strokeDashoffset: 0, offset: (start + length) / cycle },
        { strokeDashoffset: 0, offset: 1 }
      ], { duration, iterations: Infinity, fill: 'both' });
      animation.pause(); animation.currentTime = 0; this.animations.push(animation);
      this.reveal(this.node('path', { d, fill: 'none', stroke: color, 'stroke-width': 3.5,
        'stroke-dasharray': '12 9', mask: `url(#${name})` }), start, .15);
    }

    build() {
      // Coordinates follow the reference's left panel, in a 1220-unit plane.
      // Shorten the waits from the first gray arrow and first gold arrow by 20%.
      // Shift each following phase together to preserve its drawing speed and spacing.
      const sourceAdvance = (2.8 - .78) * .2;
      const steeredAdvance = sourceAdvance + (7.8 - 6.0) * .2;
      const field = this.node('g');
      const xs = Array.from({ length: 10 }, (_, col) => 85 + col * 92);
      const ys = Array.from({ length: 9 }, (_, row) => 100 + row * 77);
      ys.forEach((y, row) => xs.forEach((x, col) => {
        // A regular lattice and a smooth direction field, continuous beneath overlays.
        const topWeight = Math.exp(-(((y - 150) / 220) ** 2));
        const angle = (-.25 + .55 * col / 9) * topWeight - .95 * (1 - topWeight);
        const g = this.arrow(field, x, y, 52 * Math.cos(angle), 52 * Math.sin(angle), '#c3c5c4', 3);
        this.node('circle', { cx: 0, cy: 0, r: 3.8, fill: '#c3c5c4' }, g);
        this.reveal(g, .78 + col * .115 + row * .035, .65);
      }));
      const noise = this.node('g');
      this.node('image', { href: new URL('teaser_noise_left.png', assetRoot), x: 12, y: 149, width: 169, height: 168 }, noise);
      this.node('rect', { x: 12, y: 149, width: 169, height: 168, fill: 'none', stroke: '#111', 'stroke-width': 2 }, noise);
      this.reveal(noise, .15, .8);
      this.trajectory('M181 210 C242 167 297 139 354 150 C426 148 475 196 538 252 C596 305 656 371 709 418 C773 470 825 506 889 522', '#898989', 7.8 - steeredAdvance, 2.4, 'steered-reveal');
      this.trajectory('M181 210 C247 161 294 126 334 126 C387 108 440 113 500 135 C562 153 603 174 627 188 C683 216 732 240 773 260 C831 289 866 305 909 317 L972 332', '#ad1830', 2.8 - sourceAdvance, 1.55, 'source-reveal');
      const states = [
        [181,210, 43,-35, 45,-20, 57,4],
        [259,171, 48,-46, 45,-17, 53,4],
        [354,150, 54,-26, 54,8, 36,36],
        [445,178, 71,-12, 51,29, 19,56],
        [538,252, 69,-5, 55,49, 24,58],
        [621,333, 69,-16, 47,46, 3,66],
        [709,418, 53,-37, 54,42, 13,65],
        [814,489, 44,-45, 53,29, 32,63]
      ];
      states.forEach(([x,y,sx,sy,gx,gy,tx,ty], i) => {
        const start = i === 0 ? 5.1 - sourceAdvance : 7.8 - steeredAdvance + i * .27;
        this.arrow(this.scene, x,y,sx,sy,colors.source,4.2,start);
        this.arrow(this.scene, x,y,tx,ty,colors.target,4.2,start);
        // Aim the first gold arrow exactly at the next gold state.
        this.arrow(this.scene, x,y,i === 0 ? states[1][0] - x : gx,i === 0 ? states[1][1] - y : gy,
          colors.steering,4.2,i === 0 ? 6.0 - sourceAdvance : start + .25);
        this.reveal(this.node('circle', { cx:x, cy:y, r:i === 0 ? 7 : 7.5, fill:i === 0 ? '#101513' : colors.steering }), i === 0 ? 2.8 - sourceAdvance : start, .3);
      });
      [[334,126,70,-17],[500,135,77,26],[627,188,76,37],[773,260,77,35],[909,317,63,15]].forEach(([x,y,dx,dy],i) => {
        this.arrow(this.scene,x,y,dx,dy,colors.source,4.2,3.1-sourceAdvance+i*.23);
        this.reveal(this.node('circle',{cx:x,cy:y,r:5.5,fill:colors.source}),3.1-sourceAdvance+i*.23,.3);
      });
      this.reveal(this.node('image', { href:new URL('teaser_naked_left.png',assetRoot), x:970,y:202,width:230,height:231 }),4.2-sourceAdvance,.85);
      this.reveal(this.node('image', { href:new URL('teaser_clothed_left.jpg',assetRoot), x:887,y:463,width:230,height:230 }),10.3-steeredAdvance,.9);
      const legend = this.node('g');
      this.node('rect',{x:3,y:510,width:434,height:184,fill:'#fff',stroke:'#aaa','stroke-width':1.5},legend);
      const label = (x,y,text,color='#111') => {
        const node = this.node('text',{x,y,fill:color,'font-family':'Georgia, Times New Roman, serif','font-size':30},legend);
        node.textContent = text; return node;
      };
      label(23,608,'state');
      const z = label(102,608,'z'); z.setAttribute('font-style','italic');
      const sub = this.node('tspan',{'baseline-shift':'sub','font-size':20},z); sub.textContent='t';
      this.arrow(legend,152,600,35,-45,colors.source,3.8);
      this.arrow(legend,152,600,68,12,colors.steering,3.8);
      this.arrow(legend,152,600,24,60,colors.target,3.8);
      this.node('circle',{cx:152,cy:600,r:7.5,fill:'#101513'},legend);
      label(198,556,'source field',colors.source);
      label(228,620,'steering field',colors.steering);
      label(180,677,'target field',colors.target);
      this.reveal(legend,11.2-steeredAdvance,.7);
    }

    sync() {
      this.button.hidden = this.motion.matches;
      const running = this.visible && !document.hidden && !this.paused && !this.motion.matches;
      const time = this.motion.matches ? 13000 / playbackSpeed : this.animations[0].currentTime;
      for (const animation of this.animations) {
        animation.currentTime = time;
        if (running) animation.play(); else animation.pause();
      }
    }

    observe() {
      this.observer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.sync(); });
      this.observer.observe(this);
      document.addEventListener('visibilitychange',this.onVisibility);
      this.motion.addEventListener('change',this.onMotion);
      this.sync();
    }

    disconnectedCallback() {
      this.observer.disconnect();
      document.removeEventListener('visibilitychange',this.onVisibility);
      this.motion.removeEventListener('change',this.onMotion);
      this.animations.forEach(animation => animation.pause());
    }
  }
  if (!customElements.get('steering-teaser')) customElements.define('steering-teaser',SteeringTeaser);
})();
