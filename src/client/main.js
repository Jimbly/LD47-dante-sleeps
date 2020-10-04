/*eslint global-require:off*/
const glov_local_storage = require('./glov/local_storage.js');
glov_local_storage.storage_prefix = 'ld47'; // Before requiring anything else that might load from this

const assert = require('assert');
const animation = require('./glov/animation.js');
const camera2d = require('./glov/camera2d.js');
const engine = require('./glov/engine.js');
const glov_font = require('./glov/font.js');
const input = require('./glov/input.js');
const { cos, floor, max, min, sin, tan, PI, round, sqrt } = Math;
const net = require('./glov/net.js');
const particles = require('./glov/particles.js');
const particle_data = require('./particle_data.js');
const pico8 = require('./glov/pico8.js');
const { randCreate } = require('./glov/rand_alea.js');
const score_system = require('./glov/score.js');
const glov_sprites = require('./glov/sprites.js');
// const sprite_animation = require('./glov/sprite_animation.js');
const transition = require('./glov/transition.js');
const ui = require('./glov/ui.js');
const { clamp, nop } = require('../common/util.js');
const { soundPlay } = require('./glov/sound.js');
const {
  vec2,
  v2add,
  v2addScale,
  v2copy,
  v2distSq,
  v2normalize,
  v2scale,
  v2sub,
  vec4,
  v4lerp,
} = require('./glov/vmath.js');

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.AIR = 10;
Z.PARTICLES = 19;
Z.PLAYER = 20;
Z.ROCKS = 30;
Z.RINGS = 32;
Z.PLAYER_WIN = 40;
Z.PARTICLE_CRASH = 50;
Z.UI_play = 200;

// let app = exports;
// Virtual viewport for our game logic
const game_width = 320;
const game_height = 240;
const render_width = game_width;
const render_height = game_height;

const rock_fade_time = 500;
const ring_fade_time = 1000;

export let sprites = {};

export function main() {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    net.init({ engine });
  }

  function startup() {
    const font_info_04b03x2 = require('./img/font/04b03_8x2.json');
    const font_info_04b03x1 = require('./img/font/04b03_8x1.json');
    const font_info_palanquin32 = require('./img/font/palanquin32.json');
    let pixely = 'strict';
    let font;
    let title_font;
    if (pixely === 'strict') {
      font = { info: font_info_04b03x1, texture: 'font/04b03_8x1' };
      title_font = { info: font_info_04b03x2, texture: 'font/04b03_8x2' };
    } else if (pixely && pixely !== 'off') {
      font = { info: font_info_04b03x2, texture: 'font/04b03_8x2' };
    } else {
      font = { info: font_info_palanquin32, texture: 'font/palanquin32' };
    }

    if (!engine.startup({
      game_width: render_width,
      game_height: render_height,
      pixely,
      font,
      title_font,
      viewport_postprocess: false,
      show_fps: engine.DEBUG,
      ui_sounds: {
        'crash': ['crash1', 'crash2', 'crash3', 'crash4', 'crash5'],
        'pickup': ['pickup1', 'pickup2', 'pickup3', 'pickup4'],
        'win': 'win',
        'thurst1': 'thrust1',
        'thurst2': 'thrust2',
        'thurst3': 'thrust3',
      },
      sound: {
        ext_list: ['mp3', 'wav'],
      },
    })) {
      return true;
    }
    return false;
  }
  if (startup()) {
    return;
  }

  let { font, title_font } = ui;

  let thrust_sound;

  let font2 = glov_font.create(require('./img/font/vga_16x2.json'), 'font/vga_16x2');


  // const font = engine.font;

  // Perfect sizes for pixely modes
  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);

  const createSprite = glov_sprites.create;
  // const createAnimation = sprite_animation.create;

  const KEYS = input.KEYS;
  //const PAD = input.PAD;

  let uvs = vec4(0,0,1,1);
  let temp_color = vec4();
  function farBgStars() {
    uvs[0] = sprites.far_bg_stars.uvs[0];
    uvs[2] = sprites.far_bg_stars.uvs[2];
    //uvs[1] = 0 + round(engine.frame_timestamp * 0.001) / 512;
    uvs[1] = 0 + engine.frame_timestamp * 0.000002;
    uvs[3] = uvs[1] + 240.5/512;
    sprites.far_bg_stars.draw({
      x: 0, y: 0, z: Z.BACKGROUND,
      w: render_width, h: render_height,
      uvs,
      nozoom: true,
    });
    uvs[0] = 0;
    uvs[2] = 320/128;
    uvs[1] = 0 + round(engine.frame_timestamp * 0.01) / 128;
    uvs[3] = uvs[1] + 240/128;
    sprites.far_bg_noise.draw({
      x: 0, y: 0, z: Z.BACKGROUND + 0.1,
      w: render_width, h: render_height,
      uvs,
    });
  }
  function colorScale(src, scale) {
    return vec4(src[0] * scale, src[1] * scale, src[2] * scale, src[3]);
  }
  let color_cycle_daynight = [
    colorScale(pico8.colors[1], 0.5),
    colorScale(pico8.colors[1], 0.5),
    pico8.colors[2],
    pico8.colors[4],
    pico8.colors[9],
    pico8.colors[12],
    pico8.colors[12],
    pico8.colors[14],
  ];
  color_cycle_daynight.push(color_cycle_daynight[0]);
  let color_cycle_alien = [
    colorScale(pico8.colors[2], 0.5),
    colorScale(pico8.colors[2], 0.5),
    pico8.colors[4],
    pico8.colors[13],
    pico8.colors[3],
  ];
  color_cycle_alien.push(color_cycle_alien[0]);
  function farBgCycle(color_cycle) {
    let t = engine.frame_timestamp * 0.0001 % (color_cycle.length - 1);
    let t0 = floor(t);
    v4lerp(temp_color, t - t0, color_cycle[t0], color_cycle[t0+1]);
    temp_color[3] = 0.5;
    sprites.game_bg.draw({
      x: 0, y: 0, z: Z.BACKGROUND,
      color: temp_color,
    });
  }
  let bg_set1 = ['hill_big1', 'clouds', 'hill_big2', 'plant', 'hill']; // farBgCycle.bind(null, color_cycle_daynight)
  let bg_set2 = ['hill_big1gr', 'clouds', 'hill2b', 'hill1p']; // farBgCycle.bind(null, color_cycle_alien)
  let bg_set3 = ['hill_big1', 'clouds', 'hill_big2']; // farBgStars
  let bg_set4 = ['hill_big1g', 'hill_big2g']; // farBgStars
  let bg_set5 = ['hill_big1', 'clouds', 'hill_big2', 'hill2b', 'hill']; // farBgCycle.bind(null, color_cycle_daynight)
  let levels = [
    // {
    //   name: 'test',
    //   seed: 4,
    //   rdense: 16,
    //   safe_zone: 320,
    //   num_rings: 10,
    //   ring_dense: 160,
    //   air_dense: 230,
    //   ring_amp: 32,
    //   far_bg: farBgCycle.bind(null, color_cycle_daynight),
    //   bg_set: bg_set5,
    // },
    { // first
      name: 'intro',
      display_name: 'Intro',
      seed: 3,
      rdense: 100,
      safe_zone: 320,
      safe_clear: true,
      num_rings: 4,
      ring_dense: 200,
      air_dense: 0,
      ring_amp: 0,
      far_bg: farBgStars,
      bg_set: bg_set1,
    },
    { // 12 hits, 1:07
      name: 'moving_rings',
      display_name: 'Movin\' Rings',
      seed: 6,
      rdense: 16,
      safe_zone: 320,
      num_rings: 6,
      ring_dense: 160,
      air_dense: 0,
      ring_amp: 32,
      far_bg: farBgCycle.bind(null, color_cycle_alien),
      bg_set: bg_set2,
    },
    { // 2 hits, 0:48
      name: 'add_air',
      display_name: 'Air Drafts',
      seed: 9,
      rdense: 40,
      safe_zone: 320,
      num_rings: 8,
      ring_dense: 120,
      air_dense: 190,
      ring_amp: 0,
      far_bg: farBgCycle.bind(null, color_cycle_daynight),
      bg_set: bg_set5,
    },
    { // 20 hits, 1:39
      name: 'medium',
      display_name: 'Medium',
      seed: 14,
      rdense: 21,
      safe_zone: 320,
      num_rings: 10,
      ring_dense: 160,
      air_dense: 230,
      ring_amp: 32,
      far_bg: farBgStars,
      bg_set: bg_set3,
    },
    { // 22 hits, 1:10
      name: 'rough_ride',
      display_name: 'Rough Ride',
      seed: 13,
      rdense: 8,
      safe_zone: 320,
      num_rings: 1,
      ring_dense: 1000,
      air_dense: 400,
      ring_amp: 100,
      far_bg: farBgCycle.bind(null, color_cycle_alien),
      bg_set: bg_set2,
    },
    { // 0 hits, 2 minutes
      name: 'time_attack',
      display_name: 'Time Attack',
      seed: 5,
      rdense: 0,
      safe_zone: 320,
      safe_clear: true,
      num_rings: 20,
      ring_dense: 30,
      air_dense: 230,
      ring_amp: 0,
      far_bg: farBgStars,
      bg_set: bg_set4,
    },
    { // 16 hits, 2:41
      name: 'hard',
      display_name: 'Hard',
      seed: 16,
      rdense: 16,
      safe_zone: 320,
      num_rings: 10,
      ring_dense: 160,
      air_dense: 200,
      ring_amp: 32,
      far_bg: farBgCycle.bind(null, color_cycle_daynight),
      bg_set: bg_set1,
    },
  ];

  function encodeScore(score) {
    assert(score.time && score.hits >= 0/* && score.rings*/); // some old scores had no rings
    let time = min(score.time, 999999);
    return (score.rings || 0) * 1000000 * 1000 +
      (999 - score.hits) * 1000000 +
      (999999 - time);
  }

  function parseScore(value) {
    let rings = floor(value / (1000000 * 1000));
    value -= rings * (1000000 * 1000);
    let hits = floor(value / (1000000));
    value -= hits * 1000000;
    let time = value;
    return {
      rings,
      hits: 999 - hits,
      time: 999999 - time,
    };
  }

  score_system.init(encodeScore, parseScore, levels, 'LD47');
  score_system.updateHighScores();

  function initGraphics() {
    particles.preloadParticleData(particle_data);
    sprites.rock = createSprite({
      name: 'rock',
      size: vec2(16, 16),
      ws: [12, 12],
      hs: [12, 12],
      origin: vec2(0.5,0.5),
    });
    sprites.player = createSprite({
      name: 'plane',
      size: vec2(16, 16),
      origin: vec2(0.5,0.5),
    });
    sprites.ring = createSprite({
      name: 'ring',
      ws: [32, 32, 32],
      hs: [32, 32, 32, 32],
      size: vec2(16, 16),
      origin: vec2(0.5, 0.5),
    });
    sprites.air = createSprite({
      url: 'white',
      size: vec2(1, 1),
      origin: vec2(0.5, 0.5),
    });
    sprites.game_bg = createSprite({
      url: 'white',
      size: vec2(render_width, render_height),
    });
    sprites.bg = {};
    sprites.bg.hill_big = [
      createSprite({ name: 'bg/hill_big_1' }),
      createSprite({ name: 'bg/hill_big_2' }),
      createSprite({ name: 'bg/hill_big_3' }),
    ];
    sprites.bg.plant = [
      createSprite({ name: 'bg/plant_1' }),
      createSprite({ name: 'bg/plant_2' }),
      createSprite({ name: 'bg/plant_3' }),
      createSprite({ name: 'bg/plant_4' }),
    ];
    sprites.bg.hill = [
      createSprite({ name: 'bg/hill_1' }),
      createSprite({ name: 'bg/hill_2' }),
      createSprite({ name: 'bg/hill_3' }),
    ];
    let clouds = createSprite({ name: 'bg/clouds', ws: [128, 128], hs: [128, 128, 128, 128] });
    sprites.bg.clouds = [
      { sprite: clouds, frame: 0 },
      { sprite: clouds, frame: 1 },
      { sprite: clouds, frame: 2 },
      { sprite: clouds, frame: 3 },
      { sprite: clouds, frame: 4 },
      { sprite: clouds, frame: 5 },
      { sprite: clouds, frame: 6 },
      { sprite: clouds, frame: 7 },
    ];
    sprites.far_bg_stars = createSprite({ name: 'bg/far1', filter_min: gl.LINEAR, filter_mag: gl.LINEAR });
    sprites.far_bg_noise = createSprite({ name: 'bg/noise_mask' });
  }
  initGraphics();

  function killFX() {
    if (thrust_sound) {
      thrust_sound.fadeOut(100);
      thrust_sound = null;
    }
    engine.glov_particles.killAll();
  }

  const base_radius = 50;
  let state;
  let rand;
  let cur_level_idx;
  function setupLevel(level_idx) {
    cur_level_idx = level_idx;
    let level = levels[level_idx];
    let {
      seed,
      rdense,
      safe_zone,
      safe_clear,
      num_rings,
      ring_dense,
      ring_amp,
      air_dense,
    } = level;
    killFX();
    rand = randCreate(seed);
    let level_w = ring_dense * (num_rings + 1);
    state = {
      num_rings,
      level_w,
      time: 0,
      hit_rings: 0,
      hit_rocks: 0,
      cam_x: -game_width / 2 + 160,
      bg_x: 0,
      player: {
        pos: vec2(160, game_height / 2 + base_radius),
        angle: PI,
        radius: 1,
      },
      stuff: [],
      do_win: false,
      win_counter: 0,
      bg_data: [],
      last_hit_time: 0,
    };
    state.last_part_pos = state.player.pos.slice(0);
    let num_rocks = rdense ? floor(state.level_w / rdense) : 0;
    for (let ii = 0; ii < num_rocks; ++ii) {
      let x = (ii + rand.random()) * rdense;
      let y = rand.floatBetween(16, game_height - 16);
      if (x < safe_zone) {
        if (safe_clear) {
          continue;
        }
        y = clamp(y < game_height / 2 ? y * 0.1 : game_height - (game_height - y) * 0.1, 16, game_height - 16);
      }
      state.stuff.push({
        sprite: sprites.rock,
        type: 'rock',
        pos: vec2(x, y),
        angle: rand.floatBetween(0, PI * 2),
        rspeed: rand.floatBetween(-1, 1),
        color: vec4(1,1,1, 1),
        freq: 0, // 0.001 * rand.random(),
        freq_offs: rand.random() * PI * 2,
        amp: 40,
        rsquared: 8*8,
        frame: rand.range(4),
        z: Z.ROCKS,
      });
    }
    for (let ii = 0; ii < num_rings; ++ii) {
      let x = (ii + 1 + rand.random()) * ring_dense;
      if (num_rings === 1) {
        x = ring_dense + 160;
      }
      state.stuff.push({
        sprite: sprites.ring,
        type: 'ring',
        pos: vec2(x, rand.floatBetween(32, game_height - 32)),
        angle: 0,
        rspeed: 0,
        frame: rand.floatBetween(0, 10),
        color: vec4(1,1,1, 1),
        rsquared: 12*12,
        freq: 0.0013,
        freq_offs: rand.random() * PI * 2,
        amp: ring_amp,
        z: Z.RINGS,
      });
    }
    let num_air = air_dense ? floor(level_w / air_dense) : 0;
    for (let ii = 0; ii < num_air; ++ii) {
      let tall = rand.random() > 0.5;
      let thing = {
        sprite: sprites.air,
        type: 'air',
        pos: vec2((ii + rand.random()) * air_dense, rand.floatBetween(16, game_height - 16)),
        size: vec2(32, tall ? 64 : 32),
        angle: 0,
        rspeed: 0,
        color: pico8.colors[12].slice(0),
        rsquared: 12*12,
        freq: 0,
        freq_offs: rand.random() * PI * 2,
        amp: 32,
        z: Z.AIR - 1,
      };
      state.stuff.push(thing);
      engine.glov_particles.createSystem(particle_data.defs[tall ? 'air_tall' : 'air'],
        [thing.pos[0], thing.pos[1], Z.AIR]
      );
      if (thing.pos[0] > level_w - game_width - 100) {
        engine.glov_particles.createSystem(particle_data.defs[tall ? 'air_tall' : 'air'],
          [thing.pos[0] - level_w, thing.pos[1], Z.AIR]
        );
      }
      if (thing.pos[0] < game_width + 100) {
        engine.glov_particles.createSystem(particle_data.defs[tall ? 'air_tall' : 'air'],
          [thing.pos[0] + level_w, thing.pos[1], Z.AIR]
        );
      }

    }
    for (let ii = 0; ii < state.stuff.length; ++ii) {
      state.stuff[ii].pos0 = state.stuff[ii].pos.slice(0);
    }
  }

  let bg_layers = {
    hill_big1: {
      xscale: 0.05,
      dx: 120,
      dx_range: 40,
      w: 320,
      h: 128,
      ymin: game_height - 128 - 50,
      ymax: game_height - 128*0.5 - 50,
      sprite_list: sprites.bg.hill_big,
      crange: [colorScale(pico8.colors[1], 0.4), colorScale(pico8.colors[1], 0.6)],
    },
    hill_big1g: {
      xscale: 0.05,
      dx: 120,
      dx_range: 40,
      w: 320,
      h: 128,
      ymin: game_height - 128 - 50,
      ymax: game_height - 128*0.5 - 50,
      sprite_list: sprites.bg.hill_big,
      crange: [colorScale(pico8.colors[3], 0.4), colorScale(pico8.colors[3], 0.6)],
    },
    hill_big1gr: {
      xscale: 0.05,
      dx: 120,
      dx_range: 40,
      w: 320,
      h: 128,
      ymin: game_height - 128 - 50,
      ymax: game_height - 128*0.5 - 50,
      sprite_list: sprites.bg.hill_big,
      crange: [colorScale(pico8.colors[5], 0.3), colorScale(pico8.colors[5], 1)],
    },
    clouds: {
      xscale: 0.15,
      dx: 40,
      dx_range: 160,
      dx_speed: 0.003,
      w: 64,
      h: 48,
      ymin: -32,
      ymax: 64,
      sprite_list: sprites.bg.clouds,
      crange: [vec4(1,1,1,0.1), vec4(1,1,1,0.2)],
    },
    hill_big2: {
      xscale: 0.1,
      dx: 80,
      dx_range: 40,
      w: 320,
      h: 128,
      ymin: game_height - 128,
      ymax: game_height - 128*0.5,
      sprite_list: sprites.bg.hill_big,
      crange: [colorScale(pico8.colors[1], 0.6), colorScale(pico8.colors[1], 1)],
    },
    hill_big2g: {
      xscale: 0.1,
      dx: 80,
      dx_range: 40,
      w: 320,
      h: 128,
      ymin: game_height - 128,
      ymax: game_height - 128*0.5,
      sprite_list: sprites.bg.hill_big,
      crange: [colorScale(pico8.colors[3], 0.6), colorScale(pico8.colors[3], 1)],
    },
    plant: {
      xscale: 0.2,
      dx: 100,
      dx_range: 50,
      w: 64,
      h: 128,
      ymin: game_height - 120,
      ymax: game_height - 64,
      sprite_list: sprites.bg.plant,
      crange: [colorScale(pico8.colors[5], 0.8), colorScale(pico8.colors[5], 1)],
    },
    hill: {
      xscale: 0.3,
      dx: 60,
      dx_range: 10,
      w: 128,
      h: 128,
      ymin: game_height - 64,
      ymax: game_height - 16,
      sprite_list: sprites.bg.hill,
      crange: [colorScale(pico8.colors[3], 0.7), colorScale(pico8.colors[3], 1)],
    },
    hill2b: {
      xscale: 0.2,
      dx: 60,
      dx_range: 10,
      w: 128,
      h: 128,
      ymin: game_height - 64 - 48,
      ymax: game_height - 16 - 48,
      sprite_list: sprites.bg.hill,
      crange: [colorScale(pico8.colors[5], 1), colorScale(pico8.colors[4], 1)],
    },
    hill1p: {
      xscale: 0.3,
      dx: 60,
      dx_range: 10,
      w: 128,
      h: 128,
      ymin: game_height - 64,
      ymax: game_height - 16,
      sprite_list: sprites.bg.hill,
      crange: [v4lerp(vec4(), 0.5, pico8.colors[2], pico8.colors[4]), pico8.colors[2]],
    },
  };

  let hud_style = glov_font.style(null, {
    outline_width: 3,
    outline_color: (pico8.font_colors[0] & 0xFFFFFF00) | 0x80,
    color: pico8.font_colors[9],
  });

  let hits_style_green = glov_font.style(null, {
    outline_width: 3,
    outline_color: pico8.font_colors[0],
    color: pico8.font_colors[11],
  });
  let hits_style_yellow = glov_font.style(hits_style_green, {
    color: pico8.font_colors[10],
  });
  // let hits_style_red = glov_font.style(hits_style_green, {
  //   color: pico8.font_colors[8],
  // });

  const speed_scale = 0.75;
  const dTheta = 0.002 * speed_scale;
  const accel = 0.0025 * 0.75;
  const air_drag = 0.5;
  const min_radius = 0.5 * base_radius;
  let delta = vec2();
  let show_preview = false;

  function stepPlayer(player, dt) {
    let hit_air = false;
    for (let ii = 0; ii < state.stuff.length; ++ii) {
      let r = state.stuff[ii];
      if (r.type === 'air') {
        r.hit = player.pos[0] > r.pos[0] - r.size[0]/2 && player.pos[0] < r.pos[0] + r.size[0]/2 &&
          player.pos[1] > r.pos[1] - r.size[1]/2 && player.pos[1] < r.pos[1] + r.size[1]/2 &&
          !state.do_win;
        if (r.hit) {
          hit_air = true;
        }
      }
    }

    let radius = player.radius * base_radius;
    let { angle } = player;
    // Test angle against the top of the screen (y = 0)
    let test_angle = angle;
    let rbias = 0;
    if (test_angle > PI) {
      // coming down from the top, scale back the max radius limit
      test_angle = PI * 2 - test_angle;
      if (test_angle < PI / 2) {
        rbias = test_angle * base_radius * 2;
      } else {
        rbias = (PI - test_angle) * base_radius * 2;
      }
    }
    let dist_to_top = player.pos[1];
    let inter_angle = (PI - test_angle) / 2;
    let hoffs = tan(inter_angle) * dist_to_top;
    let max_r = hoffs / sin(PI - test_angle) - 0.5 + rbias;
    //let maxs_center = vec2(player.pos[0] + max_r * cos(angle + PI/2), player.pos[1] + max_r * sin(angle + PI/2));
    //ui.drawHollowCircle(maxs_center[0], maxs_center[1], Z.PLAYER - 1, max_r, 0.99, [1,1,1, 0.5]);

    // Test angle against the bottom of the screen (y = 0)
    test_angle = angle - PI;
    if (test_angle < 0) {
      test_angle += PI * 2;
    }
    rbias = 0;
    if (test_angle > PI) {
      test_angle = PI * 2 - test_angle;
      if (test_angle < PI / 2) {
        rbias = test_angle * base_radius * 2;
      } else {
        rbias = (PI - test_angle) * base_radius * 2;
      }
    }
    let dist_to_bottom = game_height - player.pos[1];
    inter_angle = (PI - test_angle) / 2;
    hoffs = tan(inter_angle) * dist_to_bottom;
    let max_r2 = hoffs / sin(PI - test_angle) - 0.5 + rbias;
    // let maxs_center = vec2(player.pos[0] + max_r2 * cos(angle + PI/2), player.pos[1] + max_r2 * sin(angle + PI/2));
    // ui.drawHollowCircle(maxs_center[0], maxs_center[1], Z.PLAYER - 1, max_r2, 0.99, [1,1,1, 0.5]);

    // ui.print(null, 50, 50, Z.PLAYER + 10, `angle: ${(angle * 180 / PI).toFixed(0)}`);
    if (isFinite(max_r2)) {
      if (isFinite(max_r)) {
        max_r = min(max_r, max_r2);
      } else {
        max_r = max_r2;
      }
    }
    if (isFinite(max_r)) {
      // let maxs_center = vec2(player.pos[0] + max_r * cos(angle + PI/2), player.pos[1] + max_r * sin(angle + PI/2));
      // ui.drawHollowCircle(maxs_center[0], maxs_center[1], Z.PLAYER - 1, max_r, 0.99, [1,0,0, 0.5]);
      // Instead of an absolute max, we want to reduce the radius only if
      //  the *minimum* radius is not going to fit?
      if (max_r > min_radius) {
        max_r = (max_r - min_radius) * 4 + min_radius;
      }
      // maxs_center = vec2(player.pos[0] + max_r * cos(angle + PI/2), player.pos[1] + max_r * sin(angle + PI/2));
      // ui.drawHollowCircle(maxs_center[0], maxs_center[1], Z.PLAYER - 1, max_r, 0.99, [0,1,0, 0.5]);
      radius = min(radius, max_r);
    }
    // let dir = vec2(cos(angle), sin(angle));
    let new_angle = angle - dt * dTheta;
    if (new_angle < 0) {
      new_angle += PI * 2;
    }
    let center = vec2(player.pos[0] + radius * cos(angle + PI/2), player.pos[1] + radius * sin(angle + PI/2));
    let new_pos = vec2(center[0] - radius * cos(new_angle + PI/2), center[1] - radius * sin(new_angle + PI/2));
    if (hit_air) {
      // This is effectively no different than scaling the radius!
      v2sub(delta, new_pos, player.pos);
      v2scale(delta, delta, air_drag);
      v2add(new_pos, player.pos, delta);
    }
    if (engine.DEBUG) {
      if (input.keyDown(KEYS.RIGHT)) {
        new_pos[0] = player.pos[0] + dt * 0.2;
        new_pos[1] = player.pos[1];
      }
      if (input.keyDown(KEYS.LEFT)) {
        new_pos[0] = player.pos[0] - dt * 0.2;
        new_pos[1] = player.pos[1];
      }
    }
    player.angle = new_angle;
    new_pos[1] = clamp(new_pos[1], 0, game_height);
    player.pos[0] = new_pos[0];
    player.pos[1] = new_pos[1];
  }

  function shift(shift_dist) {
    state.player.pos[0] += shift_dist;
    state.cam_x += shift_dist;
    state.last_part_pos[0] += shift_dist;
    engine.glov_particles.shift([shift_dist, 0, 0]);
  }

  function triggerWin() {
    state.do_win = true;
    state.win_counter = 0;
    setTimeout(() => {
      ui.playUISound('win');
    }, 1000);
  }

  function setThrustSound(sound_key) {
    if (ui.isMenuUp()) {
      if (thrust_sound) {
        thrust_sound.fadeOut(250);
        thrust_sound = null;
      }
      return;
    }
    if (thrust_sound && thrust_sound.key === sound_key &&
      engine.frame_timestamp - thrust_sound.start_at < 3500
    ) {
      return;
    }
    if (thrust_sound) {
      thrust_sound.fadeOut(250);
    }
    thrust_sound = soundPlay(sound_key, 0.125);
    if (thrust_sound) {
      thrust_sound.key = sound_key;
      thrust_sound.start_at = engine.frame_timestamp;
    }
  }

  function play(dt) {
    let cur_level = levels[cur_level_idx];
    cur_level.far_bg();

    let { player, stuff } = state;
    if (player.pos[0] > state.level_w) {
      shift(-state.level_w);
    } else if (player.pos[0] < 0) {
      shift(state.level_w);
    }

    if (engine.DEBUG && input.keyDownEdge(KEYS.F1)) {
      if (state.do_win) {
        state.do_win = false;
      } else {
        ui.playUISound('pickup');
        triggerWin();
      }
    }

    if (input.keyDownEdge(KEYS.F2)) {
      show_preview = !show_preview;
    }

    if (input.keyDownEdge(KEYS.ESC) && !state.do_win) {
      ui.modalDialog({
        text: 'Really quit?',
        buttons: {
          Yes: () => {
            transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, true));
            setTimeout(() => {
              // eslint-disable-next-line no-use-before-define
              engine.setState(levelSelectInit);
            }, 1);
          },
          No: null,
        },
      });
    }
    if (ui.isMenuUp()) {
      dt = 0;
    }

    // update stuff
    for (let ii = 0; ii < stuff.length; ++ii) {
      let r = stuff[ii];
      r.angle += r.rspeed * dt * 0.0002;
      r.pos[1] = r.pos0[1] + r.amp * sin(r.freq * engine.frame_timestamp + r.freq_offs);
    }

    // update player
    let player_scale = 1;

    let emit_step = 4;
    let emit_min_dist = 8;
    function emitSmoke() {
      let dist = v2distSq(state.last_part_pos, player.pos);
      if (dist > emit_min_dist*emit_min_dist) {
        let part = player.radius > 1.95 ? 'smoke1' : player.radius < 0.55 ? 'smoke2' : 'smoke';
        dist = sqrt(dist);
        v2sub(delta, player.pos, state.last_part_pos);
        v2normalize(delta, delta);
        let tan_x = cos(player.angle - PI/2) * 3 * player_scale;
        let tan_y = sin(player.angle - PI/2) * 3 * player_scale;
        while (dist > emit_min_dist) {
          v2addScale(state.last_part_pos, state.last_part_pos, delta, emit_step);
          dist -= emit_step;
          engine.glov_particles.createSystem(particle_data.defs[part],
            [state.last_part_pos[0] + tan_x, state.last_part_pos[1] + tan_y, Z.PARTICLES]
          );
        }
      }
    }

    if (state.do_win) {
      state.win_counter += dt;
      // Even out angle
      let da = dt * dTheta * 1.5;
      if (player.angle < PI && player.angle > PI * 0.75) {
        player.angle = min(player.angle + da, PI);
      } else {
        player.angle -= da;
        if (player.angle < 0) {
          player.angle += PI * 2;
        }
        if (player.angle < PI && player.angle > PI * 0.75) {
          player.angle = PI;
        }
      }
      let dist = -dt * speed_scale * 0.2;
      let new_pos = vec2(player.pos[0] + cos(player.angle) * dist, player.pos[1] + sin(player.angle) * dist);
      if (player.angle === PI) {
        let dh = dt * 0.05;
        // if (new_pos[1] < game_height/2) {
        //   new_pos[1] = min(new_pos[1] + dh, game_height / 2);
        // } else if (new_pos[1] > game_height / 2) {
        //   new_pos[1] = max(new_pos[1] - dh, game_height / 2);
        // }
        new_pos[1] -= dh;
      }
      player_scale = min(1 + state.win_counter * 0.0005, 2);
      player.pos[0] = new_pos[0];
      player.pos[1] = new_pos[1];
      emitSmoke();
      if (player.pos[1] < -100) {
        transition.queue(Z.TRANSITION_FINAL, transition.pixelate(500));
        // eslint-disable-next-line no-use-before-define
        engine.setState(levelSelectInit);
      }
      if (thrust_sound) {
        thrust_sound.fadeOut(100);
        thrust_sound = null;
      }
    } else {
      let { radius } = player;
      if (input.keyDown(KEYS.D) || input.mouseDown({
        y: -20000,
        h: 40000,
        x: camera2d.wReal() / 2,
        w: Infinity,
      })) {
        player.radius = min(2, radius + dt * accel);
      } else if (input.keyDown(KEYS.A) || input.mouseDown({
        y: -20000,
        h: 40000,
        x: -20000,
        w: 20000 + camera2d.wReal() / 2,
      })) {
        player.radius = max(0.5, radius - dt * accel);
      } else if (radius > 1) {
        player.radius = max(1, radius - dt * accel * 2);
      } else if (radius < 1) {
        player.radius = min(1, radius + dt * accel * 2);
      }
      let step_dt = dt;
      while (step_dt > 0) {
        stepPlayer(player, min(step_dt, 16));
        step_dt -= 16;
        emitSmoke();
      }
      state.time += dt;

      setThrustSound(player.radius < 0.55 ? 'thrust3' : player.radius > 1.95 ? 'thrust2' : 'thrust1');
    }
    let new_cam_x = min(max(state.cam_x, floor(player.pos[0]) - game_width * 2 / 3),
      floor(player.pos[0]) - game_width / 3);
    state.bg_x += new_cam_x - state.cam_x;
    state.cam_x = new_cam_x;

    let cam_x = floor(state.cam_x);
    camera2d.setAspectFixed(game_width, game_height);
    camera2d.set(camera2d.x0() + cam_x, camera2d.y0(), camera2d.x1() + cam_x, camera2d.y1());

    if (engine.DEBUG && input.keyDownEdge(KEYS.F3)) {
      engine.glov_particles.createSystem(particle_data.defs.pickup,
        [player.pos[0], player.pos[1], Z.PARTICLE_CRASH]
      );
      ui.playUISound('pickup');
    }

    sprites.player.draw({
      x: floor(player.pos[0]),
      y: floor(player.pos[1]),
      z: state.do_win ? Z.PLAYER_WIN : Z.PLAYER,
      rot: player.angle + PI,
      color: [1, 1, 1, 1],
      w: player_scale,
      h: player_scale,
    });

    // draw flight preview
    if (show_preview && !state.do_win) {
      let test_player = {
        pos: player.pos.slice(0),
        angle: player.angle,
        radius: player.radius,
      };
      let last_pos = player.pos.slice(0);
      let len = 48;
      for (let ii = 0; len >= 0; ++ii) {
        stepPlayer(test_player, 16);
        ui.drawLine(last_pos[0], last_pos[1], test_player.pos[0], test_player.pos[1], Z.PLAYER - 1, 2, 0.9,
          [1,1,1,0.5 * len/32]);
        len -= sqrt(v2distSq(last_pos, test_player.pos));
        v2copy(last_pos, test_player.pos);
      }
    }

    let fade = state.do_win ? max(0, 1 - state.win_counter / 3000) : 1;
    let view_x0 = cam_x - 64;
    let view_x1 = cam_x + game_width + 64;
    for (let ii = 0; ii < stuff.length; ++ii) {
      let r = stuff[ii];
      if (r.hide) {
        continue;
      }
      let frame;
      let hit = false;
      let w;
      let h;
      if (r.type === 'air') {
        w = r.size[0];
        h = r.size[1];
        if (r.hit) {
          r.color[3] = 1;
        } else {
          r.color[3] = 0.5;
        }
      } else {
        hit = v2distSq(r.pos, player.pos) < r.rsquared && !state.do_win;
        if (hit) {
          if (!r.hit) {
            r.hit = true;
            if (r.type === 'rock') {
              r.hit_fade = rock_fade_time;
              state.hit_rocks++;
              state.last_hit_time = engine.frame_timestamp;
              state.player.radius = 0.5;
              state.player.angle += rand.floatBetween(0.5, 0.75);
              engine.glov_particles.createSystem(particle_data.defs.crash,
                [r.pos[0], r.pos[1], Z.PARTICLE_CRASH]
              );
              ui.playUISound('crash', 0.5);
            } else if (r.type === 'ring') {
              r.hit_fade = ring_fade_time;
              state.hit_rings++;
              engine.glov_particles.createSystem(particle_data.defs.pickup,
                [r.pos[0], r.pos[1], Z.PARTICLE_CRASH]
              );
              ui.playUISound('pickup');
              score_system.setScore(cur_level_idx,
                { rings: state.hit_rings, hits: state.hit_rocks, time: round(state.time / 10) }
              );
              if (state.hit_rings === state.num_rings) {
                triggerWin();
              }
            }
          }
          if (r.type === 'rock') {
            r.color[0] = 1;
            r.color[1] = 0;
            r.color[2] = 0;
          } else {
            r.color[0] = 0;
            r.color[1] = 1;
            r.color[2] = 0;
          }
        }
        if (r.hit) {
          r.hit_fade -= dt;
          if (r.hit_fade < 0) {
            r.hide = true;
            continue;
          }
          r.color[3] = r.hit_fade / rock_fade_time;
        }
        if (r.type === 'ring') {
          frame = floor(r.frame + engine.frame_timestamp * 0.01) % 10;
        } else if (r.type === 'rock') {
          frame = r.frame;
        }
      }
      let x = r.pos[0];
      if (x > view_x1) {
        x -= state.level_w;
      } else if (x < view_x0) {
        x += state.level_w;
      }
      if (x >= view_x0 && x <= view_x1 && r.type !== 'air') {
        let alpha_save = r.color[3];
        r.color[3] *= fade;
        r.sprite.draw({
          x,
          y: r.pos[1],
          z: r.z,
          w, h,
          rot: r.angle,
          color: r.color,
          frame,
        });
        r.color[3] = alpha_save;
      }
    }

    if (cur_level_idx === 0) {
      ui.print(glov_font.styleAlpha(null, fade), 50 + (cam_x > game_width ? state.level_w : 0),
        game_height - 32 - ui.font_height - 1, Z.PLAYER - 1, 'Controls: A and D');
      ui.print(glov_font.styleAlpha(null, fade), 50 + (cam_x > game_width ? state.level_w : 0),
        game_height - 32, Z.PLAYER - 1, '  or Touch left/right half of display');
    }

    camera2d.setAspectFixed(game_width, game_height);
    // Background
    let z = Z.BACKGROUND + 1;
    let { bg_x, bg_data } = state;
    let layer = 0;
    function doBGLayer(opts) {
      if (!bg_data[layer]) {
        bg_data[layer] = [];
      }
      let layer_data = bg_data[layer];
      let layer_x = floor(bg_x * opts.xscale + (opts.dx_speed || 0) * engine.frame_timestamp);
      let x0 = floor((layer_x - opts.w - opts.dx_range) / opts.dx);
      let x1 = floor((layer_x + game_width) / opts.dx) + 1;
      for (let x = x0; x <= x1; ++x) {
        let hb = layer_data[x];
        if (!hb) {
          let yrange = rand.random();
          let y = (opts.ymax - opts.ymin) * yrange + opts.ymin;
          hb = layer_data[x] = {
            idx: rand.range(opts.sprite_list.length),
            xoffs: rand.floatBetween(0, opts.dx_range),
            y,
            z: z + yrange,
          };
          hb.color = v4lerp(vec4(), yrange, opts.crange[0], opts.crange[1]);
        }
        let sprite = opts.sprite_list[hb.idx];
        let frame;
        if (sprite.sprite) {
          frame = sprite.frame;
          sprite = sprite.sprite;
        }
        sprite.draw({
          x: floor(x * opts.dx + hb.xoffs - layer_x),
          y: hb.y,
          w: opts.w,
          h: opts.h,
          z: hb.z,
          color: hb.color,
          frame,
        });
      }
      layer++;
      z++;
    }
    for (let ii = 0; ii < cur_level.bg_set.length; ++ii) {
      doBGLayer(bg_layers[cur_level.bg_set[ii]]);
    }

    // HUD
    // ui.print(null, 5, 5, Z.UI, `player_x:${player.pos[0]}`);

    let score_size = 100;
    title_font.drawSizedAligned(hud_style, game_width - score_size, game_height - 16, Z.UI, 26,
      font.ALIGN.HCENTER|font.ALIGN.VBOTTOM, score_size, 0, `${state.hit_rings}/${state.num_rings}`);
    let time_since_hit = engine.frame_timestamp - state.last_hit_time;
    font.drawSizedAligned(
      !state.hit_rocks ? hits_style_green : glov_font.styleColored(hits_style_yellow,
        glov_font.intColorFromVec4Color(
          v4lerp(temp_color, min(time_since_hit/1000, 1), pico8.colors[8], pico8.colors[10]))
      ),
      game_width - score_size, game_height - 4, Z.UI, ui.font_height,
      font.ALIGN.HCENTER|font.ALIGN.VBOTTOM, score_size, 0, `${state.hit_rocks} hits`);

    // Reset camera for particles
    camera2d.setAspectFixed(game_width, game_height);
    camera2d.set(camera2d.x0() + cam_x, camera2d.y0(), camera2d.x1() + cam_x, camera2d.y1());
  }

  let level_idx = 0;
  function playInit(dt) {
    engine.setState(play);
    setupLevel(level_idx);
    play(dt);
  }

  let title_style = glov_font.style(null, {
    color: pico8.font_colors[7],
    outline_width: 2,
    outline_color: pico8.font_colors[1],
    glow_xoffs: 2,
    glow_yoffs: 2,
    glow_inner: -2.5,
    glow_outer: 5,
    glow_color: pico8.font_colors[2],
  });
  let subtitle_style = null;
  let subtitle_style2 = glov_font.style(subtitle_style, {
    color: pico8.font_colors[5],
  });

  function pad2(v) {
    return (`0${v}`).slice(-2);
  }
  function formatTime(t) {
    let hs = t % 100;
    t = (t - hs) / 100;
    let s = t % 60;
    t = (t - s) / 60;
    let m = t;
    return `${m}:${pad2(s)}.${pad2(hs)}`;
  }

  let scores_edit_box;
  function showHighScores(y, eff_level_idx) {
    let width = game_width * 0.75;
    let x = (game_width - width) / 2;
    // let y0 = y;
    let z = Z.MODAL + 10;
    let size = 8;
    let pad = size;
    font.drawSizedAligned(null, x, y, z, size * 2, glov_font.ALIGN.HCENTERFIT, width, 0, 'HIGH SCORES');
    y += size * 2 + 2;
    let level_id = levels[eff_level_idx].name;
    let scores = score_system.high_scores[level_id];
    let score_style = glov_font.styleColored(null, pico8.font_colors[7]);
    if (!scores) {
      font.drawSizedAligned(score_style, x, y, z, size, glov_font.ALIGN.HCENTERFIT, width, 0,
        'Loading...');
      return;
    }
    let widths = [10, 60, 24, 24, 24];
    let widths_total = 0;
    for (let ii = 0; ii < widths.length; ++ii) {
      widths_total += widths[ii];
    }
    let set_pad = size / 2;
    for (let ii = 0; ii < widths.length; ++ii) {
      widths[ii] *= (width - set_pad * (widths.length - 1)) / widths_total;
    }
    let align = [
      glov_font.ALIGN.HFIT | glov_font.ALIGN.HRIGHT,
      glov_font.ALIGN.HFIT,
      glov_font.ALIGN.HFIT | glov_font.ALIGN.HCENTER,
      glov_font.ALIGN.HFIT | glov_font.ALIGN.HCENTER,
      glov_font.ALIGN.HFIT | glov_font.ALIGN.HCENTER,
    ];
    function drawSet(arr, style, header) {
      let xx = x;
      for (let ii = 0; ii < arr.length; ++ii) {
        let str = String(arr[ii]);
        font.drawSizedAligned(style, xx, y, z, size, align[ii], widths[ii], 0, str);
        xx += widths[ii] + set_pad;
      }
      y += size;
    }
    drawSet(['', 'Name', 'Rings', 'Hits', 'Time'], glov_font.styleColored(null, pico8.font_colors[6]), true);
    y += 4;
    let found_me = false;
    for (let ii = 0; ii < scores.length; ++ii) {
      let s = scores[ii];
      let style = score_style;
      let drawme = false;
      if (s.name === score_system.player_name) {
        style = glov_font.styleColored(null, pico8.font_colors[11]);
        found_me = true;
        drawme = true;
      }
      if (ii < 15 || drawme) {
        drawSet([
          `#${ii+1}`, score_system.formatName(s), `${s.score.rings}/${levels[eff_level_idx].num_rings}`,
          s.score.hits, formatTime(s.score.time)
        ], style);
      }
    }
    y += set_pad;
    if (found_me && score_system.player_name.indexOf('Anonymous') === 0) {
      if (!scores_edit_box) {
        scores_edit_box = ui.createEditBox({
          z,
          w: game_width / 4,
        });
        scores_edit_box.setText(score_system.player_name);
      }

      if (scores_edit_box.run({
        x,
        y,
      }) === scores_edit_box.SUBMIT || ui.buttonText({
        x: x + scores_edit_box.w + size,
        y: y - size * 0.25,
        z,
        w: size * 13,
        h: ui.button_height,
        text: 'Update Player Name'
      })) {
        // scores_edit_box.text
        if (scores_edit_box.text) {
          score_system.updatePlayerName(scores_edit_box.text);
        }
      }
      y += size;
    }

    y += pad;

    // ui.panel({
    //   x: x - pad,
    //   w: game_width / 2 + pad * 2,
    //   y: y0 - pad,
    //   h: y - y0 + pad * 2,
    //   z: z - 1,
    //   color: vec4(0, 0, 0, 1),
    // });

    // ui.menuUp();
  }

  function hasCompleted(idx) {
    // if (levels[idx].saved && levels[idx].saved.ever_complete) {
    //   return true;
    // }
    let score = score_system.getScore(idx);
    if (score && score.rings === levels[idx].num_rings) {
      return true;
    }
    return false;
  }

  let colors_green = ui.makeColorSet([0,1,0,1]);

  function levelSelect(dt) {
    let y = 4;
    let header_h = 26;
    font2.drawSizedAligned(title_style,
      0, y, Z.UI, header_h, font.ALIGN.HCENTER, 320, 0,
      `${level_idx+1}/${levels.length} ${levels[level_idx].display_name || levels[level_idx].name}`);

    let eff_level_idx = level_idx;
    let completed = hasCompleted(level_idx);
    let has_next = completed && level_idx !== levels.length - 1;

    if (ui.buttonText({
      x: 8,
      y,
      h: header_h,
      w: header_h,
      text: '<<',
      disabled: !level_idx,
    }) || level_idx && input.keyDownEdge(KEYS.A)) {
      transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, true));
      --level_idx;
    }
    if (ui.buttonText({
      x: 320 - header_h - 8,
      y,
      h: header_h,
      w: header_h,
      text: '>>',
      disabled: level_idx === levels.length - 1,
    }) || level_idx !== levels.length - 1 && input.keyDownEdge(KEYS.D)) {
      transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, true));
      ++level_idx;
    }

    y += header_h + 4;

    let button_w = ui.button_width * 1.5;
    if (ui.buttonText({
      key: has_next ? 'replay' : 'play_button',
      x: (has_next ? 320/4 : 320/2) - button_w/2,
      y,
      w: button_w,
      h: ui.button_height * 2,
      font_height: ui.font_height * 2,
      text: completed ? 'Retry' : 'Play',
    })) {
      transition.queue(Z.TRANSITION_FINAL, transition.pixelate(500));
      engine.setState(playInit);
    }

    if (has_next) {
      if (ui.buttonText({
        key: 'play_button',
        x: 320*3/4 - button_w/2,
        y,
        w: button_w,
        h: ui.button_height * 2,
        font_height: ui.font_height * 2,
        text: 'Next Level',
        colors: colors_green,
      })) {
        ++level_idx;
        if (!hasCompleted(level_idx)) {
          transition.queue(Z.TRANSITION_FINAL, transition.pixelate(500));
          engine.setState(playInit);
        } else {
          transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, true));
        }
      }
    }

    y += ui.button_height * 2 + 4;

    showHighScores(y, eff_level_idx);

    farBgStars(0.5);
  }

  function levelSelectInit(dt) {
    killFX();
    engine.setState(levelSelect);
    score_system.updateHighScores();
    ui.focusSteal('play_button');
    levelSelect(dt);
  }

  let title_state;
  let title_seq;
  function title(dt) {
    title_seq.update(dt);
    font2.drawSizedAligned(glov_font.styleAlpha(title_style, title_state.fade3),
      0, 0, Z.UI, 32, font.ALIGN.HVCENTER, 320, 120,
      'Dante Slumbers');

    let y = 82;
    font.drawSizedAligned(glov_font.styleAlpha(subtitle_style2, title_state.fade4),
      0, y, Z.UI, ui.font_height, font.ALIGN.HCENTER, 320, 0,
      'by Jimb Esser in 48 hours for Ludum Dare 47');

    y = 120;
    font.drawSizedAligned(glov_font.styleAlpha(subtitle_style, title_state.fade1),
      0, y, Z.UI, ui.font_height, font.ALIGN.HCENTER, 320, 0,
      'Your cat, "Dante", has fallen asleep on the yoke.');
    y += ui.font_height + 8;
    font.drawSizedAligned(glov_font.styleAlpha(subtitle_style, title_state.fade2),
      0, y, Z.UI, ui.font_height, font.ALIGN.HCENTER, 320, 0,
      'You do not wish to wake him, so you are going');
    y += ui.font_height + 2;
    font.drawSizedAligned(glov_font.styleAlpha(subtitle_style, title_state.fade2),
      0, y, Z.UI, ui.font_height, font.ALIGN.HCENTER, 320, 0,
      'to get through this with just the throttle.');
    y += ui.font_height + 2;

    y += 16;

    if (title_state.fade3) {
      if (ui.buttonText({
        x: 320/2 - ui.button_width/2,
        y,
        text: 'Play'
      })) {
        transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, false));
        engine.setState(levelSelectInit);
      }
    }
    y += ui.button_height + 16;

    farBgStars();
  }

  let first_time = true;
  function titleInit(dt) {
    killFX();
    title_state = {
      fade1: 0,
      fade2: 0,
      fade3: 0,
      fade4: 0,
    };
    title_seq = animation.create();
    let t = title_seq.add(0, 300, (v) => (title_state.fade1 = v));
    t = title_seq.add(t, 800, nop);
    t = title_seq.add(t, 300, (v) => (title_state.fade2 = v));
    t = title_seq.add(t, 1500, nop);
    t = title_seq.add(t, 300, (v) => (title_state.fade3 = v));
    t = title_seq.add(t, 1500, nop);
    title_seq.add(t, 300, (v) => (title_state.fade4 = v));
    if (!first_time || engine.DEBUG) {
      title_seq.update(30000);
    }
    first_time = false;

    engine.setState(title);
    title(dt);
  }

  if (engine.DEBUG) {
    level_idx = 0;
    engine.setState(titleInit);
  } else {
    engine.setState(titleInit);
  }
}
