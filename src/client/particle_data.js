export let defs = {};

const { clone } = require('../common/util.js');

function override(def, mod) {
  if (typeof def === 'object' && !Array.isArray(def) && typeof mod === 'object') {
    let ret = {};
    for (let key in def) {
      if (mod[key] !== undefined) {
        ret[key] = override(def[key], mod[key]);
      } else {
        ret[key] = clone(def[key]);
      }
    }
    return ret;
  }
  return mod || (def === Infinity ? def : clone(def));
}

defs.smoke = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'particles/circle64',
      color: [1,1,1,1], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,0.25,0.25,0] },
        { t: 0.05, v: [1,0.5,0,1] },
        { t: 0.1, v: [1,1,0.5,1] },
        { t: 0.3, v: [1,1,1,0.5] },
        { t: 1.0, v: [1,1,1,0] },
      ],
      size: [[12,4], [12,4]], // multiplied by animation track
      accel: [0,0,0],
      lifespan: [2500,0], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-1,2], [-1,2], 0],
      vel: [0,0,0],
      emit_rate: [0,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0,1000],
      emit_initial: 1,
      max_parts: Infinity,
    },
  },
  system_lifespan: 2500,
};

defs.smoke1 = override(clone(defs.smoke), {
  particles: {
    part0: {
      color_track: [
        { t: 0.0, v: [0.5,0,0,0] },
        { t: 0.025, v: [1,0,0,1] },
        { t: 0.2, v: [1,1,0.5,1] },
        { t: 0.3, v: [1,1,1,0.5] },
        { t: 1.0, v: [1,1,1,0] },
      ],
    },
  },
});

defs.smoke2 = override(clone(defs.smoke), {
  particles: {
    part0: {
      color_track: [
        { t: 0.0, v: [0.5,0,0,0] },
        { t: 0.05, v: [0.5,0.25,0.25,1] },
        { t: 0.2, v: [0.5,0.5,0.45,1] },
        { t: 0.3, v: [1,1,1,0.5] },
        { t: 1.0, v: [1,1,1,0] },
      ],
    },
  },
});

defs.crash = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'crash',
      color: [1,1,1,1], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1,1,0] },
        { t: 0.05, v: [1,1,1,1] },
        { t: 0.1, v: [1,1,1,1] },
        { t: 0.3, v: [1,1,1,1] },
        { t: 1.0, v: [1,1,1,0] },
      ],
      size: [[12,4], [12,4]], // multiplied by animation track
      size_track: [
        // just values, NOT random range
        { t: 0.0, v: [0.5,0.5] },
        { t: 0.3, v: [2,2] },
        { t: 1.0, v: [3,3] },
      ],
      accel: [0,0,0],
      rot: [0,360], // degrees
      rot_vel: [10,2], // degrees per second
      lifespan: [500,0], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-1,2], [-1,2], 0],
      vel: [0,0,0],
      emit_rate: [0,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0,1000],
      emit_initial: 1,
      max_parts: Infinity,
    },
  },
  system_lifespan: 2500,
};

defs.pickup = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'ring',
      color: [1,1,1,1], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1,1,0] },
        { t: 0.05, v: [1,1,1,1] },
        { t: 0.3, v: [1,1,1,1] },
        { t: 1.0, v: [1,1,1,0] },
      ],
      size: [[12,4], [12,4]], // multiplied by animation track
      size_track: [
        // just values, NOT random range
        { t: 0.0, v: [0.5,0.5] },
        { t: 0.3, v: [1,1] },
        { t: 1.0, v: [1,1] },
      ],
      accel: [0,1000,0],
      rot: [0,360], // degrees
      rot_vel: [10,2], // degrees per second
      lifespan: [700,0], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-1,2], [-1,2], 0],
      vel: [[-100,200],[-300,200],0],
      emit_rate: [200,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0,100],
      emit_initial: 5,
      max_parts: Infinity,
    },
  },
  system_lifespan: 2500,
};

defs.air = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'particles/circle64',
      color: [0.75,0.75,0.95,0.5], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1,1,0] },
        { t: 0.2, v: [1,1,1,1] },
        { t: 0.8, v: [0.7,0.7,0.7,1] },
        { t: 1.0, v: [1,1,1,0] },
      ],
      size: [[16,4], [16,4]], // multiplied by animation track
      accel: [0,0,0],
      lifespan: [5000,5000], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-16+4,32-8], [-16+4,32-8], 0],
      vel: [0,0,0],
      emit_rate: [5,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0,Infinity],
      emit_initial: 10,
      max_parts: Infinity,
    },
  },
  system_lifespan: Infinity,
};

defs.air_tall = override(clone(defs.air), {
  emitters: {
    part0: {
      pos: [[-16+4,32-8], [-32+4,64-8], 0],
      emit_rate: [defs.air.emitters.part0.emit_rate[0] * 2,0], // emissions per second
      emit_time: [0,Infinity],
      emit_initial: defs.air.emitters.part0.emit_initial * 2,
    },
  },
});
