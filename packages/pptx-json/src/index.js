import JSZip from "jszip";
import { readXmlFile } from "./readXmlFile";
import { getBorder } from "./border";
import { getSlideBackgroundFill, getShapeFill, getSolidFill } from "./fill";
import { getChartInfo } from "./chart";
import { getVerticalAlign } from "./align";
import { getPosition, getSize } from "./position";
import { genTextBody } from "./text";
import { getCustomShapePath } from "./shape";
import { extractFileExtension, base64ArrayBuffer, getTextByPathList, angleToDegrees, getMimeType, isVideoLink, escapeHtml } from "./utils";
import { getShadow } from "./shadow";

let SLIDE_FACTOR = 96 / 914400;
let FONTSIZE_FACTOR = 100 / 75;
let processFullTheme = true;
const defaultOptions = {
  slideFactor: SLIDE_FACTOR,
  fontsizeFactor: FONTSIZE_FACTOR,
};
let uploadCallback = () => {};
let uploadUrl = "";

class PPT {
  constructor(options = {}) {
    if (options.uploadUrl && options.uploadCallback) {
      this.options = options || {};
    }
  }
  async init(file) {
    if (!file) {
      console.error("请上传文件!!!!");
      return;
    }
    return await parse(file, this.options);
  }
}

export default PPT;

async function parse(file, options = {}) {
  options = { ...defaultOptions, ...options };

  if (options.slideFactor) SLIDE_FACTOR = options.slideFactor;
  if (options.fontsizeFactor) FONTSIZE_FACTOR = options.fontsizeFactor;
  if (options.uploadCallback) {
    uploadCallback = options.uploadCallback;
  }
  if (options.uploadUrl) {
    uploadUrl = options.uploadUrl;
  }
  const slides = [];

  const zip = await JSZip.loadAsync(file);
  let bgImage = "";
  // ppt第一页缩略图
  if (zip.file("docProps/thumbnail.jpeg") !== null) {
    bgImage = "data:image/jpeg;base64," + base64ArrayBuffer(await zip.file("docProps/thumbnail.jpeg").async("arraybuffer"));
  }
  const filesInfo = await getContentTypes(zip);
  const { width, height, defaultTextStyle } = await getSlideInfo(zip);
  const themeContent = await loadTheme(zip);
  for (const filename of filesInfo.slides) {
    const singleSlide = await processSingleSlide(zip, filename, themeContent, defaultTextStyle, { width, height });
    slides.push(singleSlide);
  }
  const result = await getLayer(slides, width, height);
  const pptJson = {};
  if (result.length > 1) {
    pptJson.templates = result;
  } else if (result.length == 1) {
    pptJson.json = result[0];
  }
  if (bgImage) {
    pptJson.slImage = bgImage;
  }
  return pptJson;
}

function getPptJson(childrenList, resolve, list, item) {
  let outProArr = [];
  Array.from(childrenList).forEach((element, i) => {
    let outPro = new Promise((res) => {
      const result = {};
      result.width = element.width;
      result.height = element.height;
      result.left = element.left;
      result.top = element.top;
      result.angle = element.rotate;
      if (element.isFlipH) {
        result.flipX = element.isFlipH;
      }
      if (element.isFlipV) {
        result.flipX = element.isFlipV;
      }
      result.name = element.name;
      if (element.type == "text") {
        if (element.fontSize) {
          result.fontSize = parseInt(element.fontSize.replace("px", ""));
        }
        result.type = "FontCustom";
        result.fontFamily = element.fontType;
        result.fontWeight = element.fontBold;
        result.textAlign = element.align;
        if (element.fontSpace) {
          result.charSpacing = parseInt(element.fontSpace.replace("px", ""));
        }
        result.text = element.text || "";
        if (!element.fillColor) {
          if (item.fill && item.fill.type == "color") {
            result.fill = item.fill.value;
          }
        }
        list[i] = result;
      } else if (element.type == "shape") {
        result.type = element.type;
        result.shape = element.shapType;
        result.fill = element.fillColor;
        result.stroke = element.borderColor;
        result.strokeWidth = element.borderWidth;
        if (result.shape == "line") {
          result.height = result.strokeWidth;
        }
        list[i] = result;
      } else if (element.type == "image") {
        result.type = "Image";
        result.src = element.src;
        const blob = dataURItoBlob(result.src);
        slfileUpload(blob, element.name + ".png", element.src).then((urlRes) => {
          // 子图层图片
          result.src = urlRes;
          // 图片返回图片url
          result.type = "Image";
          list[i] = result;
          res(result);
        });
        return;
      } else if (element.type == "group") {
        var i_child = element.elements; // 子图层
        result.type = "group";
        result.objects = [];
        list[i] = result;
        return getPptJson(i_child, res, result.objects, item);
      }
      res(result);
    });
    outProArr.push(outPro);
  });
  if (resolve) {
    return Promise.all(outProArr)
      .then(resolve)
      .catch((err) => {
        console.log(err);
        resolve();
      });
  } else {
    return outProArr;
  }
}

function slfileUpload(blob, fileName, base64) {
  return new Promise((resolve) => {
    if (uploadUrl) {
      /* FormData 是表单数据类 */
      var fd = new FormData();
      var ajax = new XMLHttpRequest();
      /* 把文件添加到表单里 */
      fd.append("file", blob, fileName);
      ajax.open("post", uploadUrl, true);
      ajax.onload = () => {
        try {
          const url = uploadCallback(ajax.responseText);
          resolve(url);
        } catch (e) {
          console.error(e);
          resolve();
        }
      };
      ajax.send(fd);
    } else {
      resolve(base64);
    }
  });
}

function dataURItoBlob(dataURI) {
  var byteString;
  if (dataURI.split(",")[0].indexOf("base64") >= 0) byteString = atob(dataURI.split(",")[1]);
  else byteString = unescape(dataURI.split(",")[1]);
  var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  var ia = new Uint8Array(byteString.length);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ia], {
    type: mimeString,
  });
}

async function getLayer(workspaces, width, height) {
  const list = [];
  const resultList = [];
  workspaces.forEach((item) => {
    let result = [];
    list.push(
      Promise.all(getPptJson(item.elements, null, result, item)).then(() => {
        let workareaObj = {}; //JSON.parse(JSON.stringify(psdJson.workarea));
        workareaObj.width = width;
        workareaObj.height = height;
        workareaObj.id = "workarea";
        if (item.fill && item.fill.type == "color") {
          workareaObj.backgroundColor = item.fill.value;
        }
        result.unshift(workareaObj);
        resultList.push(result);
      })
    );
  });
  await Promise.all(list);
  return resultList;
}

async function getBackground(warpObj) {
  //var rslt = "";
  var slideLayoutContent = warpObj["slideLayoutContent"];
  var slideMasterContent = warpObj["slideMasterContent"];

  var nodesSldLayout = getTextByPathList(slideLayoutContent, ["p:sldLayout", "p:cSld", "p:spTree"]);
  var nodesSldMaster = getTextByPathList(slideMasterContent, ["p:sldMaster", "p:cSld", "p:spTree"]);
  var showMasterSp = getTextByPathList(slideLayoutContent, ["p:sldLayout", "attrs", "showMasterSp"]);
  var bgColor = await getSlideBackgroundFill(warpObj);
  const result = [];
  if (nodesSldLayout !== undefined) {
    for (var nodeKey in nodesSldLayout) {
      if (nodesSldLayout[nodeKey].constructor === Array) {
        for (var i = 0; i < nodesSldLayout[nodeKey].length; i++) {
          var ph_type = getTextByPathList(nodesSldLayout[nodeKey][i], ["p:nvSpPr", "p:nvPr", "p:ph", "attrs", "type"]);
          if (ph_type != "pic") {
            result.push(processNodesInSlide(nodeKey, nodesSldLayout[nodeKey][i], warpObj, nodesSldLayout, "slideLayoutBg")); //slideLayoutBg , slideMasterBg
          }
        }
      } else {
        if (ph_type != "pic") {
          result.push(processNodesInSlide(nodeKey, nodesSldLayout[nodeKey], warpObj, nodesSldLayout, "slideLayoutBg")); //slideLayoutBg, slideMasterBg
        }
      }
    }
  }
  // nodeKey, nodeValue, warpObj
  if (nodesSldMaster !== undefined && (showMasterSp == "1" || showMasterSp === undefined)) {
    for (let nodeKey in nodesSldMaster) {
      if (nodesSldMaster[nodeKey].constructor === Array) {
        for (let i = 0; i < nodesSldMaster[nodeKey].length; i++) {
          result.push(processNodesInSlide(nodeKey, nodesSldMaster[nodeKey][i], warpObj, nodesSldLayout, "slideMasterBg")); //slideLayoutBg , slideMasterBg
        }
      } else {
        result.push(processNodesInSlide(nodeKey, nodesSldMaster[nodeKey], warpObj, nodesSldLayout, "slideMasterBg")); //slideLayoutBg, slideMasterBg
      }
    }
  }
  let res = await Promise.all(result);
  res = res.filter((item) => {
    return item;
  });
  return {
    element: res,
    fill: bgColor,
  };
}

async function getContentTypes(zip) {
  const ContentTypesJson = await readXmlFile(zip, "[Content_Types].xml");
  const subObj = ContentTypesJson["Types"]["Override"];
  let slidesLocArray = [];
  let slideLayoutsLocArray = [];

  for (const item of subObj) {
    switch (item["attrs"]["ContentType"]) {
      case "application/vnd.openxmlformats-officedocument.presentationml.slide+xml":
        slidesLocArray.push(item["attrs"]["PartName"].substr(1));
        break;
      case "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml":
        slideLayoutsLocArray.push(item["attrs"]["PartName"].substr(1));
        break;
      default:
    }
  }

  const sortSlideXml = (p1, p2) => {
    const n1 = +/(\d+)\.xml/.exec(p1)[1];
    const n2 = +/(\d+)\.xml/.exec(p2)[1];
    return n1 - n2;
  };
  slidesLocArray = slidesLocArray.sort(sortSlideXml);
  slideLayoutsLocArray = slideLayoutsLocArray.sort(sortSlideXml);

  return {
    slides: slidesLocArray,
    slideLayouts: slideLayoutsLocArray,
  };
}

async function getSlideInfo(zip) {
  const content = await readXmlFile(zip, "ppt/presentation.xml");
  const sldSzAttrs = content["p:presentation"]["p:sldSz"]["attrs"];
  const defaultTextStyle = content["p:presentation"]["p:defaultTextStyle"];
  return {
    width: parseInt(sldSzAttrs["cx"]) * SLIDE_FACTOR,
    height: parseInt(sldSzAttrs["cy"]) * SLIDE_FACTOR,
    defaultTextStyle,
  };
}

async function loadTheme(zip) {
  const preResContent = await readXmlFile(zip, "ppt/_rels/presentation.xml.rels");
  const relationshipArray = preResContent["Relationships"]["Relationship"];
  let themeURI;

  if (relationshipArray.constructor === Array) {
    for (const relationshipItem of relationshipArray) {
      if (relationshipItem["attrs"]["Type"] === "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme") {
        themeURI = relationshipItem["attrs"]["Target"];
        break;
      }
    }
  } else if (relationshipArray["attrs"]["Type"] === "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme") {
    themeURI = relationshipArray["attrs"]["Target"];
  }
  if (!themeURI) throw Error(`Can't open theme file.`);

  return await readXmlFile(zip, "ppt/" + themeURI);
}

async function processSingleSlide(zip, sldFileName, themeContent, defaultTextStyle, slideSize) {
  const resName = sldFileName.replace("slides/slide", "slides/_rels/slide") + ".rels";
  const resContent = await readXmlFile(zip, resName);
  let relationshipArray = resContent["Relationships"]["Relationship"];
  let layoutFilename = "";
  let diagramFilename = "";
  const slideResObj = {};

  if (relationshipArray.constructor === Array) {
    for (const relationshipArrayItem of relationshipArray) {
      switch (relationshipArrayItem["attrs"]["Type"]) {
        case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout":
          layoutFilename = relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/");
          break;
        case "http://schemas.microsoft.com/office/2007/relationships/diagramDrawing":
          diagramFilename = relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/");
          slideResObj[relationshipArrayItem["attrs"]["Id"]] = {
            type: relationshipArrayItem["attrs"]["Type"].replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", ""),
            target: relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/"),
          };
          break;
        case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide":
        case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image":
        case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart":
        case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink":
        default:
          slideResObj[relationshipArrayItem["attrs"]["Id"]] = {
            type: relationshipArrayItem["attrs"]["Type"].replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", ""),
            target: relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/"),
          };
      }
    }
  } else layoutFilename = relationshipArray["attrs"]["Target"].replace("../", "ppt/");

  const slideLayoutContent = await readXmlFile(zip, layoutFilename);
  const slideLayoutTables = await indexNodes(slideLayoutContent);

  const slideLayoutResFilename = layoutFilename.replace("slideLayouts/slideLayout", "slideLayouts/_rels/slideLayout") + ".rels";
  const slideLayoutResContent = await readXmlFile(zip, slideLayoutResFilename);
  relationshipArray = slideLayoutResContent["Relationships"]["Relationship"];

  let masterFilename = "";
  const layoutResObj = {};
  if (relationshipArray.constructor === Array) {
    for (const relationshipArrayItem of relationshipArray) {
      switch (relationshipArrayItem["attrs"]["Type"]) {
        case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster":
          masterFilename = relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/");
          break;
        default:
          layoutResObj[relationshipArrayItem["attrs"]["Id"]] = {
            type: relationshipArrayItem["attrs"]["Type"].replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", ""),
            target: relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/"),
          };
      }
    }
  } else masterFilename = relationshipArray["attrs"]["Target"].replace("../", "ppt/");

  const slideMasterContent = await readXmlFile(zip, masterFilename);
  const slideMasterTextStyles = getTextByPathList(slideMasterContent, ["p:sldMaster", "p:txStyles"]);
  const slideMasterTables = indexNodes(slideMasterContent);

  const slideMasterResFilename = masterFilename.replace("slideMasters/slideMaster", "slideMasters/_rels/slideMaster") + ".rels";
  const slideMasterResContent = await readXmlFile(zip, slideMasterResFilename);
  relationshipArray = slideMasterResContent["Relationships"]["Relationship"];

  let themeFilename = "";
  const masterResObj = {};
  if (relationshipArray.constructor === Array) {
    for (const relationshipArrayItem of relationshipArray) {
      switch (relationshipArrayItem["attrs"]["Type"]) {
        case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme":
          break;
        default:
          masterResObj[relationshipArrayItem["attrs"]["Id"]] = {
            type: relationshipArrayItem["attrs"]["Type"].replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", ""),
            target: relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/"),
          };
      }
    }
  } else themeFilename = relationshipArray["attrs"]["Target"].replace("../", "ppt/");

  const themeResObj = {};
  if (themeFilename) {
    const themeName = themeFilename.split("/").pop();
    const themeResFileName = themeFilename.replace(themeName, "_rels/" + themeName) + ".rels";
    const themeResContent = await readXmlFile(zip, themeResFileName);
    if (themeResContent) {
      relationshipArray = themeResContent["Relationships"]["Relationship"];
      if (relationshipArray) {
        if (relationshipArray.constructor === Array) {
          for (const relationshipArrayItem of relationshipArray) {
            themeResObj[relationshipArrayItem["attrs"]["Id"]] = {
              type: relationshipArrayItem["attrs"]["Type"].replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", ""),
              target: relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/"),
            };
          }
        } else {
          themeResObj[relationshipArray["attrs"]["Id"]] = {
            type: relationshipArray["attrs"]["Type"].replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", ""),
            target: relationshipArray["attrs"]["Target"].replace("../", "ppt/"),
          };
        }
      }
    }
  }

  const diagramResObj = {};
  let digramFileContent = {};
  if (diagramFilename) {
    const diagName = diagramFilename.split("/").pop();
    const diagramResFileName = diagramFilename.replace(diagName, "_rels/" + diagName) + ".rels";
    digramFileContent = await readXmlFile(zip, diagramFilename);
    if (digramFileContent && digramFileContent && digramFileContent) {
      let digramFileContentObjToStr = JSON.stringify(digramFileContent);
      digramFileContentObjToStr = digramFileContentObjToStr.replace(/dsp:/g, "p:");
      digramFileContent = JSON.parse(digramFileContentObjToStr);
    }
    const digramResContent = await readXmlFile(zip, diagramResFileName);
    if (digramResContent) {
      relationshipArray = digramResContent["Relationships"]["Relationship"];
      if (relationshipArray.constructor === Array) {
        for (const relationshipArrayItem of relationshipArray) {
          diagramResObj[relationshipArrayItem["attrs"]["Id"]] = {
            type: relationshipArrayItem["attrs"]["Type"].replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", ""),
            target: relationshipArrayItem["attrs"]["Target"].replace("../", "ppt/"),
          };
        }
      } else {
        diagramResObj[relationshipArray["attrs"]["Id"]] = {
          type: relationshipArray["attrs"]["Type"].replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", ""),
          target: relationshipArray["attrs"]["Target"].replace("../", "ppt/"),
        };
      }
    }
  }

  const tableStyles = await readXmlFile(zip, "ppt/tableStyles.xml");

  const slideContent = await readXmlFile(zip, sldFileName);
  const nodes = slideContent["p:sld"]["p:cSld"]["p:spTree"];
  const warpObj = {
    zip,
    slideLayoutContent: slideLayoutContent,
    slideLayoutTables: slideLayoutTables,
    slideMasterContent: slideMasterContent,
    slideMasterTables: slideMasterTables,
    slideContent: slideContent,
    tableStyles: tableStyles,
    slideResObj: slideResObj,
    slideMasterTextStyles: slideMasterTextStyles,
    layoutResObj: layoutResObj,
    masterResObj: masterResObj,
    themeContent: themeContent,
    themeResObj: themeResObj,
    digramFileContent: digramFileContent,
    diagramResObj: diagramResObj,
    defaultTextStyle: defaultTextStyle,
  };
  let bgResult = "";
  if (processFullTheme === true) {
    bgResult = await getBackground(warpObj);
  }
  let bgColor = await getSlideBackgroundFill(warpObj);

  const elements = [];
  if (bgResult && bgResult.element && bgResult.element.length > 0) {
    elements.push({
      type: "group",
      width: slideSize.width,
      height: slideSize.height,
      elements: bgResult.element,
      fill: bgResult.fill && bgResult.fill.value,
      top: 0,
      left: 0,
      name: "背景组",
      angle: 0,
    });
  }
  for (const nodeKey in nodes) {
    if (nodes[nodeKey].constructor === Array) {
      for (const node of nodes[nodeKey]) {
        const ret = await processNodesInSlide(nodeKey, node, warpObj);
        if (ret) elements.push(ret);
      }
    } else {
      const ret = await processNodesInSlide(nodeKey, nodes[nodeKey], warpObj);
      if (ret) elements.push(ret);
    }
  }

  return {
    fill: bgColor,
    elements,
  };
}

function indexNodes(content) {
  const keys = Object.keys(content);
  const spTreeNode = content[keys[0]]["p:cSld"]["p:spTree"];
  const idTable = {};
  const idxTable = {};
  const typeTable = {};

  for (const key in spTreeNode) {
    if (key === "p:nvGrpSpPr" || key === "p:grpSpPr") continue;

    const targetNode = spTreeNode[key];

    if (targetNode.constructor === Array) {
      for (const targetNodeItem of targetNode) {
        const nvSpPrNode = targetNodeItem["p:nvSpPr"];
        const id = getTextByPathList(nvSpPrNode, ["p:cNvPr", "attrs", "id"]);
        const idx = getTextByPathList(nvSpPrNode, ["p:nvPr", "p:ph", "attrs", "idx"]);
        const type = getTextByPathList(nvSpPrNode, ["p:nvPr", "p:ph", "attrs", "type"]);

        if (id) idTable[id] = targetNodeItem;
        if (idx) idxTable[idx] = targetNodeItem;
        if (type) typeTable[type] = targetNodeItem;
      }
    } else {
      const nvSpPrNode = targetNode["p:nvSpPr"];
      const id = getTextByPathList(nvSpPrNode, ["p:cNvPr", "attrs", "id"]);
      const idx = getTextByPathList(nvSpPrNode, ["p:nvPr", "p:ph", "attrs", "idx"]);
      const type = getTextByPathList(nvSpPrNode, ["p:nvPr", "p:ph", "attrs", "type"]);

      if (id) idTable[id] = targetNode;
      if (idx) idxTable[idx] = targetNode;
      if (type) typeTable[type] = targetNode;
    }
  }

  return { idTable, idxTable, typeTable };
}

async function processNodesInSlide(nodeKey, nodeValue, warpObj, nodes, source, sType) {
  let json;

  switch (nodeKey) {
    case "p:sp": // Shape, Text
      json = processSpNode(nodeValue, warpObj, nodes, source, sType);
      break;
    case "p:cxnSp": // Shape, Text
      json = processCxnSpNode(nodeValue, warpObj, nodes, source, sType);
      break;
    case "p:pic": // Image, Video, Audio
      json = processPicNode(nodeValue, warpObj, source);
      break;
    case "p:graphicFrame": // Chart, Diagram, Table
      json = await processGraphicFrameNode(nodeValue, warpObj);
      break;
    case "p:grpSp":
      json = await processGroupSpNode(nodeValue, warpObj);
      break;
    case "mc:AlternateContent":
      json = await processGroupSpNode(getTextByPathList(nodeValue, ["mc:Fallback"]), warpObj);
      break;
    default:
  }

  return json;
}

async function processGroupSpNode(node, warpObj) {
  const xfrmNode = getTextByPathList(node, ["p:grpSpPr", "a:xfrm"]);
  if (!xfrmNode) return null;

  const x = parseInt(xfrmNode["a:off"]["attrs"]["x"]) * SLIDE_FACTOR;
  const y = parseInt(xfrmNode["a:off"]["attrs"]["y"]) * SLIDE_FACTOR;
  const chx = parseInt(xfrmNode["a:chOff"]["attrs"]["x"]) * SLIDE_FACTOR;
  const chy = parseInt(xfrmNode["a:chOff"]["attrs"]["y"]) * SLIDE_FACTOR;
  const cx = parseInt(xfrmNode["a:ext"]["attrs"]["cx"]) * SLIDE_FACTOR;
  const cy = parseInt(xfrmNode["a:ext"]["attrs"]["cy"]) * SLIDE_FACTOR;
  const chcx = parseInt(xfrmNode["a:chExt"]["attrs"]["cx"]) * SLIDE_FACTOR;
  const chcy = parseInt(xfrmNode["a:chExt"]["attrs"]["cy"]) * SLIDE_FACTOR;

  const elements = [];
  for (const nodeKey in node) {
    if (node[nodeKey].constructor === Array) {
      for (const item of node[nodeKey]) {
        const ret = await processNodesInSlide(nodeKey, item, warpObj);
        if (ret) elements.push(ret);
      }
    } else {
      const ret = await processNodesInSlide(nodeKey, node[nodeKey], warpObj);
      if (ret) elements.push(ret);
    }
  }

  return {
    type: "group",
    top: y - chy,
    left: x - chx,
    width: cx - chcx,
    height: cy - chcy,
    elements,
  };
}

function processSpNode(node, warpObj, pNode, source, sType) {
  const id = getTextByPathList(node, ["p:nvSpPr", "p:cNvPr", "attrs", "id"]);
  const name = getTextByPathList(node, ["p:nvSpPr", "p:cNvPr", "attrs", "name"]);
  const idx = getTextByPathList(node, ["p:nvSpPr", "p:nvPr", "p:ph", "attrs", "idx"]);
  let type = getTextByPathList(node, ["p:nvSpPr", "p:nvPr", "p:ph", "attrs", "type"]);
  let slideLayoutSpNode, slideMasterSpNode;
  let isUserDrawnBg;
  if (source == "slideLayoutBg" || source == "slideMasterBg") {
    let userDrawn = getTextByPathList(node, ["p:nvSpPr", "p:nvPr", "attrs", "userDrawn"]);
    if (userDrawn == "1") {
      isUserDrawnBg = true;
    } else {
      isUserDrawnBg = false;
    }
  }

  if (type) {
    if (idx) {
      slideLayoutSpNode = warpObj["slideLayoutTables"]["typeTable"][type];
      slideMasterSpNode = warpObj["slideMasterTables"]["typeTable"][type];
    } else {
      slideLayoutSpNode = warpObj["slideLayoutTables"]["typeTable"][type];
      slideMasterSpNode = warpObj["slideMasterTables"]["typeTable"][type];
    }
  } else if (idx) {
    slideLayoutSpNode = warpObj["slideLayoutTables"]["idxTable"][idx];
    slideMasterSpNode = warpObj["slideMasterTables"]["idxTable"][idx];
  }

  if (!type) {
    const txBoxVal = getTextByPathList(node, ["p:nvSpPr", "p:cNvSpPr", "attrs", "txBox"]);
    if (txBoxVal === "1") type = "text";
  }
  if (!type) type = getTextByPathList(slideLayoutSpNode, ["p:nvSpPr", "p:nvPr", "p:ph", "attrs", "type"]);
  if (!type) type = getTextByPathList(slideMasterSpNode, ["p:nvSpPr", "p:nvPr", "p:ph", "attrs", "type"]);

  if (!type) {
    if (source === "diagramBg") type = "diagram";
    else type = "obj";
  }
  return genShape(node, slideLayoutSpNode, slideMasterSpNode, id, name, idx, type, warpObj, pNode, isUserDrawnBg, sType, source);
}

function processCxnSpNode(node, warpObj) {
  const id = node["p:nvCxnSpPr"]["p:cNvPr"]["attrs"]["id"];
  const name = node["p:nvCxnSpPr"]["p:cNvPr"]["attrs"]["name"];
  const idx = node["p:nvCxnSpPr"]["p:nvPr"]["p:ph"] === undefined ? undefined : node["p:nvSpPr"]["p:nvPr"]["p:ph"]["attrs"]["idx"];
  const type = node["p:nvCxnSpPr"]["p:nvPr"]["p:ph"] === undefined ? undefined : node["p:nvSpPr"]["p:nvPr"]["p:ph"]["attrs"]["type"];

  return genShape(node, undefined, undefined, id, name, idx, type, warpObj);
}

function genShape(node, slideLayoutSpNode, slideMasterSpNode, id, name, idx, type, warpObj, pNode, isUserDrawnBg) {
  const xfrmList = ["p:spPr", "a:xfrm"];
  const slideXfrmNode = getTextByPathList(node, xfrmList);
  const slideLayoutXfrmNode = getTextByPathList(slideLayoutSpNode, xfrmList);
  const slideMasterXfrmNode = getTextByPathList(slideMasterSpNode, xfrmList);

  const shapType = getTextByPathList(node, ["p:spPr", "a:prstGeom", "attrs", "prst"]);
  const custShapType = getTextByPathList(node, ["p:spPr", "a:custGeom"]);

  const { top, left } = getPosition(slideXfrmNode, slideLayoutXfrmNode, slideMasterXfrmNode, SLIDE_FACTOR);
  const { width, height } = getSize(slideXfrmNode, slideLayoutXfrmNode, slideMasterXfrmNode, SLIDE_FACTOR);

  const isFlipV = getTextByPathList(slideXfrmNode, ["attrs", "flipV"]) === "1";
  const isFlipH = getTextByPathList(slideXfrmNode, ["attrs", "flipH"]) === "1";

  const rotate = angleToDegrees(getTextByPathList(slideXfrmNode, ["attrs", "rot"]));

  const txtXframeNode = getTextByPathList(node, ["p:txXfrm"]);
  let txtRotate;
  if (txtXframeNode) {
    const txtXframeRot = getTextByPathList(txtXframeNode, ["attrs", "rot"]);
    if (txtXframeRot) txtRotate = angleToDegrees(txtXframeRot) + 90;
  } else txtRotate = rotate;

  let content = "";
  if (node["p:txBody"] !== undefined && (isUserDrawnBg === undefined || isUserDrawnBg === true)) {
    content = genTextBody(node["p:txBody"], slideLayoutSpNode, slideMasterSpNode, type, warpObj, FONTSIZE_FACTOR, SLIDE_FACTOR, node["p:spPr"]);
  }
  const { borderColor, borderWidth, borderType, strokeDasharray } = getBorder(node, type, warpObj);
  const fillColor = getShapeFill(node, undefined, warpObj) || "";
  let shadow;
  const outerShdwNode = getTextByPathList(node, ["p:spPr", "a:effectLst", "a:outerShdw"]);
  if (outerShdwNode) shadow = getShadow(outerShdwNode, warpObj, SLIDE_FACTOR);

  const vAlign = getVerticalAlign(node, slideLayoutSpNode, slideMasterSpNode, type);
  const isVertical = getTextByPathList(node, ["p:txBody", "a:bodyPr", "attrs", "vert"]) === "eaVert";

  const data = {
    left,
    top,
    width,
    height,
    borderColor,
    borderWidth,
    borderType,
    borderStrokeDasharray: strokeDasharray,
    fillColor,

    isFlipV,
    isFlipH,
    rotate,
    vAlign,
    id,
    name,
    idx,
    ...content,
  };

  if (shadow) data.shadow = shadow;

  if (custShapType && type !== "diagram") {
    const ext = getTextByPathList(slideXfrmNode, ["a:ext", "attrs"]);
    const cx = parseInt(ext["cx"]) * SLIDE_FACTOR;
    const cy = parseInt(ext["cy"]) * SLIDE_FACTOR;
    const w = parseInt(ext["cx"]) * SLIDE_FACTOR;
    const h = parseInt(ext["cy"]) * SLIDE_FACTOR;
    const d = getCustomShapePath(custShapType, w, h);

    return {
      ...data,
      type: "shape",
      cx,
      cy,
      shapType: "custom",
      path: d,
    };
  }
  if (shapType && type !== "text") {
    const ext = getTextByPathList(slideXfrmNode, ["a:ext", "attrs"]);
    const cx = parseInt(ext["cx"]) * SLIDE_FACTOR;
    const cy = parseInt(ext["cy"]) * SLIDE_FACTOR;

    return {
      ...data,
      type: "shape",
      cx,
      cy,
      shapType,
    };
  }
  return {
    ...data,
    type: "text",
    isVertical,
    rotate: txtRotate,
  };
}

async function processPicNode(node, warpObj, source) {
  let resObj;
  if (source === "slideMasterBg") resObj = warpObj["masterResObj"];
  else if (source === "slideLayoutBg") resObj = warpObj["layoutResObj"];
  else resObj = warpObj["slideResObj"];

  const rid = node["p:blipFill"]["a:blip"]["attrs"]["r:embed"];
  const imgName = resObj[rid]["target"];
  const imgFileExt = extractFileExtension(imgName).toLowerCase();
  const zip = warpObj["zip"];
  const imgArrayBuffer = await zip.file(imgName).async("arraybuffer");
  const xfrmNode = node["p:spPr"]["a:xfrm"];

  const mimeType = getMimeType(imgFileExt);
  const { top, left } = getPosition(xfrmNode, undefined, undefined, SLIDE_FACTOR);
  const { width, height } = getSize(xfrmNode, undefined, undefined, SLIDE_FACTOR);
  const src = `data:${mimeType};base64,${base64ArrayBuffer(imgArrayBuffer)}`;

  let rotate = 0;
  const rotateNode = getTextByPathList(node, ["p:spPr", "a:xfrm", "attrs", "rot"]);
  if (rotateNode) rotate = angleToDegrees(rotateNode);

  const videoNode = getTextByPathList(node, ["p:nvPicPr", "p:nvPr", "a:videoFile"]);
  let videoRid, videoFile, videoFileExt, videoMimeType, uInt8ArrayVideo, videoBlob;
  let isVdeoLink = false;

  if (videoNode) {
    videoRid = videoNode["attrs"]["r:link"];
    videoFile = resObj[videoRid]["target"];
    if (isVideoLink(videoFile)) {
      videoFile = escapeHtml(videoFile);
      isVdeoLink = true;
    } else {
      videoFileExt = extractFileExtension(videoFile).toLowerCase();
      if (videoFileExt === "mp4" || videoFileExt === "webm" || videoFileExt === "ogg") {
        uInt8ArrayVideo = await zip.file(videoFile).async("arraybuffer");
        videoMimeType = getMimeType(videoFileExt);
        videoBlob = URL.createObjectURL(
          new Blob([uInt8ArrayVideo], {
            type: videoMimeType,
          })
        );
      }
    }
  }

  const audioNode = getTextByPathList(node, ["p:nvPicPr", "p:nvPr", "a:audioFile"]);
  let audioRid, audioFile, audioFileExt, uInt8ArrayAudio, audioBlob;
  if (audioNode) {
    audioRid = audioNode["attrs"]["r:link"];
    audioFile = resObj[audioRid]["target"];
    audioFileExt = extractFileExtension(audioFile).toLowerCase();
    if (audioFileExt === "mp3" || audioFileExt === "wav" || audioFileExt === "ogg") {
      uInt8ArrayAudio = await zip.file(audioFile).async("arraybuffer");
      audioBlob = URL.createObjectURL(new Blob([uInt8ArrayAudio]));
    }
  }

  if (videoNode && !isVdeoLink) {
    return {
      type: "video",
      top,
      left,
      width,
      height,
      rotate,
      blob: videoBlob,
    };
  }
  if (videoNode && isVdeoLink) {
    return {
      type: "video",
      top,
      left,
      width,
      height,
      rotate,
      src: videoFile,
    };
  }
  if (audioNode) {
    return {
      type: "audio",
      top,
      left,
      width,
      height,
      rotate,
      blob: audioBlob,
    };
  }
  return {
    type: "image",
    top,
    left,
    width,
    height,
    rotate,
    src,
  };
}

async function processGraphicFrameNode(node, warpObj) {
  const graphicTypeUri = getTextByPathList(node, ["a:graphic", "a:graphicData", "attrs", "uri"]);

  let result;
  switch (graphicTypeUri) {
    case "http://schemas.openxmlformats.org/drawingml/2006/table":
      result = genTable(node, warpObj);
      break;
    case "http://schemas.openxmlformats.org/drawingml/2006/chart":
      result = await genChart(node, warpObj);
      break;
    case "http://schemas.openxmlformats.org/drawingml/2006/diagram":
      result = genDiagram(node, warpObj);
      break;
    case "http://schemas.openxmlformats.org/presentationml/2006/ole":
      // eslint-disable-next-line no-case-declarations
      let oleObjNode = getTextByPathList(node, ["a:graphic", "a:graphicData", "mc:AlternateContent", "mc:Fallback", "p:oleObj"]);
      if (!oleObjNode) oleObjNode = getTextByPathList(node, ["a:graphic", "a:graphicData", "p:oleObj"]);
      else processGroupSpNode(oleObjNode, warpObj);
      break;
    default:
  }
  return result;
}

function genTable(node, warpObj) {
  const tableNode = getTextByPathList(node, ["a:graphic", "a:graphicData", "a:tbl"]);
  const xfrmNode = getTextByPathList(node, ["p:xfrm"]);
  const { top, left } = getPosition(xfrmNode, undefined, undefined, SLIDE_FACTOR);
  const { width, height } = getSize(xfrmNode, undefined, undefined, SLIDE_FACTOR);

  const getTblPr = getTextByPathList(node, ["a:graphic", "a:graphicData", "a:tbl", "a:tblPr"]);

  let thisTblStyle;
  const tbleStyleId = getTblPr["a:tableStyleId"];
  if (tbleStyleId) {
    const tbleStylList = warpObj["tableStyles"]["a:tblStyleLst"]["a:tblStyle"];
    if (tbleStylList) {
      if (tbleStylList.constructor === Array) {
        for (let k = 0; k < tbleStylList.length; k++) {
          if (tbleStylList[k]["attrs"]["styleId"] === tbleStyleId) {
            thisTblStyle = tbleStylList[k];
          }
        }
      } else {
        if (tbleStylList["attrs"]["styleId"] === tbleStyleId) {
          thisTblStyle = tbleStylList;
        }
      }
    }
  }

  let themeColor = "";
  let tbl_bgFillschemeClr = getTextByPathList(thisTblStyle, ["a:tblBg", "a:fillRef"]);
  if (tbl_bgFillschemeClr) {
    themeColor = getSolidFill(tbl_bgFillschemeClr, undefined, undefined, warpObj);
  }
  if (tbl_bgFillschemeClr === undefined) {
    tbl_bgFillschemeClr = getTextByPathList(thisTblStyle, ["a:wholeTbl", "a:tcStyle", "a:fill", "a:solidFill"]);
    themeColor = getSolidFill(tbl_bgFillschemeClr, undefined, undefined, warpObj);
  }
  if (themeColor !== "") themeColor = "#" + themeColor;

  const trNodes = tableNode["a:tr"];

  const data = [];
  if (trNodes.constructor === Array) {
    for (const trNode of trNodes) {
      const tcNodes = trNode["a:tc"];
      const tr = [];

      if (tcNodes.constructor === Array) {
        for (const tcNode of tcNodes) {
          const text = genTextBody(tcNode["a:txBody"], undefined, undefined, undefined, warpObj, FONTSIZE_FACTOR, SLIDE_FACTOR);
          const rowSpan = getTextByPathList(tcNode, ["attrs", "rowSpan"]);
          const colSpan = getTextByPathList(tcNode, ["attrs", "gridSpan"]);
          const vMerge = getTextByPathList(tcNode, ["attrs", "vMerge"]);
          const hMerge = getTextByPathList(tcNode, ["attrs", "hMerge"]);

          tr.push({ text, rowSpan, colSpan, vMerge, hMerge });
        }
      } else {
        const text = genTextBody(tcNodes["a:txBody"], undefined, undefined, undefined, warpObj, FONTSIZE_FACTOR, SLIDE_FACTOR);
        tr.push({ text });
      }
      data.push(tr);
    }
  } else {
    const tcNodes = trNodes["a:tc"];
    const tr = [];

    if (tcNodes.constructor === Array) {
      for (const tcNode of tcNodes) {
        const text = genTextBody(tcNode["a:txBody"], undefined, undefined, undefined, warpObj, FONTSIZE_FACTOR, SLIDE_FACTOR);
        tr.push({ text });
      }
    } else {
      const text = genTextBody(tcNodes["a:txBody"], undefined, undefined, undefined, warpObj, FONTSIZE_FACTOR, SLIDE_FACTOR);
      tr.push({ text });
    }
    data.push(tr);
  }

  return {
    type: "table",
    top,
    left,
    width,
    height,
    data,
    themeColor,
  };
}

async function genChart(node, warpObj) {
  const xfrmNode = getTextByPathList(node, ["p:xfrm"]);
  const { top, left } = getPosition(xfrmNode, undefined, undefined, SLIDE_FACTOR);
  const { width, height } = getSize(xfrmNode, undefined, undefined, SLIDE_FACTOR);

  const rid = node["a:graphic"]["a:graphicData"]["c:chart"]["attrs"]["r:id"];
  const refName = warpObj["slideResObj"][rid]["target"];
  const content = await readXmlFile(warpObj["zip"], refName);
  const plotArea = getTextByPathList(content, ["c:chartSpace", "c:chart", "c:plotArea"]);

  const chart = getChartInfo(plotArea);

  if (!chart) return {};

  const data = {
    type: "chart",
    top,
    left,
    width,
    height,
    data: chart.data,
    chartType: chart.type,
  };
  if (chart.marker !== undefined) data.marker = chart.marker;
  if (chart.barDir !== undefined) data.barDir = chart.barDir;
  if (chart.holeSize !== undefined) data.holeSize = chart.holeSize;
  if (chart.grouping !== undefined) data.grouping = chart.grouping;
  if (chart.style !== undefined) data.style = chart.style;

  return data;
}

function genDiagram(node, warpObj) {
  const xfrmNode = getTextByPathList(node, ["p:xfrm"]);
  const { left, top } = getPosition(xfrmNode, undefined, undefined, SLIDE_FACTOR);
  const { width, height } = getSize(xfrmNode, undefined, undefined, SLIDE_FACTOR);

  const dgmDrwSpArray = getTextByPathList(warpObj["digramFileContent"], ["p:drawing", "p:spTree", "p:sp"]);
  const elements = [];
  if (dgmDrwSpArray) {
    for (const item of dgmDrwSpArray) {
      const el = processSpNode(item, warpObj, "diagramBg");
      if (el) elements.push(el);
    }
  }

  return {
    type: "diagram",
    left,
    top,
    width,
    height,
    elements,
  };
}
