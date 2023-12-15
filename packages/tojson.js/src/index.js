export * from "psd-json.js";

export * from "sketchtojson";

import Psd from "psd-json.js";

import Sketch from "sketchtojson";

import getFileTypes from "./getFileType";

const mapStrategyType = {
  psd: () => {
    return new Psd();
  },
  sketch: () => {
    return new Sketch();
  },
};

export const getFileType = getFileTypes;

export const types = Object.keys(mapStrategyType);

export default async (files) => {
  const file = await getFileTypes(files);
  if (file) {
    const { ext } = file;
    if (mapStrategyType[ext]) {
      const handler = mapStrategyType[ext]();
      const data = await handler.init(files);
      return data;
    } else {
      console.warn("暂不支持该类型");
    }
  }
};
