export * as psdtojson from "psd-json.js";

export * as sketchtojson from "sketchtojson";

import Psd from "psd-json.js";

import Sketch from "sketchtojson";

import getFileTypes from "./getFileType";

const mapStrategyType = {
  psd: (options) => {
    return new Psd(options);
  },
  sketch: (options) => {
    return new Sketch(options);
  },
};

export const getFileType = getFileTypes;

export const types = Object.keys(mapStrategyType);

export default async (files, options) => {
  const file = await getFileTypes(files);
  if (file) {
    const { ext } = file;
    if (mapStrategyType[ext]) {
      const handler = mapStrategyType[ext](options);
      const data = await handler.init(files);
      return data;
    } else {
      console.warn("暂不支持该类型");
    }
  }
};