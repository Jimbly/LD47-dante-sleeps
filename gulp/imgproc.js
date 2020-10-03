/* eslint no-invalid-this:off, no-underscore-dangle:off, max-len:off */
const assert = require('assert');
const log = require('fancy-log');
const fs = require('fs');
const { floor } = Math;
const path = require('path');
const { PNG } = require('pngjs');
const resize = require('./resize.js');
const { Bitmap } = require('imagejs');
const through = require('through2');
const Vinyl = require('vinyl');

let w = 16;
let h = 16;
let colorType = 6;

module.exports = function () {
  return through.obj(function (file, encoding, callback) {
    let basename = path.basename(file.path);
    log(`imgproc(${basename})`);
    assert(file.isBuffer());

    fs.readFile(`${file.path}.opt`, 'utf8', (err, data) => {
      let opts = {};
      if (!err && data) {
        opts = JSON.parse(data);
      }
      let pngin = new PNG();
      pngin.parse(file.contents, (err) => {
        if (err) {
          return void callback(err);
        }
        let ret;
        let { tile } = opts;
        if (tile) {
          let num_tx = floor(pngin.width / tile);
          let num_ty = floor(pngin.height / tile);
          ret = new PNG({ width: num_tx * w, height: num_ty * h, colorType });
          // resize tile by tile
          for (let ty=0; ty < num_ty; ++ty) {
            for (let tx=0; tx < num_tx; ++tx) {
              let imgdata = Buffer.alloc(tile*tile*4);
              for (let jj = 0; jj < tile; ++jj) {
                for (let ii = 0; ii < tile; ++ii) {
                  for (let kk = 0; kk < 4; ++kk) {
                    imgdata[(jj * tile + ii) * 4 + kk] = pngin.data[((ty * tile + jj) * pngin.width + tx * tile + ii) * 4 + kk];
                  }
                }
              }
              let dest = { width: w, height: h, data: Buffer.alloc(w * h * 4) };
              resize.bicubicInterpolation({ data: imgdata, width: tile, height: tile }, dest);
              for (let jj = 0; jj < h; ++jj) {
                for (let ii = 0; ii < w; ++ii) {
                  for (let kk = 0; kk < 4; ++kk) {
                    ret.data[((ty * h + jj) * ret.width + tx * w + ii) * 4 + kk] = dest.data[(jj * w + ii) * 4 + kk];
                  }
                }
              }
            }
          }
        } else {
          // resize all at once
          let bitmap = new Bitmap();
          bitmap._data = {
            data: pngin.data,
            width: pngin.width,
            height: pngin.height,
          };
          bitmap = bitmap.resize({ width: w, height: h, algorithm: 'bicubicInterpolation' });
          ret = new PNG({ width: w, height: h, colorType });
          ret.data = bitmap._data.data;
        }
        let buffer = PNG.sync.write(ret);
        this.push(new Vinyl({
          path: basename,
          contents: buffer,
        }));
        callback();
      });
    });
  });
};
