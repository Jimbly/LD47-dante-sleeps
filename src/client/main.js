/*eslint global-require:off*/
const glov_local_storage = require('./glov/local_storage.js');
glov_local_storage.storage_prefix = 'ld47'; // Before requiring anything else that might load from this

const camera2d = require('./glov/camera2d.js');
const engine = require('./glov/engine.js');
// const glov_font = require('./glov/font.js');
const input = require('./glov/input.js');
const { cos, max, min, sin, PI } = Math;
const net = require('./glov/net.js');
const { randCreate } = require('./glov/rand_alea.js');
const glov_sprites = require('./glov/sprites.js');
// const sprite_animation = require('./glov/sprite_animation.js');
// const transition = require('./glov/transition.js');
const ui = require('./glov/ui.js');
// const { soundLoad, soundPlay, soundPlayMusic, FADE_IN, FADE_OUT } = require('./glov/sound.js');
const { vec2, vec4 } = require('./glov/vmath.js');

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
    return;
  }

  // const font = engine.font;

  // Perfect sizes for pixely modes
  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);

  const createSprite = glov_sprites.create;

  // Cache KEYS
  const KEYS = input.KEYS;
  const PAD = input.PAD;

  function initGraphics() {
    sprites.test = createSprite({
      name: 'test',
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
    pos: vec2(150, 200),
    angle: 0,
    speed: 1,
    rocks: [],
  };
  let rand = randCreate(1);
  for (let ii = 0; ii < 100; ++ii) {
    state.rocks.push({
      pos: vec2(ii * 16 + rand.random() * 16, rand.floatBetween(16, game_height - 16)),
      angle: rand.floatBetween(0, PI * 2),
    });
  }

  function test(dt) {
    sprites.game_bg.draw({
      x: 0, y: 0, z: Z.BACKGROUND,
      color: [0, 0.72, 1, 1]
    });
    camera2d.set(state.cam_x, 0, state.cam_x + game_width, game_height);
    if (input.keyDown(KEYS.SPACE)) {
      state.speed = min(2, state.speed + dt * 0.005);
    } else {
      state.speed = max(1, state.speed - dt * 0.01);
    }
    let dp = state.speed * dt * 0.1;
    state.pos[0] += dp * cos(state.angle);
    state.pos[1] += dp * sin(state.angle);
    state.cam_x = min(max(state.cam_x, state.pos[0] - game_width * 2 / 3), state.pos[0] - game_width / 3);
    state.angle -= dt * 0.002;
    sprites.test.draw({
      x: state.pos[0],
      y: state.pos[1],
      z: Z.SPRITES,
      rot: state.angle + PI/2 + 0.3,
      color: [1, 1, 1, 1],
    });
    for (let ii = 0; ii < state.rocks.length; ++ii) {
      let r = state.rocks[ii];
      sprites.test.draw({
        x: r.pos[0],
        y: r.pos[1],
        z: Z.SPRITES,
        rot: r.angle,
        color: [0.1, 0.1, 0.1, 1],
      });
    }
  }

  function testInit(dt) {
    engine.setState(test);
    test(dt);
  }

  initGraphics();
  engine.setState(testInit);
}
