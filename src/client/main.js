/*eslint global-require:off*/
const glov_local_storage = require('./glov/local_storage.js');
glov_local_storage.storage_prefix = 'ld47'; // Before requiring anything else that might load from this

const camera2d = require('./glov/camera2d.js');
const engine = require('./glov/engine.js');
// const glov_font = require('./glov/font.js');
const input = require('./glov/input.js');
const { cos, floor, max, min, sin, tan, PI } = Math;
const net = require('./glov/net.js');
const pico8 = require('./glov/pico8.js');
const { randCreate } = require('./glov/rand_alea.js');
const glov_sprites = require('./glov/sprites.js');
// const sprite_animation = require('./glov/sprite_animation.js');
// const transition = require('./glov/transition.js');
const ui = require('./glov/ui.js');
const { clamp } = require('../common/util.js');
// const { soundLoad, soundPlay, soundPlayMusic, FADE_IN, FADE_OUT } = require('./glov/sound.js');
const {
  vec2,
  v2add,
  v2distSq,
  v2scale,
  v2sub,
  vec4,
} = require('./glov/vmath.js');

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.AIR = 10;
Z.PLAYER = 20;
Z.ROCKS = 30;
Z.RINGS = 32;
Z.PARTICLES = 20;
Z.UI_TEST = 200;

// let app = exports;
// Virtual viewport for our game logic
const game_width = 320;
const game_height = 240;
const render_width = game_width;
const render_height = game_height;

const rock_fade_time = 1000;

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
    if (pixely === 'strict') {
      font = { info: font_info_04b03x1, texture: 'font/04b03_8x1' };
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
      viewport_postprocess: false,
    })) {
      return true;
    }
    return false;
  }
  if (startup()) {
    return;
  }

  //let { font } = ui;

  // const font = engine.font;

  // Perfect sizes for pixely modes
  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);

  const createSprite = glov_sprites.create;
  // const createAnimation = sprite_animation.create;

  const KEYS = input.KEYS;
  //const PAD = input.PAD;

  function initGraphics() {
    sprites.rock = createSprite({
      name: 'rock',
      size: vec2(16, 16),
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
  }
  initGraphics();

  const base_radius = 50;
  let state = {
    level_w: 160 * 10,
    cam_x: -game_width / 2 + 160,
    player: {
      pos: vec2(160, game_height / 2 + base_radius),
      angle: PI,
      radius: 1,
    },
    stuff: [],
  };
  let rand = randCreate(1);
  let rdense = 16;
  for (let ii = 0; ii < 100; ++ii) {
    let x = ii * rdense + rand.random() * rdense;
    let y = rand.floatBetween(16, game_height - 16*2);
    if (x < 320) {
      y = y < game_height / 2 ? y * 0.1 : game_height - (game_height - y) * 0.1;
    }
    state.stuff.push({
      sprite: sprites.rock,
      type: 'rock',
      pos: vec2(x, y),
      angle: rand.floatBetween(0, PI * 2),
      rspeed: rand.floatBetween(-1, 1),
      color: vec4(0.1, 0.1, 0.1, 1),
      freq: 0, // 0.001 * rand.random(),
      amp: 40,
      rsquared: 8*8,
      z: Z.ROCKS,
    });
  }
  for (let ii = 0; ii < 9; ++ii) {
    state.stuff.push({
      sprite: sprites.ring,
      type: 'ring',
      pos: vec2(160 + ii * 160 + rand.random() * 160, rand.floatBetween(32, game_height - 32*2)),
      angle: 0,
      rspeed: 0,
      frame: rand.floatBetween(0, 10),
      color: vec4(1,1,1, 1),
      rsquared: 12*12,
      freq: 0.001,
      amp: 32,
      z: Z.RINGS,
    });
  }
  for (let ii = 0; ii < 0; ++ii) {
    state.stuff.push({
      sprite: sprites.air,
      type: 'air',
      pos: vec2(ii * 120 + rand.random() * 120, rand.floatBetween(16, game_height - 16)),
      size: vec2(32, rand.floatBetween(32, 64)),
      angle: 0,
      rspeed: 0,
      color: pico8.colors[12],
      rsquared: 12*12,
      freq: 0,
      amp: 32,
      z: Z.AIR,
    });
  }
  for (let ii = 0; ii < state.stuff.length; ++ii) {
    state.stuff[ii].pos0 = state.stuff[ii].pos.slice(0);
  }


  const speed_scale = 0.75;
  const dTheta = 0.002 * speed_scale;
  const accel = 0.0025;
  const air_drag = 0.5;
  const min_radius = 0.5 * base_radius;
  let delta = vec2();
  function test(dt) {
    sprites.game_bg.draw({
      x: 0, y: 0, z: Z.BACKGROUND,
      color: pico8.colors[1],
    });
    camera2d.setAspectFixed(game_width, game_height);

    let { player, stuff } = state;
    if (player.pos[0] > state.level_w) {
      player.pos[0] -= state.level_w;
      state.cam_x -= state.level_w;
    } else if (player.pos[0] < 0) {
      player.pos[0] += state.level_w;
      state.cam_x += state.level_w;
    }

    let cam_x = floor(state.cam_x);
    camera2d.set(camera2d.x0() + cam_x, camera2d.y0(), camera2d.x1() + cam_x, camera2d.y1());

    // update stuff
    let hit_air = false;
    for (let ii = 0; ii < stuff.length; ++ii) {
      let r = stuff[ii];
      r.angle += r.rspeed * dt * 0.0002;
      r.pos[1] = r.pos0[1] + r.amp * sin(r.freq * engine.frame_timestamp);
      if (r.type === 'air') {
        r.hit = player.pos[0] > r.pos[0] - r.size[0]/2 && player.pos[0] < r.pos[0] + r.size[0]/2 &&
          player.pos[1] > r.pos[1] - r.size[1]/2 && player.pos[1] < r.pos[1] + r.size[1]/2;
        if (r.hit) {
          hit_air = true;
        }
      }
    }

    // update player
    let { radius } = player;
    if (input.keyDown(KEYS.D)) {
      player.radius = min(2, radius + dt * accel);
    } else if (input.keyDown(KEYS.A)) {
      player.radius = max(0.5, radius - dt * accel);
    } else if (radius > 1) {
      player.radius = max(1, radius - dt * accel * 2);
    } else if (radius < 1) {
      player.radius = min(1, radius + dt * accel * 2);
    }
    // Instead of doing this, just reduce thrust if we'd go outside?
    // let last_pos = state.pos.slice(0);
    // let test_pos = state.pos.slice(0);
    // let test_dt = 100;
    // let test_dp = test_dt * base_speed;
    // let test_angle = state.angle - test_dt * 0.5 * dTheta;
    // let offs = 0;
    // let oob = false;
    // for (let ii = 0; ii < 30; ++ii) {
    //   test_pos[0] += state.speed * test_dp * cos(test_angle);
    //   test_pos[1] += state.speed * test_dp * sin(test_angle);
    //   test_angle -= test_dt * dTheta;
    //   // ui.drawLine(last_pos[0], last_pos[1], test_pos[0], test_pos[1], Z.PLAYER - 1, 2, 1, [0,0,0,0.5]);
    //   v2copy(last_pos, test_pos);
    //   if (test_pos[1] < 0) {
    //     offs = max(offs, -test_pos[1]);
    //     oob = true;
    //   } else if (test_pos[1] > game_height) {
    //     offs = min(offs, game_height - test_pos[1]);
    //   }
    // }
    // if (oob) {
    //   state.speed = max(0.5, speed - dt * 0.005);
    // }
    radius = player.radius * base_radius;
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
    new_pos[1] = clamp(new_pos[1], 0, game_height);
    player.pos[0] = new_pos[0];
    player.pos[1] = new_pos[1];
    state.cam_x = min(max(state.cam_x, player.pos[0] - game_width * 2 / 3), player.pos[0] - game_width / 3);
    player.angle = new_angle;
    sprites.player.draw({
      x: player.pos[0],
      y: player.pos[1],
      z: Z.PLAYER,
      rot: player.angle + PI,
      color: [1, 1, 1, 1],
    });
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
        hit = v2distSq(r.pos, player.pos) < r.rsquared;
        if (hit) {
          if (!r.hit) {
            r.hit = true;
            r.hit_fade = rock_fade_time;
            if (r.type === 'rock') {
              state.player.radius = 0.5;
              state.player.angle += rand.floatBetween(0.5, 0.75);
            }
          }
          if (r.type === 'rock') {
            r.color[0] = 1;
          } else {
            r.color[0] = 0;
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
        }
      }
      let x = r.pos[0];
      if (x > view_x1) {
        x -= state.level_w;
      } else if (x < view_x0) {
        x += state.level_w;
      }
      if (x >= view_x0 && x <= view_x1) {
        r.sprite.draw({
          x,
          y: r.pos[1],
          z: r.z,
          w, h,
          rot: r.angle,
          color: r.color,
          frame,
        });
      }
    }

    ui.print(null, 50 + (cam_x > 500 ? state.level_w : 0), game_height - 33, Z.PLAYER - 1, 'Controls: A and D');
  }

  function testInit(dt) {
    engine.setState(test);
    test(dt);
  }

  engine.setState(testInit);
}
