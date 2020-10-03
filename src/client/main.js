/*eslint global-require:off*/
const glov_local_storage = require('./glov/local_storage.js');
glov_local_storage.storage_prefix = 'ld47'; // Before requiring anything else that might load from this

const camera2d = require('./glov/camera2d.js');
const engine = require('./glov/engine.js');
// const glov_font = require('./glov/font.js');
const input = require('./glov/input.js');
const { cos, max, min, sin, tan, PI } = Math;
const net = require('./glov/net.js');
const pico8 = require('./glov/pico8.js');
const { randCreate } = require('./glov/rand_alea.js');
const glov_sprites = require('./glov/sprites.js');
// const sprite_animation = require('./glov/sprite_animation.js');
// const transition = require('./glov/transition.js');
const ui = require('./glov/ui.js');
// const { soundLoad, soundPlay, soundPlayMusic, FADE_IN, FADE_OUT } = require('./glov/sound.js');
const { vec2, vec4, v2copy, v2distSq } = require('./glov/vmath.js');

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.PARTICLES = 20;
Z.UI_TEST = 200;

// let app = exports;
// Virtual viewport for our game logic
export const game_width = 320;
export const game_height = 240;

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
      game_width,
      game_height,
      pixely,
      font,
      viewport_postprocess: false,
    })) {
      return true;
    }
  }
  if (startup()) {
    return;
  }

  let { font } = ui;

  // const font = engine.font;

  // Perfect sizes for pixely modes
  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);

  const createSprite = glov_sprites.create;

  // Cache KEYS
  const KEYS = input.KEYS;
  const PAD = input.PAD;

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
    sprites.game_bg = createSprite({
      url: 'white',
      size: vec2(game_width, game_height),
    });
  }

  let state = {
    cam_x: 0,
    player: {
      pos: vec2(150, 200),
      angle: PI,
      radius: 1,
    },
    rocks: [],
  };
  let rand = randCreate(1);
  for (let ii = 0; ii < 100; ++ii) {
    state.rocks.push({
      pos: vec2(ii * 16 + rand.random() * 16, rand.floatBetween(16, game_height - 16)),
      angle: rand.floatBetween(0, PI * 2),
      rspeed: rand.floatBetween(-1, 1),
      color: vec4(0.1, 0.1, 0.1, 1),
    });
  }


  const base_radius = 50;
  const speed_scale = 0.75;
  const dTheta = 0.002 * speed_scale;
  const accel = 0.0025;
  function test(dt) {
    sprites.game_bg.draw({
      x: 0, y: 0, z: Z.BACKGROUND,
      color: pico8.colors[1],
    });
    camera2d.setAspectFixed(game_width, game_height);
    camera2d.set(camera2d.x0() + state.cam_x, camera2d.y0(), camera2d.x1() + state.cam_x, camera2d.y1());
    let { player } = state;
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
    //   // ui.drawLine(last_pos[0], last_pos[1], test_pos[0], test_pos[1], Z.SPRITES - 1, 2, 1, [0,0,0,0.5]);
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
    //ui.drawHollowCircle(maxs_center[0], maxs_center[1], Z.SPRITES - 1, max_r, 0.99, [1,1,1, 0.5]);

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
    // ui.drawHollowCircle(maxs_center[0], maxs_center[1], Z.SPRITES - 1, max_r2, 0.99, [1,1,1, 0.5]);

    // ui.print(null, 50, 50, Z.SPRITES + 10, `angle: ${(angle * 180 / PI).toFixed(0)}`);
    if (isFinite(max_r)) {
      radius = min(radius, min(max_r, max_r2));
    }
    // let dir = vec2(cos(angle), sin(angle));
    let new_angle = angle - dt * dTheta;
    if (new_angle < 0) {
      new_angle += PI * 2;
    }
    let center = vec2(player.pos[0] + radius * cos(angle + PI/2), player.pos[1] + radius * sin(angle + PI/2));
    let new_pos = vec2(center[0] - radius * cos(new_angle + PI/2), center[1] - radius * sin(new_angle + PI/2));
    player.pos[0] = new_pos[0];
    player.pos[1] = new_pos[1];
    state.cam_x = min(max(state.cam_x, player.pos[0] - game_width * 2 / 3), player.pos[0] - game_width / 3);
    player.angle = new_angle;
    sprites.player.draw({
      x: player.pos[0],
      y: player.pos[1],
      z: Z.SPRITES,
      rot: player.angle + PI,
      color: [1, 1, 1, 1],
    });
    for (let ii = 0; ii < state.rocks.length; ++ii) {
      let r = state.rocks[ii];
      r.angle += r.rspeed * dt * 0.0002;
      let hit = v2distSq(r.pos, player.pos) < 8*8;
      if (hit) {
        if (!r.hit) {
          r.hit = true;
          state.player.radius = 0.5;
          state.player.angle += rand.floatBetween(0.5, 0.75);
        }
        r.color[0] = 1;
        r.color[3] = 1;
      }
      sprites.rock.draw({
        x: r.pos[0],
        y: r.pos[1],
        z: Z.SPRITES,
        rot: r.angle,
        color: r.color,
      });
      if (hit) {
        r.color[3] = 0.5;
      }
    }

    ui.print(null, 50, game_height - 24, Z.SPRITES - 1, 'Controls: A and D');
  }

  function testInit(dt) {
    engine.setState(test);
    test(dt);
  }

  initGraphics();
  engine.setState(testInit);
}
